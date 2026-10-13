/**
 * lib/parse.ts
 *
 * Conversão de texto digitado pelo usuário em chaves numéricas.
 */

export interface ParsedKeys {
  keys: number[]
  invalid: string[]
}

/** Aceita números separados por vírgula, ponto e vírgula ou espaços. */
export function parseKeys (text: string): ParsedKeys {
  const keys: number[] = []
  const invalid: string[] = []
  for (const token of text.split(/[\s,;]+/)) {
    if (token === '') continue
    const value = Number(token)
    if (Number.isFinite(value)) keys.push(value)
    else invalid.push(token)
  }
  return { keys, invalid }
}

/** Converte um único valor digitado; retorna `null` se não for um número finito. */
export function parseKey (raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string' && raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/** Inteiros aleatórios distintos em [min, max] que não estejam em `exclude`. */
export function randomKeys (count: number, min: number, max: number, exclude: (k: number) => boolean): number[] {
  const lo = Math.ceil(Math.min(min, max))
  const hi = Math.floor(Math.max(min, max))
  const span = hi - lo + 1
  const out = new Set<number>()
  if (span <= 0 || count <= 0) return []
  // Se o intervalo for pequeno, sorteia a partir da lista de candidatos livres.
  if (span <= 50_000) {
    const free: number[] = []
    for (let k = lo; k <= hi; k++) if (!exclude(k)) free.push(k)
    for (let i = 0; i < count && free.length > 0; i++) {
      const j = Math.floor(Math.random() * free.length)
      out.add(free[j])
      free[j] = free[free.length - 1]
      free.pop()
    }
    return [...out]
  }
  let attempts = 0
  while (out.size < count && attempts < count * 20) {
    attempts++
    const k = lo + Math.floor(Math.random() * span)
    if (!exclude(k)) out.add(k)
  }
  return [...out]
}

/** Sequência aritmética de `from` até `to` (inclusive), limitada a `limit` itens. */
export function sequence (from: number, to: number, step: number, limit: number): number[] {
  const out: number[] = []
  const s = Math.abs(step) || 1
  const dir = to >= from ? 1 : -1
  for (let k = from; dir > 0 ? k <= to : k >= to; k += s * dir) {
    out.push(Number(k.toFixed(10)))
    if (out.length >= limit) break
  }
  return out
}
