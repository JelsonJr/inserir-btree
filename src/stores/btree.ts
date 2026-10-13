/**
 * stores/btree.ts
 *
 * Estado da aplicação: árvore atual, histórico (desfazer/refazer),
 * reprodução passo a passo das operações, registro de eventos,
 * persistência local, importação/exportação e benchmark.
 */

import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, watch } from 'vue'
import {
  BTree,
  DEFAULT_ORDER,
  isValidOrder,
  type StepKind,
  type TraceStep,
  type TreeSnapshot,
} from '@/lib/btree'
import { parseKey, parseKeys, randomKeys, sequence } from '@/lib/parse'

export interface PlaybackStep extends TraceStep {
  snapshot: TreeSnapshot
}

export interface Highlight {
  nodeIds: number[]
  key?: number
  kind?: StepKind
}

export type LogLevel = 'success' | 'info' | 'warning' | 'error'

export interface LogEntry {
  id: number
  time: number
  level: LogLevel
  text: string
}

export interface BenchmarkResult {
  id: number
  count: number
  order: number
  insertMs: number
  searchMs: number
  deleteMs: number
  height: number
  nodes: number
  valid: boolean
}

const STORAGE_KEY = 'btree-visualizer:v1'
const HISTORY_LIMIT = 100
const LOG_LIMIT = 300
/** Acima deste tamanho a gravação de passos é desligada (custo de snapshots). */
export const TRACE_SIZE_LIMIT = 2000
/** Máximo de chaves geradas por uma única operação em lote. */
export const BULK_LIMIT = 20_000
const BASE_STEP_DELAY = 900

interface Persisted {
  snapshot?: TreeSnapshot
  animate?: boolean
  speed?: number
  autoFit?: boolean
}

function loadPersisted (): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Persisted : {}
  } catch {
    return {}
  }
}

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

