import { describe, expect, it } from 'vitest'
import { parseKey, parseKeys, randomKeys, sequence } from './parse'

describe('parseKeys', () => {
  it('separa por vírgula, ponto e vírgula e espaços', () => {
    expect(parseKeys(' 1, 2;3\n4  -5 2.5 ')).toEqual({ keys: [1, 2, 3, 4, -5, 2.5], invalid: [] })
  })

  it('reporta tokens inválidos', () => {
    expect(parseKeys('1 abc 2 NaN')).toEqual({ keys: [1, 2], invalid: ['abc', 'NaN'] })
  })
})

describe('parseKey', () => {
  it('converte apenas números finitos', () => {
    expect(parseKey('42')).toBe(42)
    expect(parseKey(7)).toBe(7)
    expect(parseKey('')).toBeNull()
    expect(parseKey('  ')).toBeNull()
    expect(parseKey(null)).toBeNull()
    expect(parseKey('x')).toBeNull()
    expect(parseKey(Infinity)).toBeNull()
  })
})

describe('randomKeys', () => {
  it('gera chaves distintas no intervalo, evitando as existentes', () => {
    const keys = randomKeys(50, 1, 60, k => k % 2 === 0)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(30)
    for (const k of keys) {
      expect(k % 2).toBe(1)
      expect(k).toBeGreaterThanOrEqual(1)
      expect(k).toBeLessThanOrEqual(60)
    }
  })

  it('funciona com intervalos enormes', () => {
    const keys = randomKeys(1000, 0, 1e12, () => false)
    expect(new Set(keys).size).toBe(1000)
  })
})

describe('sequence', () => {
  it('gera sequências crescentes, decrescentes e limitadas', () => {
    expect(sequence(1, 5, 1, 100)).toEqual([1, 2, 3, 4, 5])
    expect(sequence(10, 0, 5, 100)).toEqual([10, 5, 0])
    expect(sequence(0, 1, 0.1, 100)).toHaveLength(11)
    expect(sequence(1, 1e9, 1, 10)).toHaveLength(10)
    expect(sequence(1, 3, 0, 100)).toEqual([1, 2, 3])
  })
})
