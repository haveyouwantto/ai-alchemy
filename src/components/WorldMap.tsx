import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphProps, type NodeObject } from 'react-force-graph-2d'
import type { Element, ElementCategory, Recipe } from '../types'
import { sanitizeSVG } from '../utils'
import { ElementDetailModal } from './ElementCodex'

interface WorldMapProps {
  elements: Element[]
  recipes: Recipe[]
  categories: ElementCategory[]
  onAdd: (el: Element) => void
  open: boolean
  onClose: () => void
}

type GraphNode = NodeObject<Element>

/** 节点绘制半径（世界坐标单位；随缩放一起变化） */
const NODE_R = 32

/** 虚拟世界中心节点：连接四大基础元素，体现「世界之心」的意象（非真实元素，仅地图可视化） */
const WORLD_CORE_ID = 'world_core'
const WORLD_CORE_BASICS = ['fire', 'water', 'air', 'earth']
const WORLD_CORE: GraphNode = {
  id: WORLD_CORE_ID,
  name: '',
  description: '',
  categoryId: 'primal_matter',
  svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="coreGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.55"/><stop offset="100%" stop-color="#92400e" stop-opacity="0"/></radialGradient><linearGradient id="corePlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#78350f"/><stop offset="55%" stop-color="#5b2a0b"/><stop offset="100%" stop-color="#451a03"/></linearGradient><linearGradient id="coreFlask" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#coreGlow)"/><circle cx="50" cy="50" r="37" fill="url(#corePlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#fcd34d" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.12" transform="rotate(-28 38 33)"/><rect x="43" y="19" width="14" height="4" rx="2" fill="#fde68a" stroke="#b45309" stroke-width="1.5"/><path d="M46 23 L54 23 L54 37 L46 37 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/><path d="M42 37 L58 37 L67 74 Q67 80 58 80 L42 80 Q33 80 33 74 Z" fill="url(#coreFlask)" stroke="#b45309" stroke-width="2"/><path d="M44 42 L56 42 L50 57 Z" fill="#fef3c7" opacity="0.55"/><path d="M35 66 L65 66 L67 74 Q67 80 58 80 L42 80 Q33 80 33 74 Z" fill="#b45309" opacity="0.85"/><circle cx="44" cy="70" r="1.8" fill="#fff" opacity="0.55"/><circle cx="54" cy="74" r="1.4" fill="#fff" opacity="0.45"/><circle cx="49" cy="62" r="1.2" fill="#fff" opacity="0.5"/></svg>',
  createdAt: 0,
  useCount: 0,
}

/** 广搜生成树：从根（世界之心）出发逐层向外展开，
 *  根的直连邻居（四大基础元素）必定在第一层；游离孤岛尽力复用原边并入 */
function bfsSpanningTree(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
  root: string | null,
): Array<{ source: string; target: string }> {
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  // 邻居按 id 排序：广搜访问顺序确定，布局稳定
  for (const list of adj.values()) list.sort()

  const tree: Array<{ source: string; target: string }> = []
  const visited = new Set<string>()
  const bfs = (start: string, parent: string | null) => {
    const queue: Array<[string, string | null]> = [[start, parent]]
    visited.add(start)
    for (let i = 0; i < queue.length; i++) {
      const [id, p] = queue[i]
      if (p !== null) tree.push({ source: p, target: id })
      for (const n of adj.get(id) ?? []) {
        if (n === p || visited.has(n)) continue
        visited.add(n)
        queue.push([n, id])
      }
    }
  }

  // 根 = 世界之心（存在时）；其余根取从未作为产物出现的节点
  if (root && nodeIds.includes(root)) bfs(root, null)
  for (const id of nodeIds) {
    if (!visited.has(id) && !edges.some((e) => e.target === id)) bfs(id, null)
  }
  // 游离孤岛优先复用原有边并入主树
  for (let guard = 0; guard < nodeIds.length && visited.size < nodeIds.length; guard++) {
    let bridged = false
    for (const id of nodeIds) {
      if (visited.has(id)) continue
      for (const n of adj.get(id) ?? []) {
        if (visited.has(n)) {
          bfs(id, n)
          bridged = true
          break
        }
      }
      if (bridged) break
    }
    if (!bridged) break
  }
  // 仍无法连接的孤立点：单独挂起（布局层会分散处理）
  for (const id of nodeIds) {
    if (!visited.has(id)) bfs(id, null)
  }
  return tree
}

