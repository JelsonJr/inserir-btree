<template>
  <div ref="container" class="tree-canvas">
    <svg ref="svgEl" :aria-label="ariaLabel" class="tree-svg" role="img">
      <g ref="layerEl">
        <g ref="linksEl" />
        <g ref="nodesEl" />
      </g>
    </svg>

    <div v-if="!snapshot.root" class="tree-overlay">
      <v-icon class="mb-3" color="primary" icon="mdi-file-tree-outline" size="64" />
      <div class="text-h6">Árvore vazia</div>
      <div class="text-body-2 text-medium-emphasis">
        Digite um valor e pressione Enter, ou use um dos exemplos.
      </div>
    </div>

    <div v-else-if="tooLarge" class="tree-overlay">
      <v-icon class="mb-3" color="warning" icon="mdi-alert-outline" size="56" />
      <div class="text-h6">Árvore grande demais para desenhar</div>
      <div class="text-body-2 text-medium-emphasis mb-4">
        {{ nodeCount.toLocaleString('pt-BR') }} nós — o desenho pode deixar o navegador lento.
      </div>
      <v-btn color="warning" prepend-icon="mdi-draw" variant="tonal" @click="forceRender = true">
        Desenhar mesmo assim
      </v-btn>
    </div>

    <v-sheet border class="tree-toolbar d-flex flex-column" elevation="2" rounded="lg">
      <v-btn aria-label="Aproximar" density="comfortable" icon="mdi-plus" rounded="0" size="small" title="Aproximar" variant="text" @click="zoomBy(1.3)" />
      <v-divider />
      <v-btn aria-label="Afastar" density="comfortable" icon="mdi-minus" rounded="0" size="small" title="Afastar" variant="text" @click="zoomBy(1 / 1.3)" />
      <v-divider />
      <v-btn aria-label="Ajustar à tela" density="comfortable" icon="mdi-fit-to-screen-outline" rounded="0" size="small" title="Ajustar à tela (F)" variant="text" @click="fit(true)" />
    </v-sheet>

    <div class="tree-bottom">
      <slot name="bottom" />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import type { NodeSnapshot, StepKind, TreeSnapshot } from '@/lib/btree'
  import type { Highlight } from '@/stores/btree'
  import type { TreePalette } from './types'
  import * as d3 from 'd3'
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

  const props = defineProps<{
    snapshot: TreeSnapshot
    highlight: Highlight | null
    palette: TreePalette
    autoFit: boolean
    /** Duração das transições, em milissegundos. */
    duration: number
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
  interface Placed { x: number, y: number }

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
  let reducedMotion: MediaQueryList | null = null
  let bounds = { x0: 0, x1: 0, y0: 0, y1: 0 }
  let lastShape = ''
  let frame = 0
  const viewport = { width: 0, height: 0 }

  /** Posições do desenho anterior, usadas para animar de onde cada nó "veio". */
  let previous = new Map<number, Placed>()
  /** Vizinho (irmão ou pai) de cada nó no desenho anterior: destino de nós que somem. */
  let previousNeighbor = new Map<number, number>()

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

  function kindColor (kind: StepKind | undefined): string {
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

  function effectiveDuration (count: number): number {
    if (count > ANIMATION_LIMIT || reducedMotion?.matches) return 0
    return Math.max(0, props.duration)
  }

  /** Posição inicial de um nó que acabou de surgir. */
  function originOf (d: Point): Placed {
    const siblings = d.parent?.children ?? []
    const index = siblings.indexOf(d)
    // Nó criado por divisão: nasce da posição do irmão de onde saiu.
    for (let j = index - 1; j >= 0; j--) {
      const pos = previous.get(siblings[j].data.id)
      if (pos) return pos
    }
    for (let j = index + 1; j < siblings.length; j++) {
      const pos = previous.get(siblings[j].data.id)
      if (pos) return pos
    }
    if (d.parent) {
      const pos = previous.get(d.parent.data.id)
      if (pos) return { x: pos.x, y: pos.y + LEVEL_GAP }
    }
    // Nova raiz: surge logo acima da raiz antiga.
    const child = d.children?.find(c => previous.has(c.data.id))
    if (child) {
      const pos = previous.get(child.data.id)!
      return { x: pos.x, y: pos.y - LEVEL_GAP }
    }
    return { x: d.x, y: d.y }
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
      links.selectAll('*').interrupt('tree').remove()
      nodes.selectAll('*').interrupt('tree').remove()
      previous = new Map()
      previousNeighbor = new Map()
      lastShape = ''
      return
    }

    const root = d3.hierarchy<NodeSnapshot>(data, d => d.children.length > 0 ? d.children : null)
    const descendants = root.descendants()
    nodeCount.value = descendants.length
    if (tooLarge.value) {
      links.selectAll('*').remove()
      nodes.selectAll('*').remove()
      previous = new Map()
      return
    }

    const geo = new Map<number, Geometry>()
    for (const d of descendants) geo.set(d.data.id, geometryOf(d.data.keys))
    const widthOf = (d: d3.HierarchyNode<NodeSnapshot>) => geo.get(d.data.id)!.total

    const points = d3.tree<NodeSnapshot>()
      .nodeSize([1, LEVEL_GAP])
      .separation((a, b) => (widthOf(a) + widthOf(b)) / 2 + (a.parent === b.parent ? SIBLING_GAP : COUSIN_GAP))(root)
      .descendants()
    const byId = new Map(points.map(d => [d.data.id, d]))

    bounds = { x0: Infinity, x1: -Infinity, y0: -NODE_H / 2, y1: -Infinity }
    for (const d of points) {
      const half = widthOf(d) / 2
      bounds.x0 = Math.min(bounds.x0, d.x - half)
      bounds.x1 = Math.max(bounds.x1, d.x + half)
      bounds.y1 = Math.max(bounds.y1, d.y + NODE_H / 2)
    }

    const p = props.palette
    const hl = props.highlight
    const active = new Set(hl?.nodeIds ?? [])
    const trail = new Set(hl?.trail ?? [])
    const lit = (id: number) => active.has(id) || trail.has(id)
    const activeColor = kindColor(hl?.kind)
    const maxKeys = props.snapshot.order - 1
    const duration = effectiveDuration(points.length)
    const lite = points.length > ANIMATION_LIMIT
    const t = duration > 0
      ? d3.transition('tree').duration(duration).ease(d3.easeCubicInOut)
      : null
    if (!t) {
      links.selectAll('path.link').interrupt('tree')
      nodes.selectAll('*').interrupt('tree')
    }

    // ---- Arestas ---------------------------------------------------------
    const curve = (sx: number, sy: number, tx: number, ty: number) => {
      const my = (sy + ty) / 2
      return `M${sx},${sy}C${sx},${my} ${tx},${my} ${tx},${ty}`
    }
    const linkPath = (d: Point) => {
      const parent = d.parent!
      const g = geo.get(parent.data.id)!
      const index = parent.children!.indexOf(d)
      const offset = index < g.offsets.length ? g.offsets[index] : g.total
      return curve(parent.x - g.total / 2 + offset, parent.y + NODE_H / 2, d.x, d.y - NODE_H / 2)
    }
    const linkFrom = (d: Point) => {
      const o = previous.get(d.data.id) ?? originOf(d)
      return curve(o.x, o.y - NODE_H / 2, o.x, o.y - NODE_H / 2)
    }
    const linkColor = (d: Point) => {
      if (!lit(d.data.id) || !lit(d.parent!.data.id)) return p.link
      return active.has(d.data.id) ? activeColor : p.info
    }
    const linkWidth = (d: Point) => lit(d.data.id) && lit(d.parent!.data.id) ? 3 : 2

    const linkSel = links.selectAll<SVGPathElement, Point>('path.link')
      .data(points.filter(d => d.parent), d => String(d.data.id))
      .join(
        enter => enter.append('path')
          .attr('class', 'link')
          .attr('fill', 'none')
          .attr('stroke-linecap', 'round')
          .attr('stroke', p.link)
          .attr('stroke-width', 2)
          .attr('d', t ? linkFrom : linkPath)
          .attr('opacity', t ? 0 : 1),
        update => update,
        exit => t ? exit.transition(t).attr('opacity', 0).remove() : exit.remove(),
      )
    if (t) {
      linkSel.transition(t)
        .attr('d', linkPath)
        .attr('opacity', 1)
        .attr('stroke', linkColor)
        .attr('stroke-width', linkWidth)
    } else {
      linkSel.attr('d', linkPath).attr('opacity', 1).attr('stroke', linkColor).attr('stroke-width', linkWidth)
    }

    // ---- Nós -------------------------------------------------------------
    const place = (d: Placed, scale = 1) => `translate(${d.x},${d.y}) scale(${scale})`

    const groups = nodes.selectAll<SVGGElement, Point>('g.node')
      .data(points, d => String(d.data.id))
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'node')
            .attr('opacity', t ? 0 : 1)
            .attr('transform', d => t ? place(originOf(d), 0.75) : place(d))
          g.append('rect').attr('class', 'pulse').attr('rx', 13).attr('fill', 'none').attr('stroke-width', 2)
          g.append('rect').attr('class', 'box').attr('rx', 10).attr('y', -NODE_H / 2).attr('height', NODE_H)
          g.append('g').attr('class', 'cells')
          return g
        },
        update => update,
        exit => {
          if (!t) return exit.remove()
          // Nós que somem (fusão) deslizam até o vizinho com que se uniram.
          return exit.transition(t)
            .attr('opacity', 0)
            .attr('transform', d => {
              const neighbor = byId.get(previousNeighbor.get(d.data.id) ?? -1)
              return place(neighbor ?? previous.get(d.data.id) ?? d, 0.75)
            })
            .remove()
        },
      )

    if (t) groups.transition(t).attr('opacity', 1).attr('transform', d => place(d))
    else groups.attr('opacity', 1).attr('transform', d => place(d))

    groups.each(function (d) {
      const g = d3.select(this)
      const { widths, offsets, total } = geo.get(d.data.id)!
      const overflow = d.data.keys.length > maxKeys
      const isActive = active.has(d.data.id)
      const inTrail = !isActive && trail.has(d.data.id)
      const stroke = overflow ? p.error : isActive ? activeColor : inTrail ? p.info : p.border
      const x0 = -total / 2

      g.selectAll('rect.shadow')
        .data(lite ? [] : [d])
        .join(enter => enter.insert('rect', 'rect.box')
          .attr('class', 'shadow')
          .attr('y', -NODE_H / 2 + 3)
          .attr('height', NODE_H)
          .attr('rx', 10)
          .attr('fill', '#000')
          .attr('opacity', 0.1))
        .attr('x', x0)
        .attr('width', total)

      g.selectAll('title')
        .data(lite ? [] : [d])
        .join('title')
        .text(`Nó #${d.data.id} — ${d.data.keys.length} chave(s)${d.children ? `, ${d.children.length} filho(s)` : ' (folha)'}`)

      const box = g.select<SVGRectElement>('rect.box')
        .attr('fill', p.surface)
        .attr('stroke-dasharray', inTrail ? '5 4' : null)
      if (box.attr('width') === null) box.attr('x', x0).attr('width', total)
      if (t) {
        box.transition(t)
          .attr('x', x0)
          .attr('width', total)
          .attr('stroke', stroke)
          .attr('stroke-width', isActive || overflow ? 3 : (inTrail ? 2 : 1.5))
      } else {
        box.attr('x', x0)
          .attr('width', total)
          .attr('stroke', stroke)
          .attr('stroke-width', isActive || overflow ? 3 : (inTrail ? 2 : 1.5))
      }

      // Anel pulsante no nó em destaque.
      g.select('rect.pulse')
        .classed('pulsing', (isActive || overflow) && !lite)
        .attr('x', x0 - 5)
        .attr('y', -NODE_H / 2 - 5)
        .attr('width', total + 10)
        .attr('height', NODE_H + 10)
        .attr('stroke', stroke)

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
      const cellTransform = (_k: number, i: number) => `translate(${x0 + offsets[i] + widths[i] / 2},0)`

      // Células identificadas pela chave: ao inserir, as vizinhas deslizam para abrir espaço.
      const cells = cellsLayer
        .selectAll<SVGGElement, number>('g.cell')
        .data(d.data.keys, k => String(k))
        .join(
          enter => {
            const c = enter.append('g')
              .attr('class', 'cell')
              .style('cursor', 'pointer')
              .attr('transform', cellTransform)
              .attr('opacity', t ? 0 : 1)
            c.append('rect').attr('class', 'cell-bg').attr('rx', 7).attr('y', -NODE_H / 2 + 3).attr('height', NODE_H - 6)
            c.append('line').attr('class', 'sep').attr('y1', -NODE_H / 2 + 7).attr('y2', NODE_H / 2 - 7).attr('stroke-width', 1)
            c.append('text').attr('class', 'key')
              .attr('dy', '0.35em')
              .attr('text-anchor', 'middle')
              .attr('font-family', FONT)
              .attr('font-size', 15)
            return c
          },
          update => update,
          exit => exit.remove(),
        )

      if (t) cells.transition(t).attr('opacity', 1).attr('transform', cellTransform)
      else cells.attr('opacity', 1).attr('transform', cellTransform)

      cells.each(function (key, i) {
        const c = d3.select(this)
        const isKey = isActive && hl?.key === key
        const w = widths[i]
        c.select('rect.cell-bg')
          .attr('x', -w / 2 + 3)
          .attr('width', w - 6)
          .attr('fill', isKey ? activeColor : 'transparent')
        c.select('line.sep')
          .attr('x1', -w / 2)
          .attr('x2', -w / 2)
          .attr('stroke', p.muted)
          .attr('opacity', i === 0 ? 0 : 0.5)
        c.select('text.key')
          .attr('font-weight', isKey ? 700 : 500)
          .attr('fill', isKey ? p.background : p.text)
          .text(formatKey(key))
      })
    })

    // Guarda posições e vizinhos para animar o próximo desenho.
    previous = new Map(points.map(d => [d.data.id, { x: d.x, y: d.y }]))
    previousNeighbor = new Map()
    for (const d of points) {
      const siblings = d.parent?.children ?? []
      const index = siblings.indexOf(d)
      const neighbor = index > 0 ? siblings[index - 1] : (siblings[1] ?? d.parent)
      if (neighbor) previousNeighbor.set(d.data.id, neighbor.data.id)
    }

    // A câmera só se move quando a forma da árvore muda ou quando o nó em
    // destaque sai da área visível.
    const shape = `${Math.round(bounds.x0)}:${Math.round(bounds.x1)}:${Math.round(bounds.y1)}`
    const moved = props.autoFit && shape !== lastShape && follow(duration)
    lastShape = shape
    if (props.autoFit && !moved) {
      const focus = points.find(d => active.has(d.data.id))
      if (focus) keepVisible(focus, widthOf(focus), duration)
    }
  }

  /** Desliza a câmera (sem mudar o zoom) para manter um nó dentro da tela. */
  function keepVisible (point: Placed, width: number, duration: number) {
    const svg = svgEl.value
    if (!svg) return
    const current = d3.zoomTransform(svg)
    const margin = 72
    const left = current.applyX(point.x - width / 2)
    const right = current.applyX(point.x + width / 2)
    const top = current.applyY(point.y - NODE_H / 2)
    const bottom = current.applyY(point.y + NODE_H / 2)
    let dx = 0
    let dy = 0
    if (left < margin) dx = viewport.width / 2 - current.applyX(point.x)
    else if (right > viewport.width - margin) dx = viewport.width / 2 - current.applyX(point.x)
    if (top < margin) dy = margin - top
    else if (bottom > viewport.height - margin) dy = viewport.height - margin - bottom
    if (dx === 0 && dy === 0) return
    applyTransform(new d3.ZoomTransform(current.k, current.x + dx, current.y + dy), duration > 0 ? Math.max(duration, 300) : 0)
  }

  function scheduleRender () {
    if (frame) return
    frame = requestAnimationFrame(render)
  }

  /**
   * Calcula o enquadramento. Com `readable`, árvores muito largas não são
   * reduzidas abaixo de uma escala legível: a vista foca a raiz.
   */
  function targetTransform (readable: boolean): d3.ZoomTransform | null {
    const { width, height } = viewport
    if (width === 0 || height === 0 || !props.snapshot.root) return null
    const pad = 56
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
    return d3.zoomIdentity.translate(width / 2 - cx * scale, height / 2 - cy * scale).scale(scale)
  }

  function applyTransform (transform: d3.ZoomTransform, duration: number) {
    const svg = svgEl.value
    if (!svg || !zoomBehavior) return
    const sel = d3.select(svg)
    if (duration > 0) {
      sel.transition('camera').duration(duration).ease(d3.easeCubicInOut).call(zoomBehavior.transform, transform)
    } else {
      sel.interrupt('camera').call(zoomBehavior.transform, transform)
    }
  }

  /** Enquadra a árvore inteira (botão / tecla F). */
  function fit (animated = true) {
    const target = targetTransform(false)
    if (target) applyTransform(target, animated && !reducedMotion?.matches ? 450 : 0)
  }

  /**
   * Acompanha mudanças de forma suavemente: se a árvore continua visível e a
   * escala ideal mudou pouco, a câmera fica parada (evita "tremidas").
   */
  function follow (duration: number): boolean {
    const svg = svgEl.value
    const target = targetTransform(true)
    if (!svg || !target) return false
    const current = d3.zoomTransform(svg)
    const margin = 16
    const visible = current.applyX(bounds.x0) >= margin
      && current.applyX(bounds.x1) <= viewport.width - margin
      && current.applyY(bounds.y0) >= margin
      && current.applyY(bounds.y1) <= viewport.height - margin
    if (visible && Math.abs(Math.log(target.k / current.k)) < 0.3) return false
    applyTransform(target, duration > 0 ? Math.max(duration, 350) : 0)
    return true
  }

  function zoomBy (factor: number) {
    if (!svgEl.value || !zoomBehavior) return
    d3.select(svgEl.value).transition('camera').duration(250).call(zoomBehavior.scaleBy, factor)
  }

  // ---- Exportação --------------------------------------------------------

  function buildStandaloneSvg (): { markup: string, width: number, height: number } | null {
    if (!svgEl.value || !layerEl.value || !props.snapshot.root) return null
    const pad = 32
    const width = Math.ceil(bounds.x1 - bounds.x0 + pad * 2)
    const height = Math.ceil(bounds.y1 - bounds.y0 + pad * 2)
    const clone = layerEl.value.cloneNode(true) as SVGGElement
    clone.setAttribute('transform', `translate(${pad - bounds.x0},${pad - bounds.y0})`)
    for (const el of clone.querySelectorAll('.pulse')) el.remove()
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
      img.addEventListener('load', () => {
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
      })
      img.addEventListener('error', () => {
        URL.revokeObjectURL(url)
        resolve(null)
      })
      img.src = url
    })
  }

  defineExpose({ fit, zoomBy, exportSvg, exportPng })

  // ---- Ciclo de vida -----------------------------------------------------

  onMounted(() => {
    if (!svgEl.value || !layerEl.value || !nodesEl.value) return
    reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
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
      if (props.autoFit) follow(0)
    })
    if (container.value) resizeObserver.observe(container.value)

    // Delegação de eventos: um único ouvinte para todas as chaves.
    d3.select(nodesEl.value).on('click', (event: MouseEvent) => {
      const cell = (event.target as Element).closest('g.cell') as (Element & { __data__?: number }) | null
      if (cell && typeof cell.__data__ === 'number') emit('selectKey', cell.__data__)
    })

    render()
    const initial = targetTransform(true)
    if (initial) applyTransform(initial, 0)
  })

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    resizeObserver?.disconnect()
    if (svgEl.value) d3.select(svgEl.value).on('.zoom', null).interrupt('camera')
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
  background-image: radial-gradient(rgba(var(--v-theme-on-surface), 0.07) 1px, transparent 1px);
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

.tree-svg :deep(.pulse) {
  opacity: 0;
}

.tree-svg :deep(.pulse.pulsing) {
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse 1.4s ease-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.7;
    transform: scale(0.97);
  }

  100% {
    opacity: 0;
    transform: scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tree-svg :deep(.pulse.pulsing) {
    animation: none;
    opacity: 0.5;
  }
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
  overflow: hidden;
  position: absolute;
  top: 12px;
  right: 12px;
}

.tree-bottom {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.tree-bottom > :deep(*) {
  pointer-events: auto;
}
</style>
