/**
 * lib/btree.ts
 *
 * Implementação de Árvore B de ordem configurável (número máximo de filhos
 * por nó). Suporta inserção, remoção, busca, percursos, estatísticas,
 * validação de invariantes e serialização.
 *
 * Cada operação pode emitir "passos" (TraceStep) através de `onStep`, que a
 * interface usa para animar o algoritmo. Quando `onStep` é nulo nenhuma
 * mensagem é construída, mantendo as operações em massa rápidas.
 */

export const MIN_ORDER = 3
export const MAX_ORDER = 10
export const DEFAULT_ORDER = 3

export interface BTreeNode {
  id: number
  keys: number[]
  children: BTreeNode[]
}

export interface NodeSnapshot {
  id: number
  keys: number[]
  children: NodeSnapshot[]
}

export interface TreeSnapshot {
  order: number
  nextId: number
  root: NodeSnapshot | null
}

export type StepKind =
  | 'visit'
  | 'insert'
  | 'overflow'
  | 'split'
  | 'new-root'
  | 'duplicate'
  | 'found'
  | 'not-found'
  | 'remove'
  | 'replace'
  | 'borrow'
  | 'merge'
  | 'shrink'

export interface TraceStep {
  kind: StepKind
  message: string
  /** Nós envolvidos no passo (destacados na visualização). */
  nodeIds: number[]
  /** Chave em destaque no passo, se houver. */
  key?: number
}

export interface SearchResult {
  found: boolean
  nodeId: number | null
  path: number[]
}

export interface BulkResult {
  inserted: number[]
  duplicates: number[]
  invalid: unknown[]
}

export interface TreeStats {
  size: number
  nodes: number
  leaves: number
  height: number
  min: number | null
  max: number | null
  /** Ocupação média dos nós (0..1) em relação ao máximo de chaves. */
  fill: number
}