/** 径向树布局：按子树叶子数分配角度扇区，保证任意两条边不相交、向四面八方展开 */
function radialTreeLayout(
  nodeIds: string[],
  links: Array<{ source: string; target: string }>,
): Map<string, { x: number; y: number }> {
  const RING_GAP = 110
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const l of links) {
    adj.get(l.source)?.push(l.target)
    adj.get(l.target)?.push(l.source)
  }
  // 根 = 树中从不作为产物出现的元素（纯参与源头）；没有则取连接最多的节点
  const targets = new Set(links.map((l) => l.target))
  let roots = nodeIds.filter((id) => !targets.has(id))
  if (roots.length === 0 && nodeIds.length > 0) {
    const deg = new Map<string, number>()
    for (const l of links) {
      deg.set(l.source, (deg.get(l.source) ?? 0) + 1)
      deg.set(l.target, (deg.get(l.target) ?? 0) + 1)
    }
    roots = [nodeIds.reduce((a, b) => ((deg.get(b) ?? 0) > (deg.get(a) ?? 0) ? b : a))]
  }

  // 子树叶子数（后序一次算完）
  const subtreeSize = new Map<string, number>()
  const dfsSize = (id: string, parent: string): number => {
    let s = 1
    for (const c of adj.get(id) ?? []) {
      if (c !== parent) s += dfsSize(c, id)
    }
    subtreeSize.set(id, s)
    return s
  }
  for (const r of roots) dfsSize(r, '')

  const pos = new Map<string, { x: number; y: number }>()
  const place = (id: string, parent: string, depth: number, sectorStart: number, sectorSize: number) => {
    if (depth === 0) {
      pos.set(id, { x: 0, y: 0 })
    } else {
      const angle = sectorStart + sectorSize / 2
      const radius = depth * RING_GAP
      pos.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
    }
    const children = (adj.get(id) ?? []).filter((c) => c !== parent)
    if (children.length === 0) return
    let cursor = sectorStart - sectorSize / 2
    for (const c of children) {
      const size = ((subtreeSize.get(c) ?? 1) / (subtreeSize.get(id) ?? 1)) * sectorSize
      place(c, id, depth + 1, cursor + size / 2, size)
      cursor += size
    }
  }
  let cursor = 0
  for (const r of roots) {
    const size = ((subtreeSize.get(r) ?? 1) / nodeIds.length) * 2 * Math.PI
    place(r, '', 0, cursor + size / 2, size)
    cursor += size
  }
  return pos
}

