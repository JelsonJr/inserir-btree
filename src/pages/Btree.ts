/* eslint-disable no-use-before-define */
export class TreeNode {
  values: number[] = []
  children: TreeNode[] = []

  constructor (value?: number) {
    if (value !== undefined) {
      this.values.push(value)
    }
  }

  isFull (): boolean {
    return this.values.length >= 3
  }
}

export class BTree {
  root: TreeNode | null = null

  insert (valueToInsert: string): void {
    const value = Number(valueToInsert)

    if (!this.root) {
      this.root = new TreeNode(value)
      return
    }

    this.root = this.insertNode(this.root, value)

    if (this.root.isFull()) {
      const newRoot = new TreeNode()
      newRoot.children.push(this.root)
      this.splitChild(newRoot, 0)
      this.root = newRoot
    }
  }

  private insertNode (node: TreeNode, value: number): TreeNode {
    if (node.children.length === 0) {
      node.values.push(value)
      node.values.sort((a, b) => a - b)
      return node
    }

    let i = 0
    while (i < node.values.length && value > node.values[i]) {
      i++
    }

    const child = node.children[i]
    node.children[i] = this.insertNode(child, value)

    if (node.children[i].isFull()) {
      this.splitChild(node, i)
    }

    return node
  }

  private splitChild (parent: TreeNode, index: number): void {
    const child = parent.children[index]
    const median = child.values[1]

    const leftChild = new TreeNode()
    const rightChild = new TreeNode()

    leftChild.values = [child.values[0]]
    rightChild.values = [child.values[2]]

    if (child.children.length > 0) {
      leftChild.children = child.children.slice(0, 2)
      rightChild.children = child.children.slice(2)
    }

    parent.values.splice(index, 0, median)

    parent.children.splice(index, 1, leftChild, rightChild)
  }

  toD3Format (node: TreeNode | null = this.root): any {
    if (!node) return null

    return {
      name: node.values.join(', '),
      children: node.children.map(child => this.toD3Format(child)),
    }
  }
}
