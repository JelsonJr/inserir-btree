import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBTreeStore } from './btree'

describe('useBTreeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function freshStore () {
    const store = useBTreeStore()
    store.animate = false
    return store
  }

  it('insere, rejeita duplicatas e entradas inválidas', () => {
    const store = freshStore()
    expect(store.insert('10')).toBe(true)
    expect(store.insert(10)).toBe(false)
    expect(store.insert('abc')).toBe(false)
    expect(store.stats.size).toBe(1)
    expect(store.log[0].level).toBe('warning')
  })

  it('desfaz e refaz operações', () => {
    const store = freshStore()
    store.insertText('1 2 3 4 5')
    store.remove(3)
    expect(store.inOrder).toEqual([1, 2, 4, 5])
    store.undo()
    expect(store.inOrder).toEqual([1, 2, 3, 4, 5])
    store.undo()
    expect(store.inOrder).toEqual([])
    expect(store.canUndo).toBe(false)
    store.redo()
    store.redo()
    expect(store.inOrder).toEqual([1, 2, 4, 5])
    expect(store.canRedo).toBe(false)
  })

  it('muda a ordem preservando as chaves', () => {
    const store = freshStore()
    store.insertSequence(1, 100, 1)
    const heightOrder3 = store.stats.height
    store.setOrder(7)
    expect(store.order).toBe(7)
    expect(store.inOrder).toHaveLength(100)
    expect(store.stats.height).toBeLessThan(heightOrder3)
    expect(store.validationErrors).toEqual([])
    store.undo()
    expect(store.order).toBe(3)
  })

  it('exporta e importa JSON', () => {
    const store = freshStore()
    store.insertRandom(200, 1, 10_000)
    const json = store.exportJson()
    const keys = [...store.inOrder]
    store.clear()
    expect(store.stats.size).toBe(0)
    expect(store.importJson(json)).toBe(true)
    expect(store.inOrder).toEqual(keys)
    expect(store.importJson('[5, 1, 3]')).toBe(true)
    expect(store.inOrder).toEqual([1, 3, 5])
    expect(store.importJson('{"keys": [9, 8], "order": 4}')).toBe(true)
    expect(store.order).toBe(4)
    expect(store.importJson('não é json')).toBe(false)
    expect(store.importJson('{"order":3,"nextId":1,"root":{"id":1,"keys":[2,1],"children":[]}}')).toBe(false)
    expect(store.inOrder).toEqual([8, 9])
  })

  it('grava passos de animação para operações individuais', () => {
    const store = useBTreeStore()
    store.animate = true
    store.insertText('10 20')
    store.insert(30)
    expect(store.steps.length).toBeGreaterThan(0)
    expect(store.steps.some(s => s.kind === 'split')).toBe(true)
    store.skipPlayback()
    expect(store.stepIndex).toBe(-1)
    expect(store.highlight?.key).toBe(30)
  })

  it('remove chaves aleatórias', () => {
    const store = freshStore()
    store.insertSequence(1, 50, 1)
    store.removeRandom(20)
    expect(store.stats.size).toBe(30)
    expect(store.validationErrors).toEqual([])
  })
})