/** 角度均衡力（表面张力）：让每个节点的相邻边尽量均匀分布、夹角趋于最大 */
function createAngleSpreadForce(
  links: Array<{ source: string; target: string }>,
): (alpha: number) => void {
  let nodes: GraphNode[] = []
  let nodesById = new Map<string, GraphNode>()
  const adj = new Map<string, string[]>()

  const applyTangential = (p: GraphNode, n: GraphNode, f: number, dir: number) => {
    const dx = (n.x ?? 0) - (p.x ?? 0)
    const dy = (n.y ?? 0) - (p.y ?? 0)
    const d = Math.hypot(dx, dy) || 1
    n.vx = (n.vx ?? 0) + (dy / d) * f * dir
    n.vy = (n.vy ?? 0) + (-dx / d) * f * dir
  }

  const force = (alpha: number) => {
    adj.clear()
    for (const link of links) {
      const s = link.source
      const t = link.target
      if (!adj.has(s)) adj.set(s, [])
      if (!adj.has(t)) adj.set(t, [])
      adj.get(s)!.push(t)
      adj.get(t)!.push(s)
    }
    for (const node of nodes) {
      const nbrIds = adj.get(String(node.id)) ?? []
      if (nbrIds.length < 2) continue
      const nbrs = nbrIds
        .map((id) => nodesById.get(id))
        .filter((n): n is GraphNode => !!n)
      if (nbrs.length < 2) continue
      const items = nbrs.map((n) => ({ n, a: Math.atan2((n.y ?? 0) - (node.y ?? 0), (n.x ?? 0) - (node.x ?? 0)) }))
      items.sort((u, v) => u.a - v.a)
      const target = (2 * Math.PI) / items.length
      for (let i = 0; i < items.length; i++) {
        const u = items[i]
        const v = items[(i + 1) % items.length]
        let gap = v.a - u.a
        if (i === items.length - 1) gap += 2 * Math.PI
        const excess = gap - target
        if (excess > 0.05) {
          // 缺口过大：把 u 顺时针、v 逆时针拉近，缩小大缺口、撑开其余夹角
          const f = Math.min(excess, Math.PI) * 4 * alpha
          applyTangential(node, u.n, f, 1)
          applyTangential(node, v.n, f, -1)
        }
      }
    }
  }
  ;(force as { initialize?: (n: GraphNode[]) => void }).initialize = (n: GraphNode[]) => {
    nodes = n
    nodesById = new Map(n.map((x) => [String(x.id), x]))
  }
  return force
}

/** 边相交规避力：检测相交线段，把四个端点沿交点推开，尽量消除交叉（配合自由力保持弹性） */
function createEdgeCrossForce(
  links: Array<{ source: string; target: string }>,
): (alpha: number) => void {
  let byId = new Map<string, GraphNode>()
  const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  const segIntersect = (a: GraphNode, b: GraphNode, c: GraphNode, d: GraphNode): boolean =>
    orient(a.x!, a.y!, b.x!, b.y!, c.x!, c.y!) * orient(a.x!, a.y!, b.x!, b.y!, d.x!, d.y!) < 0 &&
    orient(c.x!, c.y!, d.x!, d.y!, a.x!, a.y!) * orient(c.x!, c.y!, d.x!, d.y!, b.x!, b.y!) < 0

  const force = (alpha: number) => {
    const segs = links
      .map((l) => ({ a: byId.get(l.source), b: byId.get(l.target) }))
      .filter((s): s is { a: GraphNode; b: GraphNode } => !!s.a && !!s.b)
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const e1 = segs[i]
        const e2 = segs[j]
        if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue
        if (!segIntersect(e1.a, e1.b, e2.a, e2.b)) continue
        const ix = (e1.a.x! + e1.b.x! + e2.a.x! + e2.b.x!) / 4
        const iy = (e1.a.y! + e1.b.y! + e2.a.y! + e2.b.y!) / 4
        const f = 0.6 * alpha
        for (const n of [e1.a, e1.b, e2.a, e2.b]) {
          const dx = n.x! - ix
          const dy = n.y! - iy
          const d = Math.hypot(dx, dy) || 1
          n.vx = (n.vx ?? 0) + (dx / d) * f
          n.vy = (n.vy ?? 0) + (dy / d) * f
        }
      }
    }
  }
  ;(force as { initialize?: (n: GraphNode[]) => void }).initialize = (n: GraphNode[]) => {
    byId = new Map(n.map((x) => [String(x.id), x]))
  }
  return force
}

