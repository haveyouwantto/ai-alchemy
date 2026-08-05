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

/** Kruskal 最小生成树（按节点 id 排序保证确定性；不连通时生成森林） */
function kruskalMst(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
): Array<{ source: string; target: string }> {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p !== x) {
      parent.set(x, find(p))
      return parent.get(x)!
    }
    return x
  }
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b))
  }
  for (const id of nodeIds) parent.set(id, id)
  const sorted = [...edges].sort((a, b) => `${a.source}|${a.target}`.localeCompare(`${b.source}|${b.target}`))
  const tree: Array<{ source: string; target: string }> = []
  for (const e of sorted) {
    if (find(e.source) !== find(e.target)) {
      union(e.source, e.target)
      tree.push(e)
    }
  }
  return tree
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
          const f = Math.min(excess, Math.PI) * 2.0 * alpha
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
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  // 图数据：节点 = 已解锁元素；连线 = 配方输入 → 输出（只画参与方向）；默认只展示最小生成树骨架
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
    const fullLinks = Array.from(fullMap.values())
    const mstLinks = kruskalMst(
      nodes.map((n) => String(n.id)),
      fullLinks,
    )
    // 树模式：径向初始布局（黄金角螺旋），让树向四面八方展开，不做垂直分层
    const mstNodes: GraphNode[] = nodes.map((n, i) => {
      const angle = i * 2.39996
      const radius = Math.sqrt(i + 1) * 58
      return { ...n, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    })
    return { nodes, mstNodes, mstLinks }
  }, [elements, recipes])

  const links = graphData.mstLinks
  const nodes = graphData.mstNodes

  // 元素徽章 SVG → canvas 图片缓存（StrictMode 安全：加载状态存 ref，重复挂载不会丢回调）
  useEffect(() => {
    for (const el of elements) {
      if (imagesRef.current.has(el.id) || loadingRef.current.has(el.id)) continue
      loadingRef.current.add(el.id)
      const img = new Image()
      img.onload = () => {
        imagesRef.current.set(el.id, img)
        forceTick((t) => t + 1)
      }
      img.onerror = () => {
        imagesRef.current.set(el.id, undefined)
        forceTick((t) => t + 1)
      }
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSVG(el.svg))}`
    }
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

    // 名称
    const fontSize = 11 / globalScale
    ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.fillStyle = isSel ? '#92400e' : '#7a5b2e'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(n.name ?? id, x, y + r + 2 / globalScale)
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
              {graphData.nodes.length} 元素 · {links.length} 关系（最小生成树）
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
              onNodeClick={(node) => setSelected(node.id === selected ? null : String(node.id))}
              onBackgroundClick={() => setSelected(null)}
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
          展示元素参与合成的最小生成树骨架 · 滚轮缩放 · 拖动平移 · 点击元素高亮
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