export const useBTreeStore = defineStore('btree', () => {
  const persisted = loadPersisted()

  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------

  function initialTree (): BTree {
    if (persisted.snapshot) {
      try {
        return BTree.fromSnapshot(persisted.snapshot)
      } catch {
        // Snapshot corrompido: começa do zero.
      }
    }
    return new BTree(DEFAULT_ORDER)
  }

  // A árvore não é reativa (markRaw) para não pagar o custo de proxies em
  // estruturas grandes; `version` sinaliza as mudanças para a interface.
  const tree = shallowRef<BTree>(markRaw(initialTree()))
  const version = ref(0)
  const order = computed(() => tree.value.order)

  const past = shallowRef<TreeSnapshot[]>([])
  const future = shallowRef<TreeSnapshot[]>([])

  const animate = ref(persisted.animate ?? true)
  const speed = ref(persisted.speed ?? 1)
  const autoFit = ref(persisted.autoFit ?? true)

  const steps = shallowRef<PlaybackStep[]>([])
  const stepIndex = ref(-1)
  const playing = ref(false)
  const finalHighlight = shallowRef<Highlight | null>(null)

  const log = ref<LogEntry[]>([])
  const benchmarks = ref<BenchmarkResult[]>([])
  const benchmarkRunning = ref(false)
  let nextLogId = 1

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------

  const liveSnapshot = computed(() => {
    void version.value
    return tree.value.snapshot()
  })
  const stats = computed(() => {
    void version.value
    return tree.value.stats()
  })
  const inOrder = computed(() => {
    void version.value
    return tree.value.inOrder()
  })
  const levelOrder = computed(() => {
    void version.value
    return tree.value.levelOrder()
  })
  const preOrder = computed(() => {
    void version.value
    return tree.value.preOrder()
  })
  const validationErrors = computed(() => {
    void version.value
    return tree.value.validate()
  })

  const currentStep = computed<PlaybackStep | null>(() =>
    stepIndex.value >= 0 ? steps.value[stepIndex.value] ?? null : null,
  )
  const displaySnapshot = computed(() => currentStep.value?.snapshot ?? liveSnapshot.value)
  const highlight = computed<Highlight | null>(() => {
    const step = currentStep.value
    if (step) return { nodeIds: step.nodeIds, key: step.key, kind: step.kind }
    return finalHighlight.value
  })

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const stepDelay = computed(() => BASE_STEP_DELAY / Math.max(0.25, speed.value))

  // ---------------------------------------------------------------------------
  // Registro
  // ---------------------------------------------------------------------------

  function addLog (level: LogLevel, text: string) {
    log.value.unshift({ id: nextLogId++, time: Date.now(), level, text })
    if (log.value.length > LOG_LIMIT) log.value.length = LOG_LIMIT
  }

  function clearLog () {
    log.value = []
  }

  // ---------------------------------------------------------------------------
  // Reprodução passo a passo
  // ---------------------------------------------------------------------------

  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer () {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function scheduleNext () {
    clearTimer()
    timer = setTimeout(() => {
      if (stepIndex.value < steps.value.length - 1) {
        stepIndex.value++
        scheduleNext()
      } else {
        stepIndex.value = -1
        playing.value = false
      }
    }, stepDelay.value)
  }

  function startPlayback (recorded: PlaybackStep[]) {
    clearTimer()
    steps.value = recorded
    if (recorded.length === 0) {
      stepIndex.value = -1
      playing.value = false
      return
    }
    stepIndex.value = 0
    playing.value = true
    scheduleNext()
  }

  function play () {
    if (steps.value.length === 0) return
    if (stepIndex.value < 0 || stepIndex.value >= steps.value.length - 1) stepIndex.value = 0
    playing.value = true
    scheduleNext()
  }

  function pause () {
    clearTimer()
    playing.value = false
  }

  function seek (index: number) {
    pause()
    if (steps.value.length === 0) return
    stepIndex.value = Math.max(0, Math.min(steps.value.length - 1, index))
  }

  function nextStep () {
    seek(stepIndex.value < 0 ? 0 : stepIndex.value + 1)
  }

  function prevStep () {
    seek(stepIndex.value < 0 ? steps.value.length - 1 : stepIndex.value - 1)
  }

  /** Pula a animação e mostra a árvore final. */
  function skipPlayback () {
    pause()
    stepIndex.value = -1
  }

  function resetPlayback () {
    pause()
    steps.value = []
    stepIndex.value = -1
    finalHighlight.value = null
  }

  // ---------------------------------------------------------------------------
  // Núcleo das operações
  // ---------------------------------------------------------------------------

  function pushHistory (snapshot: TreeSnapshot) {
    const next = [...past.value, snapshot]
    if (next.length > HISTORY_LIMIT) next.shift()
    past.value = next
    future.value = []
  }

  function setTree (next: BTree) {
    tree.value = markRaw(next)
    version.value++
  }

  /**
   * Executa `fn` sobre a árvore gravando os passos (se habilitado).
   * Em caso de erro inesperado a árvore é restaurada ao estado anterior.
   */
  function run<R> (fn: (t: BTree) => R, opts: { trace: boolean, mutates: boolean }): { result: R, recorded: PlaybackStep[], before: TreeSnapshot | null } | null {
    skipPlayback()
    const t = tree.value
    const before = opts.mutates ? t.snapshot() : null
    const recorded: PlaybackStep[] = []
    if (opts.trace && animate.value && t.size <= TRACE_SIZE_LIMIT) {
      t.onStep = step => recorded.push({ ...step, snapshot: t.snapshot() })
    }
    try {
      return { result: fn(t), recorded, before }
    } catch (error) {
      if (before) setTree(BTree.fromSnapshot(before))
      addLog('error', `Erro inesperado: ${(error as Error).message}`)
      return null
    } finally {
      t.onStep = null
    }
  }

  function locate (key: number): Highlight | null {
    const result = tree.value.search(key)
    return result.found && result.nodeId !== null
      ? { nodeIds: [result.nodeId], key, kind: 'found' }
      : null
  }

  function commit (before: TreeSnapshot | null) {
    if (before) pushHistory(before)
    version.value++
  }

  // ---------------------------------------------------------------------------
  // Operações
  // ---------------------------------------------------------------------------

  function insert (raw: unknown): boolean {
    const key = parseKey(raw)
    if (key === null) {
      addLog('warning', 'Digite um número válido para inserir.')
      return false
    }
    const out = run(t => t.insert(key), { trace: true, mutates: true })
    if (!out) return false
    if (!out.result) {
      addLog('warning', `A chave ${key} já existe na árvore.`)
      finalHighlight.value = locate(key)
      startPlayback(out.recorded)
      return false
    }
    commit(out.before)
    finalHighlight.value = locate(key)
    startPlayback(out.recorded)
    addLog('success', `Inserida a chave ${key}.`)
    return true
  }

  function remove (raw: unknown): boolean {
    const key = parseKey(raw)
    if (key === null) {
      addLog('warning', 'Digite um número válido para remover.')
      return false
    }
    const out = run(t => t.delete(key), { trace: true, mutates: true })
    if (!out) return false
    finalHighlight.value = null
    if (!out.result) {
      addLog('warning', `A chave ${key} não está na árvore.`)
      startPlayback(out.recorded)
      return false
    }
    commit(out.before)
    startPlayback(out.recorded)
    addLog('success', `Removida a chave ${key}.`)
    return true
  }

  function search (raw: unknown): boolean {
    const key = parseKey(raw)
    if (key === null) {
      addLog('warning', 'Digite um número válido para buscar.')
      return false
    }
    const out = run(t => t.search(key), { trace: true, mutates: false })
    if (!out) return false
    const { found, nodeId, path } = out.result
    finalHighlight.value = found && nodeId !== null
      ? { nodeIds: [nodeId], key, kind: 'found' }
      : { nodeIds: path, key, kind: 'not-found' }
    startPlayback(out.recorded)
    addLog(found ? 'success' : 'info', found
      ? `Chave ${key} encontrada após visitar ${path.length} nó(s).`
      : `Chave ${key} não encontrada (${path.length} nó(s) visitados).`)
    return found
  }

  function insertBulk (keys: number[], label: string) {
    if (keys.length === 0) {
      addLog('warning', 'Nenhuma chave para inserir.')
      return
    }
    const limited = keys.slice(0, BULK_LIMIT)
    const out = run(t => t.insertMany(limited), { trace: false, mutates: true })
    if (!out) return
    resetPlayback()
    const { inserted, duplicates } = out.result
    if (inserted.length > 0) commit(out.before)
    let text = `${label}: ${fmtNum(inserted.length)} chave(s) inserida(s)`
    if (duplicates.length > 0) text += `, ${fmtNum(duplicates.length)} duplicada(s) ignorada(s)`
    if (keys.length > limited.length) text += ` (limitado a ${fmtNum(BULK_LIMIT)})`
    addLog(inserted.length > 0 ? 'success' : 'warning', `${text}.`)
  }

  function insertText (text: string) {
    const { keys, invalid } = parseKeys(text)
    if (invalid.length > 0) {
      addLog('warning', `Valores ignorados por não serem números: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}`)
    }
    if (keys.length === 1) {
      insert(keys[0])
      return
    }
    insertBulk(keys, 'Inserção em lote')
  }

  function insertRandom (count: number, min: number, max: number) {
    const n = Math.min(Math.max(0, Math.floor(count)), BULK_LIMIT)
    const keys = randomKeys(n, min, max, k => tree.value.has(k))
    if (keys.length < n) {
      addLog('info', `O intervalo [${min}, ${max}] só comporta mais ${keys.length} chave(s) distinta(s).`)
    }
    insertBulk(keys, 'Inserção aleatória')
  }

  function insertSequence (from: number, to: number, step: number) {
    insertBulk(sequence(from, to, step, BULK_LIMIT), 'Inserção sequencial')
  }

  function removeRandom (count: number) {
    const keys = tree.value.inOrder()
    const n = Math.min(Math.max(0, Math.floor(count)), keys.length)
    if (n === 0) {
      addLog('warning', 'Não há chaves para remover.')
      return
    }
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[keys[i], keys[j]] = [keys[j], keys[i]]
    }
    const out = run(t => t.deleteMany(keys.slice(0, n)), { trace: false, mutates: true })
    if (!out) return
    resetPlayback()
    commit(out.before)
    addLog('success', `Removidas ${fmtNum(out.result)} chave(s) aleatória(s).`)
  }

  function clear () {
    if (tree.value.isEmpty) return
    const before = tree.value.snapshot()
    resetPlayback()
    tree.value.clear()
    commit(before)
    addLog('info', 'Árvore limpa.')
  }

  /** Reconstrói a árvore com outra ordem, reinserindo as chaves em ordem. */
  function setOrder (next: number) {
    if (!isValidOrder(next) || next === tree.value.order) return
    const before = tree.value.snapshot()
    resetPlayback()
    setTree(BTree.fromKeys(next, tree.value.inOrder()))
    pushHistory(before)
    addLog('info', `Ordem alterada para ${next} (máx. ${next - 1} chave(s) por nó). Árvore reconstruída.`)
  }

  function undo () {
    const snapshot = past.value.at(-1)
    if (!snapshot) return
    resetPlayback()
    future.value = [...future.value, tree.value.snapshot()]
    past.value = past.value.slice(0, -1)
    setTree(BTree.fromSnapshot(snapshot))
    addLog('info', 'Desfeito.')
  }

  function redo () {
    const snapshot = future.value.at(-1)
    if (!snapshot) return
    resetPlayback()
    past.value = [...past.value, tree.value.snapshot()]
    future.value = future.value.slice(0, -1)
    setTree(BTree.fromSnapshot(snapshot))
    addLog('info', 'Refeito.')
  }

  // ---------------------------------------------------------------------------
  // Importação / exportação
  // ---------------------------------------------------------------------------

  function exportJson (): string {
    const snapshot = tree.value.snapshot()
    return JSON.stringify({ ...snapshot, keys: tree.value.inOrder() }, null, 2)
  }

  function importJson (text: string): boolean {
    try {
      const data = JSON.parse(text)
      let next: BTree
      if (Array.isArray(data)) {
        next = BTree.fromKeys(tree.value.order, data)
      } else if (data && typeof data === 'object' && 'root' in data) {
        next = BTree.fromSnapshot(data as TreeSnapshot)
      } else if (data && Array.isArray(data.keys)) {
        next = BTree.fromKeys(isValidOrder(data.order) ? data.order : tree.value.order, data.keys)
      } else {
        throw new Error('formato não reconhecido')
      }
      const before = tree.value.snapshot()
      resetPlayback()
      setTree(next)
      pushHistory(before)
      addLog('success', `Importadas ${fmtNum(next.size)} chave(s) (ordem ${next.order}).`)
      return true
    } catch (error) {
      addLog('error', `Falha ao importar: ${(error as Error).message}`)
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Benchmark (em uma árvore separada, sem afetar a visualização)
  // ---------------------------------------------------------------------------

  function runBenchmark (count: number, benchOrder: number): Promise<BenchmarkResult | null> {
    benchmarkRunning.value = true
    return new Promise(resolve => {
      // Deixa a interface atualizar o indicador de carregamento antes do cálculo.
      setTimeout(() => {
        try {
          const n = Math.min(Math.max(1, Math.floor(count)), 1_000_000)
          const keys = Array.from({ length: n }, (_, i) => i)
          for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[keys[i], keys[j]] = [keys[j], keys[i]]
          }
          const t = new BTree(benchOrder)
          let start = performance.now()
          for (const k of keys) t.insert(k)
          const insertMs = performance.now() - start

          start = performance.now()
          for (const k of keys) t.has(k)
          const searchMs = performance.now() - start

          const stats = t.stats()
          const valid = t.validate().length === 0

          start = performance.now()
          for (const k of keys) t.delete(k)
          const deleteMs = performance.now() - start

          const result: BenchmarkResult = {
            id: Date.now(),
            count: n,
            order: benchOrder,
            insertMs,
            searchMs,
            deleteMs,
            height: stats.height,
            nodes: stats.nodes,
            valid: valid && t.isEmpty,
          }
          benchmarks.value.unshift(result)
          if (benchmarks.value.length > 10) benchmarks.value.length = 10
          addLog('info', `Benchmark: ${fmtNum(n)} chaves, ordem ${benchOrder} — inserção ${insertMs.toFixed(1)} ms, busca ${searchMs.toFixed(1)} ms, remoção ${deleteMs.toFixed(1)} ms.`)
          resolve(result)
        } catch (error) {
          addLog('error', `Benchmark falhou: ${(error as Error).message}`)
          resolve(null)
        } finally {
          benchmarkRunning.value = false
        }
      }, 30)
    })
  }

  // ---------------------------------------------------------------------------
  // Persistência
  // ---------------------------------------------------------------------------

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  watch([version, animate, speed, autoFit], () => {
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const data: Persisted = {
          snapshot: tree.value.snapshot(),
          animate: animate.value,
          speed: speed.value,
          autoFit: autoFit.value,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // Armazenamento indisponível ou cheio: segue sem persistir.
      }
    }, 400)
  })

  return {
    // estado
    order,
    version,
    animate,
    speed,
    autoFit,
    steps,
    stepIndex,
    playing,
    log,
    benchmarks,
    benchmarkRunning,
    // derivados
    stats,
    inOrder,
    levelOrder,
    preOrder,
    validationErrors,
    currentStep,
    displaySnapshot,
    highlight,
    canUndo,
    canRedo,
    // operações
    insert,
    insertText,
    insertRandom,
    insertSequence,
    remove,
    removeRandom,
    search,
    clear,
    setOrder,
    undo,
    redo,
    exportJson,
    importJson,
    runBenchmark,
    rangeQuery: (lo: number, hi: number) => tree.value.range(lo, hi),
    // reprodução
    play,
    pause,
    seek,
    nextStep,
    prevStep,
    skipPlayback,
    // registro
    addLog,
    clearLog,
  }
})