export function WorldMap({ elements, recipes, categories, onAdd, open, onClose }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(undefined)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [detailElement, setDetailElement] = useState<Element | null>(null)
  const imagesRef = useRef<Map<string, HTMLImageElement | undefined>>(new Map())
  const loadingRef = useRef<Set<string>>(new Set())
  const [, forceTick] = useState(0)

  // 容器尺寸（适配弹窗）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    // 无 ResizeObserver 时改用 window resize 监听
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update)
      ro.observe(el)
    }
    window.addEventListener('resize', update)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [open])

  // 图数据：节点 = 已解锁元素；连线 = 配方输入 → 输出（只画参与方向）；默认以世界之心为根逐层展开
  const graphData = useMemo(() => {
    const ids = new Set(elements.map((e) => e.id))
    const nodes: GraphNode[] = elements.map((e) => ({ ...e }))
    const fullMap = new Map<string, { source: string; target: string }>()
    for (const r of recipes) {
      for (const oid of r.outputs) {
        if (!ids.has(oid)) continue
        for (const iid of [r.inputA, r.inputB]) {
          if (iid === oid || !ids.has(iid)) continue
          const key = [iid, oid].sort().join('|')
          if (!fullMap.has(key)) fullMap.set(key, { source: iid, target: oid })
        }
      }
    }
    // 虚拟世界中心：连接已解锁的四大基础元素（作为世界树根，体现中心）
    const coreBasics = WORLD_CORE_BASICS.filter((id) => ids.has(id))
    if (coreBasics.length > 0) {
      nodes.push({ ...WORLD_CORE })
      for (const b of coreBasics) {
        const key = [WORLD_CORE_ID, b].sort().join('|')
        if (!fullMap.has(key)) fullMap.set(key, { source: WORLD_CORE_ID, target: b })
      }
    }
    const fullLinks = Array.from(fullMap.values())
    // 广搜生成树：以世界之心为根逐层向外，四大基础元素必定在第一层
    const treeLinks = bfsSpanningTree(
      nodes.map((n) => String(n.id)),
      fullLinks,
      coreBasics.length > 0 ? WORLD_CORE_ID : null,
    )
    // 树模式：径向树布局并固定节点，保证任意两条边不相交、向四面八方展开
    const layout = radialTreeLayout(
      nodes.map((n) => String(n.id)),
      treeLinks,
    )
    // 径向树布局只作初始位置，不固定节点——保留弹性
    const treeNodes: GraphNode[] = nodes.map((n) => {
      const p = layout.get(String(n.id))
      return p ? { ...n, x: p.x, y: p.y } : { ...n }
    })
    return { nodes, mstNodes: treeNodes, fullLinks, treeLinks }
  }, [elements, recipes])

  const links = graphData.treeLinks
  const nodes = graphData.mstNodes

  // 元素徽章 SVG → canvas 图片缓存（加载状态存 ref）
  useEffect(() => {
    const loadImage = (id: string, svg: string) => {
      if (imagesRef.current.has(id) || loadingRef.current.has(id)) return
      loadingRef.current.add(id)
      const img = new Image()
      img.onload = () => {
        imagesRef.current.set(id, img)
        forceTick((t) => t + 1)
      }
      img.onerror = () => {
        imagesRef.current.set(id, undefined)
        forceTick((t) => t + 1)
      }
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSVG(svg))}`
    }
    for (const el of elements) {
      loadImage(el.id, el.svg)
    }
    loadImage(WORLD_CORE_ID, WORLD_CORE.svg)
  }, [elements])

  // 布局：低向心拉力让图四面散开 + 角度均衡力让边均匀分布
  // 注意依赖 size：图表在容器测量完成后才挂载，fgRef 就绪后再配置力，否则配置会被跳过
  useEffect(() => {
    const g = fgRef.current
    if (!g) return
    g.d3Force('charge')?.strength(-120)
    g.d3Force('link')?.distance(115)
    g.d3Force('center')?.strength(0.05)
    g.d3Force('angleSpread', createAngleSpreadForce(links))
    g.d3Force('edgeCross', createEdgeCrossForce(links))
    // 自定义力挂载后重新加热仿真：让角度均衡在打开时就以满强度运行，
    // 而不是等到拖动节点（仿真被重新加热）才生效
    g.d3ReheatSimulation()
  }, [links, size])

  // 选中节点的邻接元素
  const neighbors = useMemo(() => {
    const set = new Set<string>()
    if (!selected) return set
    for (const l of links) {
      const s = String(l.source)
      const t = String(l.target)
      if (s === selected) set.add(t)
      if (t === selected) set.add(s)
    }
    return set
  }, [selected, links])

  // 选中元素的关系按方向分组：参与合成（选中 → 产物）与获得方式（原料 → 选中）
  const relatedByDir = useMemo(() => {
    const outs = new Set<string>()
    const ins = new Set<string>()
    if (!selected) return { outs, ins }
    for (const l of graphData.fullLinks) {
      const s = String(l.source)
      const t = String(l.target)
      if (s === selected) outs.add(t)
      if (t === selected) ins.add(s)
    }
    return { outs, ins }
  }, [selected, graphData.fullLinks])

  const drawNode: NonNullable<ForceGraphProps<Element, { source: string; target: string }>['nodeCanvasObject']> = (
    node,
    ctx,
    globalScale,
  ) => {
    const n = node as GraphNode
    const x = n.x ?? 0
    const y = n.y ?? 0
    const r = NODE_R
    const id = String(n.id)
    const isSel = id === selected
    const isNeighbor = neighbors.has(id)

    // 高亮环
    if (isSel) {
      ctx.beginPath()
      ctx.arc(x, y, r + 5, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(217,119,6,0.18)'
      ctx.fill()
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 2.5 / globalScale
      ctx.stroke()
    } else if (isNeighbor) {
      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI)
      ctx.strokeStyle = '#b45309'
      ctx.lineWidth = 1.5 / globalScale
      ctx.stroke()
    }

    const img = imagesRef.current.get(id)
    if (img) {
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2)
    } else {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = '#f5e6c8'
      ctx.fill()
      ctx.strokeStyle = '#c9a25c'
      ctx.lineWidth = 1 / globalScale
      ctx.stroke()
    }

    // 名称：缩放等级过小时不绘制
    if (globalScale >= 0.55) {
      const fontSize = 11 / globalScale
      ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
      ctx.fillStyle = isSel ? '#92400e' : '#7a5b2e'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(n.name ?? id, x, y + r + 2 / globalScale)
    }
  }

  const nodePointerAreaPaint: NonNullable<
    ForceGraphProps<Element, { source: string; target: string }>['nodePointerAreaPaint']
  > = (node, color, ctx) => {
    const n = node as GraphNode
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(n.x ?? 0, n.y ?? 0, NODE_R, 0, 2 * Math.PI)
    ctx.fill()
  }

  const linkColor = (l: { source?: unknown; target?: unknown }): string => {
    const s = String(l.source)
    const t = String(l.target)
    const active = selected && (s === selected || t === selected || neighbors.has(s) || neighbors.has(t))
    return active ? 'rgba(217,119,6,0.75)' : 'rgba(139,90,43,0.32)'
  }

  const linkWidth = (l: { source?: unknown; target?: unknown }): number => {
    const s = String(l.source)
    const t = String(l.target)
    return selected && (s === selected || t === selected) ? 2.4 : 0.7
  }

  if (!open) return null

  const selectedEl = selected ? elements.find((e) => e.id === selected) : undefined

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        {/* 页眉 */}
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">🗺️ 世界地图 · 元素关系网</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-200/80">
              {graphData.nodes.filter((n) => String(n.id) !== WORLD_CORE_ID).length} 元素 · {links.length} 关联
            </span>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 图区域 */}
        <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#f5e6c8]">
          {graphData.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-amber-800">
              <span className="text-5xl">🗺️</span>
              <p>世界一片混沌，还没有任何元素</p>
            </div>
          ) : size.width > 0 && size.height > 0 ? (
            <ForceGraph2D
              ref={fgRef}
              width={size.width}
              height={size.height}
              backgroundColor="rgba(0,0,0,0)"
              graphData={{ nodes, links }}
              nodeCanvasObjectMode={() => 'replace'}
              nodeCanvasObject={drawNode}
              nodePointerAreaPaint={nodePointerAreaPaint}
              onNodeClick={(node) => {
                const id = String(node.id)
                if (id === WORLD_CORE_ID) return
                setSelected(id === selected ? null : id)
              }}
              onBackgroundClick={() => setSelected(null)}
              onRenderFramePost={(ctx, globalScale) => {
                // 选中元素：参与合成（绿虚线）+ 获得方式（橙虚线）叠画，纯视觉不影响力。
                // ctx 自带 DPR + 缩放平移变换，节点/连线都按图坐标绘制，这里同样沿用。
                if (!selected) return
                const sel = nodes.find((n) => String(n.id) === selected)
                if (!sel || sel.x == null || sel.y == null) return
                const sx = sel.x
                const sy = sel.y
                ctx.save()
                ctx.setLineDash([6 / globalScale, 4 / globalScale])
                ctx.lineWidth = 1.5 / globalScale
                const drawDashes = (ids: Set<string>, color: string) => {
                  ctx.strokeStyle = color
                  for (const rid of ids) {
                    const n = nodes.find((nd) => String(nd.id) === rid)
                    if (!n || n.x == null || n.y == null || n === sel) continue
                    ctx.beginPath()
                    ctx.moveTo(sx, sy)
                    ctx.lineTo(n.x, n.y)
                    ctx.stroke()
                  }
                }
                drawDashes(relatedByDir.outs, 'rgba(16,185,129,0.85)') // 参与合成：绿
                drawDashes(relatedByDir.ins, 'rgba(217,119,6,0.75)') // 获得方式：橙
                ctx.restore()
              }}
              linkColor={linkColor as never}
              linkWidth={linkWidth as never}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkDirectionalParticles={selected ? 2 : 0}
              cooldownTime={12000}
            />
          ) : null}

          {/* 选中元素信息面板（右下角） */}
          {selectedEl && (
            <div className="absolute bottom-3 right-3 z-10 flex w-64 flex-col gap-1.5 rounded-xl border border-amber-800/40 bg-[#fdf6e3] p-3 shadow-xl">
              <div className="flex items-center gap-2">
                <span
                  className="svg-shell inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-amber-100/70"
                  dangerouslySetInnerHTML={{ __html: sanitizeSVG(selectedEl.svg) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-amber-950">{selectedEl.name}</p>
                  <p className="truncate font-mono text-[10px] text-amber-700/70">{selectedEl.id}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-xs text-amber-800 transition-colors hover:bg-amber-300"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
              <p className="line-clamp-3 text-xs leading-relaxed text-amber-900/80">
                {selectedEl.description || '暂无描述'}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onAdd(selectedEl)}
                  className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-1.5 text-sm font-bold text-amber-950 transition-all hover:brightness-110 active:scale-95"
                >
                  ＋ 添加到桌面
                </button>
                <button
                  onClick={() => setDetailElement(selectedEl)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-800/40 bg-amber-100 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-200"
                  title="查看详情"
                >
                  i
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t border-amber-900/30 bg-[#7a4a20]/95 px-4 py-2 text-xs text-amber-100/80">
          实线 = 直接关联 · 点击元素：绿虚线 = 参与合成，橙虚线 = 获得方式 · 滚轮缩放 · 拖动平移
        </div>
      </div>

      {/* 元素详情 */}
      {detailElement && (
        <ElementDetailModal
          element={detailElement}
          category={categories.find((c) => c.id === detailElement.categoryId)}
          recipes={recipes}
          elements={elements}
          categories={categories}
          onAdd={onAdd}
          onClose={() => setDetailElement(null)}
        />
      )}
    </div>
  )
}