/** Primeiro índice `i` tal que `keys[i] >= key` (busca binária). */
export function lowerBound (keys: readonly number[], key: number): number {
  let lo = 0
  let hi = keys.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (keys[mid] < key) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function isValidKey (value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isValidOrder (order: unknown): order is number {
  return Number.isInteger(order) && (order as number) >= MIN_ORDER && (order as number) <= MAX_ORDER
}

const fmt = (keys: readonly number[]) => `[${keys.join(', ')}]`

const isLeaf = (node: BTreeNode) => node.children.length === 0

export class BTree {
  readonly order: number
  /** Callback opcional chamado a cada passo das operações. */
  onStep: ((step: TraceStep) => void) | null = null

  private root: BTreeNode | null = null
  private nextId = 1
  private count = 0

  constructor (order: number = DEFAULT_ORDER) {
    if (!isValidOrder(order)) {
      throw new RangeError(`A ordem deve ser um inteiro entre ${MIN_ORDER} e ${MAX_ORDER}.`)
    }
    this.order = order
  }

  /** Número máximo de chaves por nó. */
  get maxKeys (): number {
    return this.order - 1
  }

  /** Número mínimo de chaves em nós que não são a raiz. */
  get minKeys (): number {
    return Math.ceil(this.order / 2) - 1
  }

  get size (): number {
    return this.count
  }

  get isEmpty (): boolean {
    return this.root === null
  }

  // ---------------------------------------------------------------------------
  // Construção / serialização
  // ---------------------------------------------------------------------------

  static fromKeys (order: number, keys: Iterable<unknown>): BTree {
    const tree = new BTree(order)
    tree.insertMany(keys)
    return tree
  }

  /** Reconstrói a árvore a partir de um snapshot, validando a estrutura. */
  static fromSnapshot (snapshot: TreeSnapshot): BTree {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new TypeError('Snapshot inválido.')
    }
    const tree = new BTree(snapshot.order)
    let maxId = 0
    let count = 0
    const build = (n: NodeSnapshot): BTreeNode => {
      if (!n || !Array.isArray(n.keys) || !Array.isArray(n.children ?? [])) {
        throw new TypeError('Nó inválido no snapshot.')
      }
      if (!n.keys.every(isValidKey)) throw new TypeError('Chave inválida no snapshot.')
      const id = Number.isInteger(n.id) && n.id > 0 ? n.id : 0
      maxId = Math.max(maxId, id)
      count += n.keys.length
      return { id, keys: [...n.keys], children: (n.children ?? []).map(build) }
    }
    tree.root = snapshot.root ? build(snapshot.root) : null
    tree.count = count
    tree.nextId = Math.max(maxId + 1, Number.isInteger(snapshot.nextId) ? snapshot.nextId : 1)
    // Atribui ids a nós sem id (ou repetidos) para manter a identidade estável.
    const seen = new Set<number>()
    tree.forEachNode(node => {
      if (node.id === 0 || seen.has(node.id)) node.id = tree.nextId++
      seen.add(node.id)
    })
    const errors = tree.validate()
    if (errors.length > 0) {
      throw new Error(`Estrutura inválida: ${errors[0]}`)
    }
    return tree
  }

  snapshot (): TreeSnapshot {
    const copy = (n: BTreeNode): NodeSnapshot => ({
      id: n.id,
      keys: n.keys.slice(),
      children: n.children.map(copy),
    })
    return { order: this.order, nextId: this.nextId, root: this.root ? copy(this.root) : null }
  }

  clone (): BTree {
    return BTree.fromSnapshot(this.snapshot())
  }

  clear (): void {
    this.root = null
    this.count = 0
  }

  // ---------------------------------------------------------------------------
  // Busca
  // ---------------------------------------------------------------------------

  has (key: number): boolean {
    let node = this.root
    while (node) {
      const i = lowerBound(node.keys, key)
      if (i < node.keys.length && node.keys[i] === key) return true
      node = isLeaf(node) ? null : node.children[i]
    }
    return false
  }

  search (key: number): SearchResult {
    const path: number[] = []
    let node = this.root
    while (node) {
      path.push(node.id)
      this.step('visit', () => `Visitando o nó ${fmt(node!.keys)}`, [node.id], key)
      const i = lowerBound(node.keys, key)
      if (i < node.keys.length && node.keys[i] === key) {
        this.step('found', () => `Chave ${key} encontrada no nó ${fmt(node!.keys)}`, [node.id], key)
        return { found: true, nodeId: node.id, path }
      }
      node = isLeaf(node) ? null : node.children[i]
    }
    this.step('not-found', () => `Chave ${key} não está na árvore`, path.slice(-1), key)
    return { found: false, nodeId: null, path }
  }

  /** Todas as chaves no intervalo fechado [lo, hi], em ordem. */
  range (lo: number, hi: number): number[] {
    const out: number[] = []
    if (lo > hi) return out
    const walk = (node: BTreeNode) => {
      const start = lowerBound(node.keys, lo)
      for (let i = start; i <= node.keys.length; i++) {
        if (!isLeaf(node)) walk(node.children[i])
        if (i === node.keys.length) break
        const k = node.keys[i]
        if (k > hi) return
        out.push(k)
      }
    }
    if (this.root) walk(this.root)
    return out
  }

  min (): number | null {
    let node = this.root
    if (!node) return null
    while (!isLeaf(node)) node = node.children[0]
    return node.keys[0]
  }

  max (): number | null {
    let node = this.root
    if (!node) return null
    while (!isLeaf(node)) node = node.children[node.children.length - 1]
    return node.keys[node.keys.length - 1]
  }

  // ---------------------------------------------------------------------------
  // Inserção
  // ---------------------------------------------------------------------------

  /** Insere uma chave. Retorna `false` se a chave já existir. */
  insert (key: number): boolean {
    if (!isValidKey(key)) throw new TypeError(`Chave inválida: ${String(key)}`)

    if (!this.root) {
      this.root = this.createNode([key])
      this.count = 1
      this.step('insert', () => `Árvore vazia: ${key} vira a raiz`, [this.root!.id], key)
      return true
    }

    // Desce até a folha guardando o caminho para tratar overflow de baixo para cima.
    const path: Array<{ node: BTreeNode, index: number }> = []
    let node = this.root
    for (;;) {
      this.step('visit', () => `Visitando o nó ${fmt(node.keys)}`, [node.id], key)
      const i = lowerBound(node.keys, key)
      if (i < node.keys.length && node.keys[i] === key) {
        this.step('duplicate', () => `Chave ${key} já existe — inserção ignorada`, [node.id], key)
        return false
      }
      if (isLeaf(node)) {
        node.keys.splice(i, 0, key)
        this.count++
        this.step('insert', () => `Inserindo ${key} na folha → ${fmt(node.keys)}`, [node.id], key)
        break
      }
      path.push({ node, index: i })
      node = node.children[i]
    }

    // Divide nós cheios propagando a mediana para cima.
    while (node.keys.length > this.maxKeys) {
      const overflowing = node
      this.step('overflow', () => `Nó ${fmt(overflowing.keys)} excedeu ${this.maxKeys} chave(s)`, [overflowing.id], key)

      const mid = Math.floor(node.keys.length / 2)
      const median = node.keys[mid]
      const right = this.createNode(
        node.keys.slice(mid + 1),
        isLeaf(node) ? [] : node.children.slice(mid + 1),
      )
      node.keys.length = mid
      if (!isLeaf(node)) node.children.length = mid + 1

      const parentEntry = path.pop()
      if (!parentEntry) {
        this.root = this.createNode([median], [node, right])
        const newRoot = this.root
        this.step('split', () => `Dividindo: ${fmt(node.keys)} | ${median} | ${fmt(right.keys)}`, [node.id, right.id, newRoot.id], median)
        this.step('new-root', () => `${median} sobe e forma uma nova raiz — altura aumenta`, [newRoot.id], median)
        break
      }

      const { node: parent, index } = parentEntry
      parent.keys.splice(index, 0, median)
      parent.children.splice(index + 1, 0, right)
      this.step('split', () => `Dividindo: ${fmt(node.keys)} | ${median} | ${fmt(right.keys)} — ${median} sobe para o pai`, [node.id, right.id, parent.id], median)
      node = parent
    }
    return true
  }

  insertMany (keys: Iterable<unknown>): BulkResult {
    const result: BulkResult = { inserted: [], duplicates: [], invalid: [] }
    for (const raw of keys) {
      if (!isValidKey(raw)) {
        result.invalid.push(raw)
        continue
      }
      if (this.insert(raw)) result.inserted.push(raw)
      else result.duplicates.push(raw)
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Remoção
  // ---------------------------------------------------------------------------

  /** Remove uma chave. Retorna `false` se a chave não existir. */
  delete (key: number): boolean {
    if (!isValidKey(key)) throw new TypeError(`Chave inválida: ${String(key)}`)
    if (!this.root) {
      this.step('not-found', () => `Árvore vazia — ${key} não encontrado`, [], key)
      return false
    }
    if (!this.deleteFrom(this.root, key)) return false
    this.count--

    const root = this.root
    if (root.keys.length === 0) {
      this.root = isLeaf(root) ? null : root.children[0]
      const newRoot = this.root
      this.step('shrink', () => newRoot
        ? 'Raiz ficou vazia — o filho vira a nova raiz (altura diminui)'
        : 'Árvore ficou vazia', newRoot ? [newRoot.id] : [], key)
    }
    return true
  }

  deleteMany (keys: Iterable<number>): number {
    let removed = 0
    for (const k of keys) {
      if (isValidKey(k) && this.delete(k)) removed++
    }
    return removed
  }

  private deleteFrom (node: BTreeNode, key: number): boolean {
    this.step('visit', () => `Visitando o nó ${fmt(node.keys)}`, [node.id], key)
    const i = lowerBound(node.keys, key)
    const found = i < node.keys.length && node.keys[i] === key

    if (isLeaf(node)) {
      if (!found) {
        this.step('not-found', () => `Chave ${key} não está na árvore`, [node.id], key)
        return false
      }
      node.keys.splice(i, 1)
      this.step('remove', () => `Removendo ${key} da folha → ${fmt(node.keys)}`, [node.id], key)
      return true
    }

    if (found) {
      // Substitui pela predecessora (maior chave da subárvore esquerda).
      let pred = node.children[i]
      while (!isLeaf(pred)) pred = pred.children[pred.children.length - 1]
      const predKey = pred.keys[pred.keys.length - 1]
      node.keys[i] = predKey
      const predNode = pred
      this.step('replace', () => `${key} está em nó interno: substituído pela predecessora ${predKey}`, [node.id, predNode.id], predKey)
      this.deleteFrom(node.children[i], predKey)
    } else if (!this.deleteFrom(node.children[i], key)) {
      return false
    }

    this.fixUnderflow(node, i)
    return true
  }

  /** Corrige o filho `index` de `parent` caso tenha ficado com poucas chaves. */
  private fixUnderflow (parent: BTreeNode, index: number): void {
    const child = parent.children[index]
    if (child.keys.length >= this.minKeys) return

    const left = index > 0 ? parent.children[index - 1] : null
    const right = index < parent.children.length - 1 ? parent.children[index + 1] : null

    if (left && left.keys.length > this.minKeys) {
      child.keys.unshift(parent.keys[index - 1])
      parent.keys[index - 1] = left.keys.pop()!
      if (!isLeaf(left)) child.children.unshift(left.children.pop()!)
      this.step('borrow', () => `Empréstimo do irmão esquerdo: ${parent.keys[index - 1]} sobe, nó fica ${fmt(child.keys)}`, [left.id, child.id, parent.id])
    } else if (right && right.keys.length > this.minKeys) {
      child.keys.push(parent.keys[index])
      parent.keys[index] = right.keys.shift()!
      if (!isLeaf(right)) child.children.push(right.children.shift()!)
      this.step('borrow', () => `Empréstimo do irmão direito: ${parent.keys[index]} sobe, nó fica ${fmt(child.keys)}`, [right.id, child.id, parent.id])
    } else if (left) {
      this.merge(parent, index - 1)
    } else if (right) {
      this.merge(parent, index)
    }
  }

  /** Funde `children[index + 1]` em `children[index]` descendo a chave separadora. */
  private merge (parent: BTreeNode, index: number): void {
    const left = parent.children[index]
    const right = parent.children[index + 1]
    const separator = parent.keys[index]
    left.keys.push(separator, ...right.keys)
    left.children.push(...right.children)
    parent.keys.splice(index, 1)
    parent.children.splice(index + 1, 1)
    this.step('merge', () => `Fusão: ${separator} desce e os irmãos se unem → ${fmt(left.keys)}`, [left.id, parent.id], separator)
  }

  // ---------------------------------------------------------------------------
  // Percursos e estatísticas
  // ---------------------------------------------------------------------------

  /** Chaves em ordem crescente. */
  inOrder (): number[] {
    const out: number[] = []
    const walk = (node: BTreeNode) => {
      if (isLeaf(node)) {
        for (const k of node.keys) out.push(k)
        return
      }
      for (let i = 0; i < node.keys.length; i++) {
        walk(node.children[i])
        out.push(node.keys[i])
      }
      walk(node.children[node.keys.length])
    }
    if (this.root) walk(this.root)
    return out
  }

  /** Nós (listas de chaves) em pré-ordem. */
  preOrder (): number[][] {
    const out: number[][] = []
    const walk = (node: BTreeNode) => {
      out.push(node.keys.slice())
      node.children.forEach(walk)
    }
    if (this.root) walk(this.root)
    return out
  }

  /** Nós agrupados por nível (largura). */
  levelOrder (): number[][][] {
    const levels: number[][][] = []
    let current = this.root ? [this.root] : []
    while (current.length > 0) {
      levels.push(current.map(n => n.keys.slice()))
      const next: BTreeNode[] = []
      for (const n of current) next.push(...n.children)
      current = next
    }
    return levels
  }

  height (): number {
    let h = 0
    let node = this.root
    while (node) {
      h++
      node = isLeaf(node) ? null : node.children[0]
    }
    return h
  }

  stats (): TreeStats {
    let nodes = 0
    let leaves = 0
    this.forEachNode(n => {
      nodes++
      if (isLeaf(n)) leaves++
    })
    return {
      size: this.count,
      nodes,
      leaves,
      height: this.height(),
      min: this.min(),
      max: this.max(),
      fill: nodes === 0 ? 0 : this.count / (nodes * this.maxKeys),
    }
  }

  /** Verifica todas as invariantes da Árvore B. Retorna a lista de erros. */
  validate (): string[] {
    const errors: string[] = []
    if (!this.root) {
      if (this.count !== 0) errors.push(`Contador de chaves (${this.count}) difere do real (0)`)
      return errors
    }
    let leafDepth = -1
    let total = 0
    const ids = new Set<number>()
    const check = (node: BTreeNode, lo: number, hi: number, depth: number, isRoot: boolean) => {
      const label = fmt(node.keys)
      if (ids.has(node.id)) errors.push(`Id de nó repetido: ${node.id}`)
      ids.add(node.id)
      total += node.keys.length
      if (node.keys.length > this.maxKeys) errors.push(`Nó ${label} tem chaves demais`)
      if (isRoot ? node.keys.length < 1 : node.keys.length < this.minKeys) {
        errors.push(`Nó ${label} tem chaves de menos`)
      }
      for (let i = 0; i < node.keys.length; i++) {
        const k = node.keys[i]
        if (i > 0 && node.keys[i - 1] >= k) errors.push(`Nó ${label} não está estritamente ordenado`)
        if (k <= lo || k >= hi) errors.push(`Chave ${k} fora do intervalo (${lo}, ${hi})`)
      }
      if (isLeaf(node)) {
        if (leafDepth === -1) leafDepth = depth
        else if (leafDepth !== depth) errors.push(`Folhas em profundidades diferentes (${leafDepth} e ${depth})`)
        return
      }
      if (node.children.length !== node.keys.length + 1) {
        errors.push(`Nó ${label} tem ${node.children.length} filhos, esperado ${node.keys.length + 1}`)
        return
      }
      node.children.forEach((child, i) => {
        const childLo = i === 0 ? lo : node.keys[i - 1]
        const childHi = i === node.keys.length ? hi : node.keys[i]
        check(child, childLo, childHi, depth + 1, false)
      })
    }
    check(this.root, -Infinity, Infinity, 0, true)
    if (total !== this.count) errors.push(`Contador de chaves (${this.count}) difere do real (${total})`)
    return errors
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private forEachNode (fn: (node: BTreeNode) => void): void {
    const stack = this.root ? [this.root] : []
    while (stack.length > 0) {
      const node = stack.pop()!
      fn(node)
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i])
    }
  }

  private createNode (keys: number[], children: BTreeNode[] = []): BTreeNode {
    return { id: this.nextId++, keys, children }
  }

  private step (kind: StepKind, message: () => string, nodeIds: number[], key?: number): void {
    if (this.onStep) this.onStep({ kind, message: message(), nodeIds, key })
  }
}
