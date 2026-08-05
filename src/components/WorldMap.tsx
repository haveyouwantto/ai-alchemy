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
const NODE_R = 8

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

  // 图数据：节点 = 已解锁元素；连线 = 配方输入 → 输出
  const graphData = useMemo(() => {
    const ids = new Set(elements.map((e) => e.id))
    const nodes: GraphNode[] = elements.map((e) => ({ ...e }))
    const linkMap = new Map<string, { source: string; target: string }>()
    for (const r of recipes) {
      for (const oid of r.outputs) {
        if (!ids.has(oid)) continue
        for (const iid of [r.inputA, r.inputB]) {
          if (iid === oid || !ids.has(iid)) continue
          const key = [iid, oid].sort().join('|')
          if (!linkMap.has(key)) linkMap.set(key, { source: iid, target: oid })
        }
      }
    }
    return { nodes, links: Array.from(linkMap.values()) }
  }, [elements, recipes])

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

  // 布局：加大节点间距（更强斥力 + 更长的连线理想距离）
  useEffect(() => {
    const g = fgRef.current
    if (!g) return
    g.d3Force('charge')?.strength(-140)
    g.d3Force('link')?.distance(95)
    g.d3Force('center')?.strength(0.4)
  }, [graphData])

  // 选中节点的邻接元素
  const neighbors = useMemo(() => {
    const set = new Set<string>()
    if (!selected) return set
    for (const l of graphData.links) {
      const s = String(l.source)
      const t = String(l.target)
      if (s === selected) set.add(t)
      if (t === selected) set.add(s)
    }
    return set
  }, [selected, graphData.links])

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
            <span className="text-xs text-amber-200/80">{graphData.nodes.length} 元素 · {graphData.links.length} 关系</span>
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
              graphData={{ nodes: graphData.nodes, links: graphData.links }}
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
              cooldownTime={8000}
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
          滚轮缩放 · 拖动平移 · 点击元素高亮其合成关系
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
