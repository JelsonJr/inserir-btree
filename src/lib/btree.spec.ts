import { describe, expect, it } from 'vitest'
import { BTree, lowerBound, MAX_ORDER, MIN_ORDER, type TraceStep } from './btree'

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng (seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T> (items: T[], random: () => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('lowerBound', () => {
  it('encontra a posição de inserção', () => {
    expect(lowerBound([], 5)).toBe(0)
    expect(lowerBound([1, 3, 5], 0)).toBe(0)
    expect(lowerBound([1, 3, 5], 3)).toBe(1)
    expect(lowerBound([1, 3, 5], 4)).toBe(2)
    expect(lowerBound([1, 3, 5], 9)).toBe(3)
  })
})

describe('BTree', () => {
  it('rejeita ordens inválidas', () => {
    expect(() => new BTree(MIN_ORDER - 1)).toThrow(RangeError)
    expect(() => new BTree(MAX_ORDER + 1)).toThrow(RangeError)
    expect(() => new BTree(3.5)).toThrow(RangeError)
  })

  it('rejeita chaves inválidas', () => {
    const t = new BTree()
    expect(() => t.insert(Number.NaN)).toThrow(TypeError)
    expect(() => t.insert(Infinity)).toThrow(TypeError)
  })

  it('constrói a árvore 2-3 clássica', () => {
    const t = BTree.fromKeys(3, [10, 20, 30])
    expect(t.levelOrder()).toEqual([[[20]], [[10], [30]]])
    t.insertMany([40, 50])
    expect(t.levelOrder()).toEqual([[[20, 40]], [[10], [30], [50]]])
    t.insertMany([60, 70])
    expect(t.levelOrder()).toEqual([[[40]], [[20], [60]], [[10], [30], [50], [70]]])
    expect(t.validate()).toEqual([])
  })

  it('ignora duplicatas', () => {
    const t = new BTree()
    expect(t.insert(5)).toBe(true)
    expect(t.insert(5)).toBe(false)
    expect(t.size).toBe(1)
    const r = t.insertMany([1, 5, 'x', 2, 1])
    expect(r).toEqual({ inserted: [1, 2], duplicates: [5, 1], invalid: ['x'] })
  })

  it('aceita negativos e decimais', () => {
    const t = BTree.fromKeys(4, [0.5, -3, 2.25, -10, 7])
    expect(t.inOrder()).toEqual([-10, -3, 0.5, 2.25, 7])
    expect(t.min()).toBe(-10)
    expect(t.max()).toBe(7)
  })

  it('busca com caminho', () => {
    const t = BTree.fromKeys(3, range(20))
    const hit = t.search(13)
    expect(hit.found).toBe(true)
    expect(hit.path.length).toBeGreaterThan(0)
    expect(hit.path.length).toBeLessThanOrEqual(t.height())
    const miss = t.search(99)
    expect(miss.found).toBe(false)
    expect(miss.nodeId).toBeNull()
  })

  it('consulta por intervalo', () => {
    const t = BTree.fromKeys(5, shuffle(range(100), rng(7)))
    expect(t.range(10, 20)).toEqual(range(11).map(i => i + 9))
    expect(t.range(95, 1000)).toEqual([95, 96, 97, 98, 99, 100])
    expect(t.range(50, 10)).toEqual([])
  })

  it('remove de árvore vazia e chave inexistente', () => {
    const t = new BTree()
    expect(t.delete(1)).toBe(false)
    t.insertMany([1, 2, 3])
    expect(t.delete(4)).toBe(false)
    expect(t.size).toBe(3)
  })

  it('esvazia completamente', () => {
    const t = BTree.fromKeys(3, range(50))
    for (const k of range(50)) {
      expect(t.delete(k)).toBe(true)
      expect(t.validate()).toEqual([])
    }
    expect(t.isEmpty).toBe(true)
    expect(t.height()).toBe(0)
  })

  for (let order = MIN_ORDER; order <= MAX_ORDER; order++) {
    it(`mantém invariantes com operações aleatórias (ordem ${order})`, () => {
      const random = rng(order * 1000)
      const t = new BTree(order)
      const reference = new Set<number>()
      for (let i = 0; i < 3000; i++) {
        const key = Math.floor(random() * 400)
        if (random() < 0.6) {
          expect(t.insert(key)).toBe(!reference.has(key))
          reference.add(key)
        } else {
          expect(t.delete(key)).toBe(reference.has(key))
          reference.delete(key)
        }
        if (i % 50 === 0) expect(t.validate()).toEqual([])
      }
      expect(t.validate()).toEqual([])
      expect(t.inOrder()).toEqual([...reference].sort((a, b) => a - b))
      expect(t.size).toBe(reference.size)
      for (const k of reference) expect(t.has(k)).toBe(true)
    })
  }

  it('snapshot e restauração preservam estrutura e ids', () => {
    const t = BTree.fromKeys(4, shuffle(range(200), rng(3)))
    const snap = t.snapshot()
    const copy = BTree.fromSnapshot(JSON.parse(JSON.stringify(snap)))
    expect(copy.snapshot()).toEqual(snap)
    copy.insert(1000)
    expect(t.has(1000)).toBe(false)
  })

  it('rejeita snapshots inválidos', () => {
    expect(() => BTree.fromSnapshot({ order: 3, nextId: 1, root: { id: 1, keys: [3, 1], children: [] } })).toThrow()
    expect(() => BTree.fromSnapshot({ order: 3, nextId: 1, root: { id: 1, keys: [1, 2, 3], children: [] } })).toThrow()
    expect(() => BTree.fromSnapshot({ order: 99, nextId: 1, root: null })).toThrow()
  })

  it('emite passos de animação', () => {
    const t = BTree.fromKeys(3, [10, 20])
    const steps: TraceStep[] = []
    t.onStep = s => steps.push(s)
    t.insert(30)
    const kinds = steps.map(s => s.kind)
    expect(kinds).toEqual(['visit', 'insert', 'overflow', 'split', 'new-root'])
    steps.length = 0
    t.delete(10)
    expect(steps.some(s => s.kind === 'merge')).toBe(true)
    expect(steps.at(-1)?.kind).toBe('shrink')
  })

  it('tem bom desempenho com muitas chaves', () => {
    const keys = shuffle(range(100_000), rng(42))
    const t = new BTree(5)
    const start = performance.now()
    t.insertMany(keys)
    for (const k of keys) t.has(k)
    t.deleteMany(keys.slice(0, 50_000))
    const elapsed = performance.now() - start
    expect(t.size).toBe(50_000)
    expect(t.validate()).toEqual([])
    expect(elapsed).toBeLessThan(5000)
  })
})
