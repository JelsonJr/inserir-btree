<template>
  <div ref="container" class="tree-canvas">
    <svg ref="svgEl" :aria-label="ariaLabel" class="tree-svg" role="img">
      <g ref="layerEl">
        <g ref="linksEl" />
        <g ref="nodesEl" />
      </g>
    </svg>

    <div v-if="!snapshot.root" class="tree-overlay">
      <v-icon class="mb-3" color="primary" icon="mdi-file-tree-outline" size="72" />
      <div class="text-h6">Árvore vazia</div>
      <div class="text-body-2 text-medium-emphasis">
        Insira valores no painel ao lado ou gere chaves aleatórias.
      </div>
    </div>

    <div v-else-if="tooLarge" class="tree-overlay">
      <v-icon class="mb-3" color="warning" icon="mdi-alert-outline" size="64" />
      <div class="text-h6">Árvore grande demais para desenhar</div>
      <div class="text-body-2 text-medium-emphasis mb-4">
        {{ nodeCount.toLocaleString('pt-BR') }} nós — o desenho pode deixar o navegador lento.
      </div>
      <v-btn color="warning" prepend-icon="mdi-draw" variant="tonal" @click="forceRender = true">
        Desenhar mesmo assim
      </v-btn>
    </div>

    <div class="tree-toolbar">
      <v-btn-group density="comfortable" divided rounded="lg" variant="tonal">
        <v-btn aria-label="Aproximar" icon="mdi-plus" @click="zoomBy(1.3)" />
        <v-btn aria-label="Afastar" icon="mdi-minus" @click="zoomBy(1 / 1.3)" />
        <v-btn aria-label="Ajustar à tela" icon="mdi-fit-to-screen-outline" @click="fit(true)" />
      </v-btn-group>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import * as d3 from 'd3'
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import type { NodeSnapshot, StepKind, TreeSnapshot } from '@/lib/btree'
  import type { Highlight } from '@/stores/btree'
  import type { TreePalette } from './types'

  const props = defineProps<{
    snapshot: TreeSnapshot
    highlight: Highlight | null
    palette: TreePalette
    autoFit: boolean
  }>()

  const emit = defineEmits<{
    selectKey: [key: number]
  }>()

  const MIN_CELL = 40
  const CHAR_W = 8.2
  const NODE_H = 36
  const LEVEL_GAP = 100
  const SIBLING_GAP = 14
  const COUSIN_GAP = 30
  const RENDER_LIMIT = 2500
  const ANIMATION_LIMIT = 400
  const FONT = 'Roboto, system-ui, sans-serif'
  const MIN_SCALE = 0.002
  const READABLE_SCALE = 0.45

  type Point = d3.HierarchyPointNode<NodeSnapshot>
  interface Geometry { widths: number[], offsets: number[], total: number }

  const container = ref<HTMLDivElement>()
  const svgEl = ref<SVGSVGElement>()
  const layerEl = ref<SVGGElement>()
  const linksEl = ref<SVGGElement>()
  const nodesEl = ref<SVGGElement>()

  const forceRender = ref(false)
  const nodeCount = ref(0)
  const tooLarge = computed(() => nodeCount.value > RENDER_LIMIT && !forceRender.value)
  const ariaLabel = computed(() => props.snapshot.root
    ? `Árvore B de ordem ${props.snapshot.order} com ${nodeCount.value} nós`
    : 'Árvore B vazia')

  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
  let resizeObserver: ResizeObserver | null = null
  let bounds = { x0: 0, x1: 0, y0: 0, y1: 0 }
  let lastShape = ''
  const viewport = { width: 0, height: 0 }
  let frame = 0

  const formatKey = (k: number) => Number.isInteger(k) ? String(k) : String(Number(k.toFixed(4)))

  function geometryOf (keys: number[]): Geometry {
    const widths = keys.length === 0
      ? [MIN_CELL]
      : keys.map(k => Math.max(MIN_CELL, formatKey(k).length * CHAR_W + 18))
    const offsets: number[] = []
    let total = 0
    for (const w of widths) {
      offsets.push(total)
      total += w
    }
    return { widths, offsets, total }
  }

  function nodeColor (kind: StepKind | undefined): string {
    const p = props.palette
    switch (kind) {
      case 'visit': return p.info
      case 'found':
      case 'insert': return p.success
      case 'overflow':
      case 'not-found': return p.error
      case 'duplicate': return p.warning
      default: return p.primary
    }
  }

  function render () {
    frame = 0
    const svg = svgEl.value
    if (!svg || !linksEl.value || !nodesEl.value) return
    const links = d3.select(linksEl.value)
    const nodes = d3.select(nodesEl.value)
    const data = props.snapshot.root

    if (!data) {
      nodeCount.value = 0
      links.selectAll('*').remove()
      nodes.selectAll('*').remove()
      lastShape = ''
      return
    }

    const root = d3.hierarchy<NodeSnapshot>(data, d => d.children.length > 0 ? d.children : null)
    const descendants = root.descendants()
    nodeCount.value = descendants.length
    if (tooLarge.value) {
      links.selectAll('*').remove()
      nodes.selectAll('*').remove()
      return
    }

    const geo = new Map<number, Geometry>()
    for (const d of descendants) geo.set(d.data.id, geometryOf(d.data.keys))
    const widthOf = (d: d3.HierarchyNode<NodeSnapshot>) => geo.get(d.data.id)!.total

    const layout = d3.tree<NodeSnapshot>()
      .nodeSize([1, LEVEL_GAP])
      .separation((a, b) => (widthOf(a) + widthOf(b)) / 2 + (a.parent === b.parent ? SIBLING_GAP : COUSIN_GAP))
    const laidOut = layout(root)
    const points = laidOut.descendants()

    bounds = { x0: Infinity, x1: -Infinity, y0: -NODE_H / 2, y1: -Infinity }
    for (const d of points) {
      const half = widthOf(d) / 2
      bounds.x0 = Math.min(bounds.x0, d.x - half)
      bounds.x1 = Math.max(bounds.x1, d.x + half)
      bounds.y1 = Math.max(bounds.y1, d.y + NODE_H / 2)
    }

    const p = props.palette
    const hl = props.highlight
    const hlIds = new Set(hl?.nodeIds ?? [])
    const maxKeys = props.snapshot.order - 1
    // Árvores grandes são desenhadas sem transições: agendar milhares de
    // transições custa mais do que o próprio desenho.
    const t = points.length > ANIMATION_LIMIT ? null : d3.transition().duration(420).ease(d3.easeCubicOut)
    if (!t) {
      links.selectAll('path.link').interrupt()
      nodes.selectAll('g.node').interrupt()
    }

    // ---- Arestas ---------------------------------------------------------
    const linkPath = (d: Point) => {
      const parent = d.parent!
      const g = geo.get(parent.data.id)!
      const index = parent.data.children.indexOf(d.data)
      const anchor = index < g.offsets.length ? g.offsets[index] : g.total
      const sx = parent.x - g.total / 2 + anchor
      const sy = parent.y + NODE_H / 2
      const tx = d.x
      const ty = d.y - NODE_H / 2
      const my = (sy + ty) / 2
      return `M${sx},${sy}C${sx},${my} ${tx},${my} ${tx},${ty}`
    }

    const linkStroke = (d: Point) => hlIds.has(d.data.id) && hlIds.has(d.parent!.data.id) ? nodeColor(hl?.kind) : p.link
    const linkSel = links.selectAll<SVGPathElement, Point>('path.link')
      .data(points.filter(d => d.parent), d => String(d.data.id))
      .join(
        enter => enter.append('path')
          .attr('class', 'link')
          .attr('fill', 'none')
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round')
          .attr('d', linkPath)
          .attr('opacity', 0),
        update => update,
        exit => t ? exit.transition(t).attr('opacity', 0).remove() : exit.remove(),
      )
    if (t) linkSel.transition(t).attr('d', linkPath).attr('opacity', 1).attr('stroke', linkStroke)
    else linkSel.attr('d', linkPath).attr('opacity', 1).attr('stroke', linkStroke)

    // ---- Nós -------------------------------------------------------------
    // Em árvores grandes ("modo leve") cada nó vira apenas um retângulo e um
    // texto, reduzindo drasticamente a quantidade de elementos SVG.
    const lite = t === null
    const groups = nodes.selectAll<SVGGElement, Point>('g.node')
      .data(points, d => String(d.data.id))
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'node')
            .attr('opacity', 0)
            .attr('transform', d => `translate(${d.parent?.x ?? d.x},${d.parent?.y ?? d.y})`)
          g.append('rect').attr('class', 'box').attr('rx', 10).attr('y', -NODE_H / 2).attr('height', NODE_H)
          g.append('g').attr('class', 'cells')
          return g
        },
        update => update,
        exit => t ? exit.transition(t).attr('opacity', 0).remove() : exit.remove(),
      )

    const place = (d: Point) => `translate(${d.x},${d.y})`
    if (t) groups.transition(t).attr('opacity', 1).attr('transform', place)
    else groups.attr('opacity', 1).attr('transform', place)

    groups.each(function (d) {
      const g = d3.select(this)
      const { widths, offsets, total } = geo.get(d.data.id)!
      const overflow = d.data.keys.length > maxKeys
      const active = hlIds.has(d.data.id)
      const color = overflow ? p.error : active ? nodeColor(hl?.kind) : p.border
      const x0 = -total / 2

      g.selectAll('rect.shadow')
        .data(lite ? [] : [d])
        .join(enter => enter.insert('rect', 'rect.box')
          .attr('class', 'shadow')
          .attr('y', -NODE_H / 2 + 3)
          .attr('height', NODE_H)
          .attr('rx', 10)
          .attr('fill', '#000')
          .attr('opacity', 0.12))
        .attr('x', x0)
        .attr('width', total)

      g.selectAll('title')
        .data(lite ? [] : [d])
        .join('title')
        .text(`Nó #${d.data.id} — ${d.data.keys.length} chave(s)${d.children ? `, ${d.children.length} filho(s)` : ' (folha)'}`)

      g.select('rect.box')
        .attr('x', x0)
        .attr('width', total)
        .attr('fill', p.surface)
        .attr('stroke', color)
        .attr('stroke-width', active || overflow ? 3 : 1.5)

      const cellsLayer = g.select<SVGGElement>('g.cells')

      if (lite) {
        cellsLayer.selectAll('g.cell').remove()
        cellsLayer.selectAll('text.lite')
          .data([d])
          .join(enter => enter.append('text')
            .attr('class', 'lite')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('font-family', FONT)
            .attr('font-size', 15)
            .attr('font-weight', 500))
          .attr('fill', p.text)
          .text(d.data.keys.map(formatKey).join('  ·  '))
        return
      }

      cellsLayer.selectAll('text.lite').remove()
      cellsLayer
        .selectAll<SVGGElement, number>('g.cell')
        .data(d.data.keys)
        .join(enter => {
          const c = enter.append('g').attr('class', 'cell').style('cursor', 'pointer')
          c.append('rect').attr('class', 'cell-bg')
          c.append('line').attr('class', 'sep')
          c.append('text').attr('class', 'key')
          return c
        })
        .each(function (key, i) {
          const c = d3.select(this)
          const isKey = active && hl?.key === key
          c.select('rect.cell-bg')
            .attr('x', x0 + offsets[i] + 3)
            .attr('y', -NODE_H / 2 + 3)
            .attr('width', widths[i] - 6)
            .attr('height', NODE_H - 6)
            .attr('rx', 7)
            .attr('fill', isKey ? nodeColor(hl?.kind) : 'transparent')
          c.select('line.sep')
            .attr('x1', x0 + offsets[i])
            .attr('x2', x0 + offsets[i])
            .attr('y1', -NODE_H / 2 + 7)
            .attr('y2', NODE_H / 2 - 7)
            .attr('stroke', p.muted)
            .attr('stroke-width', 1)
            .attr('opacity', i === 0 ? 0 : 0.5)
          c.select('text.key')
            .attr('x', x0 + offsets[i] + widths[i] / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('font-family', FONT)
            .attr('font-size', 15)
            .attr('font-weight', isKey ? 700 : 500)
            .attr('fill', isKey ? p.background : p.text)
            .text(formatKey(key))
        })
    })

    // Reajusta o zoom apenas quando a forma da árvore muda.
    const shape = `${Math.round(bounds.x0)}:${Math.round(bounds.x1)}:${Math.round(bounds.y1)}`
    if (props.autoFit && shape !== lastShape) fit(t !== null, true)
    lastShape = shape
  }

  function scheduleRender () {
    if (frame) return
    frame = requestAnimationFrame(render)
  }

  /**
   * Enquadra a árvore. Com `readable`, árvores muito largas não são reduzidas
   * abaixo de uma escala legível: a vista foca a raiz e o usuário arrasta
   * para explorar o restante.
   */
  function fit (animated = true, readable = false) {
    const svg = svgEl.value
    if (!svg || !zoomBehavior || !props.snapshot.root) return
    // Usa o tamanho em cache (ResizeObserver): ler clientWidth logo após
    // alterar o DOM forçaria um layout síncrono caro em árvores grandes.
    const { width, height } = viewport
    if (width === 0 || height === 0) return
    const pad = 48
    const bw = Math.max(1, bounds.x1 - bounds.x0)
    const bh = Math.max(1, bounds.y1 - bounds.y0)
    let scale = Math.max(MIN_SCALE, Math.min((width - pad * 2) / bw, (height - pad * 2) / bh, 1.5))
    let cx = (bounds.x0 + bounds.x1) / 2
    let cy = (bounds.y0 + bounds.y1) / 2
    if (readable && scale < READABLE_SCALE) {
      scale = READABLE_SCALE
      cx = 0 // a raiz fica em x = 0 no layout
      cy = bounds.y0 + (height / 2 - pad) / scale
    }
    const transform = d3.zoomIdentity.translate(width / 2 - cx * scale, height / 2 - cy * scale).scale(scale)
    const sel = d3.select(svg)
    if (animated) sel.transition().duration(450).call(zoomBehavior.transform, transform)
    else sel.call(zoomBehavior.transform, transform)
  }

  function zoomBy (factor: number) {
    if (!svgEl.value || !zoomBehavior) return
    d3.select(svgEl.value).transition().duration(250).call(zoomBehavior.scaleBy, factor)
  }

  // ---- Exportação --------------------------------------------------------

  function buildStandaloneSvg (): { markup: string, width: number, height: number } | null {
    if (!svgEl.value || !layerEl.value || !props.snapshot.root) return null
    const pad = 32
    const width = Math.ceil(bounds.x1 - bounds.x0 + pad * 2)
    const height = Math.ceil(bounds.y1 - bounds.y0 + pad * 2)
    const clone = layerEl.value.cloneNode(true) as SVGGElement
    clone.setAttribute('transform', `translate(${pad - bounds.x0},${pad - bounds.y0})`)
    const ns = 'http://www.w3.org/2000/svg'
    const out = document.createElementNS(ns, 'svg')
    out.setAttribute('xmlns', ns)
    out.setAttribute('width', String(width))
    out.setAttribute('height', String(height))
    out.setAttribute('viewBox', `0 0 ${width} ${height}`)
    const bg = document.createElementNS(ns, 'rect')
    bg.setAttribute('width', '100%')
    bg.setAttribute('height', '100%')
    bg.setAttribute('fill', props.palette.background)
    out.append(bg, clone)
    return { markup: new XMLSerializer().serializeToString(out), width, height }
  }

  function exportSvg (): string | null {
    return buildStandaloneSvg()?.markup ?? null
  }

  function exportPng (scale = 2): Promise<Blob | null> {
    const built = buildStandaloneSvg()
    if (!built) return Promise.resolve(null)
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(new Blob([built.markup], { type: 'image/svg+xml' }))
      img.onload = () => {
        // Navegadores limitam o tamanho do canvas; reduz a escala se necessário.
        const maxSide = 16_000
        const s = Math.min(scale, maxSide / built.width, maxSide / built.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(built.width * s))
        canvas.height = Math.max(1, Math.floor(built.height * s))
        const ctx = canvas.getContext('2d')
        URL.revokeObjectURL(url)
        if (!ctx) return resolve(null)
        ctx.scale(s, s)
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(blob => resolve(blob), 'image/png')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    })
  }

  defineExpose({ fit, zoomBy, exportSvg, exportPng })

  // ---- Ciclo de vida -----------------------------------------------------

  onMounted(() => {
    if (!svgEl.value || !layerEl.value) return
    const layer = d3.select(layerEl.value)
    zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, 4])
      // Extensão fixa (em cache) evita que o d3 meça o SVG a cada zoom.
      .extent((): [[number, number], [number, number]] => [[0, 0], [viewport.width || 1, viewport.height || 1]])
      .on('zoom', event => layer.attr('transform', event.transform.toString()))
    d3.select(svgEl.value).call(zoomBehavior).on('dblclick.zoom', null)

    if (container.value) {
      viewport.width = container.value.clientWidth
      viewport.height = container.value.clientHeight
    }
    resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      viewport.width = rect.width
      viewport.height = rect.height
      if (props.autoFit) fit(false, true)
    })
    if (container.value) resizeObserver.observe(container.value)

    // Delegação de eventos: um único ouvinte para todas as chaves.
    d3.select(nodesEl.value!).on('click', (event: MouseEvent) => {
      const cell = (event.target as Element).closest('g.cell') as (Element & { __data__?: number }) | null
      if (cell && typeof cell.__data__ === 'number') emit('selectKey', cell.__data__)
    })

    render()
    fit(false, true)
  })

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    resizeObserver?.disconnect()
    if (svgEl.value) d3.select(svgEl.value).on('.zoom', null).interrupt()
  })

  watch(() => [props.snapshot, props.highlight, props.palette, forceRender.value], scheduleRender)
  watch(() => props.snapshot.order, () => {
    forceRender.value = false
  })
  watch(() => props.autoFit, enabled => {
    if (enabled) fit(true)
  })
</script>

<style scoped>
.tree-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  border-radius: inherit;
  background-image: radial-gradient(rgba(var(--v-theme-on-surface), 0.08) 1px, transparent 1px);
  background-size: 22px 22px;
  background-repeat: repeat;
}

.tree-svg {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.tree-svg:active {
  cursor: grabbing;
}

.tree-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  pointer-events: none;
}

.tree-overlay :deep(.v-btn) {
  pointer-events: auto;
}

.tree-toolbar {
  position: absolute;
  right: 12px;
  bottom: 12px;
}
</style>
