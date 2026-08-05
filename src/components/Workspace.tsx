import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent, Modifier } from '@dnd-kit/core'
import type { CardPosition, Element } from '../types'
import { ElementCard } from './ElementCard'

interface WorkspaceProps {
  elements: Element[]
  selectedIndex: number | null
  flashUids: Set<string>
  /** 桌面卡片坐标（key=instanceUid，单位 px，相对工作区容器左上角） */
  positions: Record<string, CardPosition>
  onPositionsChange: (updater: React.SetStateAction<Record<string, CardPosition>>) => void
  /** 整理桌面请求版本号：>0 且变化时触发平铺 */
  tidyVersion: number
  onSelect: (index: number) => void
  onCraft: (a: Element, b: Element) => void
  onDuplicate: (element: Element) => void
  onOpenLibrary: () => void
  /** 拖入垃圾桶时删除对应实例 */
  onDeleteToTrash: (index: number) => void
}

/** 获取元素的稳定 key */
function uidKey(el: Element, index: number): string {
  return el.instanceUid ?? `${el.id}#${index}`
}

/** 像素坐标 */
interface Pos {
  x: number
  y: number
}

/** 卡片尺寸 */
interface Size {
  w: number
  h: number
}

/** 工作区留白（px） */
const PADDING = 24

/** 按卡片基础尺寸估算真实渲染尺寸（在 DOM 测量就绪前兜底用） */
function estimateCardSize(size: number): Size {
  return { w: Math.max(48, Math.round(size * 0.9 + 4)), h: Math.max(52, Math.round(size * 0.9 + 10)) }
}

/** 可拖拽且可放置的元素卡 */
function DraggableCard({
  element,
  index,
  size,
  selected,
  flashing,
  isDragOverTarget,
  onSelect,
  onDoubleClick,
}: {
  element: Element
  index: number
  size: number
  selected: boolean
  flashing: boolean
  isDragOverTarget: boolean
  onSelect: () => void
  onDoubleClick: () => void
}) {
  const key = uidKey(element, index)

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: key,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${key}`,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        setDropRef(node)
      }}
      style={style}
    >
      <ElementCard
        element={element}
        size={size}
        listeners={listeners}
        attributes={attributes}
        isDragging={isDragging}
        isDragOver={isDragOverTarget || isOver}
        flashing={flashing}
        selected={selected}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
      />
    </div>
  )
}

export function Workspace({
  elements,
  selectedIndex,
  flashUids,
  positions,
  onPositionsChange,
  tidyVersion,
  onSelect,
  onCraft,
  onDuplicate,
  onOpenLibrary,
  onDeleteToTrash,
}: WorkspaceProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const positionCounter = useRef(0)
  /** 最近一次合成/复制时的生成中心（像素坐标）：合成取两张原料卡中点，复制取原卡位置，新卡围绕它生成 */
  const lastCraftCenter = useRef<Pos | null>(null)
  /** 工作区容器引用 */
  const containerRef = useRef<HTMLDivElement>(null)
  /** 卡片外层节点（用于读取真实渲染尺寸；offsetWidth/offsetHeight 不受拖拽 transform 影响） */
  const cardNodesRef = useRef(new Map<string, HTMLDivElement>())
  /** 最新位置快照（供拖拽 modifier 同步读取，避免依赖 dnd-kit 的 rect 测量时序） */
  const positionsRef = useRef(positions)
  positionsRef.current = positions
  /** 已应用过的整理请求版本号：仅响应新一次的点击，防止随元素变化自动重排 */
  const appliedTidyVersion = useRef(0)

  // 响应式卡片尺寸（移动端更小）
  const [cardSize, setCardSize] = useState(() =>
    typeof window === 'undefined' ? 96 : window.innerWidth < 640 ? 60 : window.innerWidth < 1024 ? 88 : 104,
  )
  const cardSizeRef = useRef(cardSize)
  cardSizeRef.current = cardSize
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      setCardSize(w < 640 ? 60 : w < 1024 ? 88 : 104)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /** 读取卡片真实渲染尺寸（px）；节点未就绪时返回 null */
  const readCardSize = useCallback((key: string): Size | null => {
    const node = cardNodesRef.current.get(key)
    if (!node) return null
    const w = node.offsetWidth
    const h = node.offsetHeight
    if (w <= 0 || h <= 0) return null
    return { w, h }
  }, [])

  /** 取卡片尺寸：优先真实测量值，其次按当前卡片档位估算 */
  const getCardSize = useCallback(
    (key: string): Size => readCardSize(key) ?? estimateCardSize(cardSizeRef.current),
    [readCardSize],
  )

  /** 为新增实例分配位置（px，基于容器实际尺寸）：首次出现时围绕最近合成中心（若存在）散布，否则随机 */
  useEffect(() => {
    onPositionsChange((prev) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const cw = rect?.width ?? window.innerWidth
      const ch = rect?.height ?? window.innerHeight
      const minX = PADDING
      const minY = PADDING

      const next = { ...prev }
      let changed = false
      elements.forEach((el, index) => {
        const key = uidKey(el, index)
        if (key in next) return
        const size = getCardSize(key)
        const maxX = Math.max(minX + 1, cw - size.w - PADDING)
        const maxY = Math.max(minY + 1, ch - size.h - PADDING)
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
        positionCounter.current += 1
        const seed = positionCounter.current
        let x: number
        let y: number
        const center = lastCraftCenter.current
        if (center) {
          // 围绕中心小范围散布（扇形，避免重叠，但仍紧邻原料/原卡）
          const angle = (seed * 137.5 * Math.PI) / 180
          const radius = 26 + (seed % 3) * 14
          x = clamp(center.x + Math.cos(angle) * radius, minX, maxX)
          y = clamp(center.y + Math.sin(angle) * radius, minY, maxY)
        } else {
          // 网格排布（步长随卡片尺寸缩放）
          const colStep = Math.max(40, size.w + 36)
          const rowStep = Math.max(48, size.h + 42)
          const cols = Math.max(1, Math.floor(cw / colStep))
          const rows = Math.max(1, Math.floor(ch / rowStep))
          const col = seed % cols
          const row = Math.floor(seed / cols) % rows
          x = clamp(minX + col * colStep + ((seed * 37) % 40), minX, maxX)
          y = clamp(minY + row * rowStep + ((seed * 53) % 40), minY, maxY)
        }
        next[key] = { x, y }
        changed = true
      })
      return changed ? next : prev
    })
  }, [elements, getCardSize, onPositionsChange])

  /** 元素被删除/合成消耗后，清理不再存在的坐标记录（防止旧 key 残留） */
  useEffect(() => {
    onPositionsChange((prev) => {
      const valid = new Set(elements.map((el, i) => uidKey(el, i)))
      const stale = Object.keys(prev).filter((k) => !valid.has(k))
      if (stale.length === 0) return prev
      const next = { ...prev }
      for (const k of stale) delete next[k]
      return next
    })
  }, [elements, onPositionsChange])

  /** 整理桌面：把所有卡片平铺为整齐网格（按真实尺寸逐行居中摆放） */
  useEffect(() => {
    // 只在「整理」按钮显式点击（版本号变化）时执行一次；元素增删不会触发自动重排
    if (tidyVersion <= 0 || tidyVersion === appliedTidyVersion.current) return
    appliedTidyVersion.current = tidyVersion
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    onPositionsChange((prev) => {
      const cw = rect.width
      const ch = rect.height
      const gap = 18
      interface TidyItem {
        key: string
        size: Size
      }
      const items: TidyItem[] = elements.map((el, i) => {
        const key = uidKey(el, i)
        return { key, size: getCardSize(key) }
      })
      if (items.length === 0) return prev

      // 逐行分组：超出右边界则换行
      const rows: TidyItem[][] = []
      let curRow: TidyItem[] = []
      let cursor = PADDING
      for (const it of items) {
        if (curRow.length > 0 && cursor + it.size.w + gap > cw - PADDING) {
          rows.push(curRow)
          curRow = []
          cursor = PADDING
        }
        curRow.push(it)
        cursor += it.size.w + gap
      }
      if (curRow.length > 0) rows.push(curRow)

      // 逐行居中，并保证不超出容器下边界
      const next = { ...prev }
      let y = PADDING
      for (const row of rows) {
        const totalW = row.reduce((sum, it) => sum + it.size.w, 0) + gap * (row.length - 1)
        let x = Math.max(PADDING, (cw - totalW) / 2)
        const rowMaxH = Math.max(...row.map((it) => it.size.h))
        for (const it of row) {
          const maxY = Math.max(PADDING, ch - it.size.h - PADDING)
          next[it.key] = { x: Math.round(x), y: Math.round(Math.min(y, maxY)) }
          x += it.size.w + gap
        }
        y += rowMaxH + gap
      }
      return next
    })
  }, [tidyVersion, elements, getCardSize, onPositionsChange])

  /** 加载时与窗口尺寸变化时，把超出工作区范围的卡片拉回可视区域 */
  useLayoutEffect(() => {
    const clampAll = () => {
      onPositionsChange((prev) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return prev
        let changed = false
        const next = { ...prev }
        for (const [key, pos] of Object.entries(next)) {
          const size = getCardSize(key)
          const maxX = Math.max(PADDING, rect.width - size.w - PADDING)
          const maxY = Math.max(PADDING, rect.height - size.h - PADDING)
          const nx = Math.min(maxX, Math.max(PADDING, pos.x))
          const ny = Math.min(maxY, Math.max(PADDING, pos.y))
          if (nx !== pos.x || ny !== pos.y) {
            next[key] = { x: nx, y: ny }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
    // 挂载时同步拉回一次（布局阶段执行，避免首帧闪出屏幕）
    clampAll()
    // 窗口尺寸变化时（rAF 节流）再次拉回
    let resizeRaf = 0
    const onResize = () => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(clampAll)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(resizeRaf)
      window.removeEventListener('resize', onResize)
    }
  }, [getCardSize, onPositionsChange])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 移动端：更短的按压延迟 + 更宽容差，让手指轻轻按住即可拖起，无需 <250ms 的精确长按
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 10 } }),
  )

  const activeKeyRef = useRef<string | null>(null)
  const activeStartPos = useRef<Pos | null>(null)

  /**
   * 拖拽过程中就把卡片限制在工作区范围内（按真实尺寸 + 留白），
   * 而不是松手时才钳制 —— 消除靠近右/下边缘时「回弹」的屏障感。
   */
  const clampToWorkspace = useMemo<Modifier>(
    () =>
      ({ transform, active }) => {
        const container = containerRef.current
        if (!container || !active) return transform
        const key = String(active.id)
        const pos = positionsRef.current[key]
        if (!pos) return transform
        const size = readCardSize(key) ?? estimateCardSize(cardSizeRef.current)
        const cRect = container.getBoundingClientRect()
        const minX = PADDING - pos.x
        const maxX = cRect.width - size.w - PADDING - pos.x
        const minY = PADDING - pos.y
        const maxY = cRect.height - size.h - PADDING - pos.y
        return {
          x: Math.min(maxX, Math.max(minX, transform.x)),
          y: Math.min(maxY, Math.max(minY, transform.y)),
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
        }
      },
    [readCardSize],
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const key = String(event.active.id)
      activeKeyRef.current = key
      activeStartPos.current = positions[key] ?? null
      setIsDraggingAny(true)
    },
    [positions],
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null
    setDragOverId(overId && overId.startsWith('drop-') ? overId : null)
  }, [])

  // ---- 垃圾桶（拖入即删实例） ----
  const { setNodeRef: setTrashRef, isOver: isOverTrash } = useDroppable({ id: 'trash-can' })
  const trashRef = useRef<HTMLDivElement | null>(null)
  const [isDraggingAny, setIsDraggingAny] = useState(false)
  /** 几何判定：拖拽中的卡片中心是否落入垃圾桶矩形内 */
  const isPointerInsideTrash = useCallback((rect: { left: number; top: number; width: number; height: number }) => {
    const trash = trashRef.current?.getBoundingClientRect()
    if (!trash) return false
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return cx >= trash.left && cx <= trash.right && cy >= trash.top && cy <= trash.bottom
  }, [])
  const handleDeleteToTrash = useCallback(
    (activeKey: string) => {
      const aIndex = elements.findIndex((el, i) => uidKey(el, i) === activeKey)
      if (aIndex < 0) return
      // 清理该实例的位置记录
      onPositionsChange((prev) => {
        const next = { ...prev }
        delete next[activeKey]
        return next
      })
      onDeleteToTrash(aIndex)
    },
    [elements, onDeleteToTrash, onPositionsChange],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeKey = String(event.active.id)
      const overRaw = event.over ? String(event.over.id) : null
      const targetKey = overRaw && overRaw.startsWith('drop-') ? overRaw.slice(5) : null
      setDragOverId(null)
      activeKeyRef.current = null
      setIsDraggingAny(false)
      // 几何判定：活动卡片中心是否落在垃圾桶屏幕区域（绕开 droppable over 的不可靠性）
      const activeRectMap = event.active.rect.current as { initial?: ClientRect; translated?: ClientRect }
      const activeRect =
        (activeRectMap.translated as { left: number; top: number; width: number; height: number } | undefined) ??
        (activeRectMap.initial as { left: number; top: number; width: number; height: number } | undefined)
      const droppedInTrash = activeRect ? isPointerInsideTrash(activeRect) : false

      const aIndex = elements.findIndex((el, i) => uidKey(el, i) === activeKey)
      if (aIndex < 0) {
        activeStartPos.current = null
        return
      }

      // 拖入垃圾桶 → 删除实例
      if (droppedInTrash) {
        handleDeleteToTrash(activeKey)
        activeStartPos.current = null
        return
      }

      // 拖到另一张卡上 → 合成
      if (targetKey && targetKey !== activeKey) {
        const bIndex = elements.findIndex((el, i) => uidKey(el, i) === targetKey)
        if (bIndex >= 0) {
          // 新产物以两张原料卡的中点为中心生成（任一卡缺位置时用另一张）
          const pa = positions[activeKey]
          const pb = positions[targetKey]
          const anchor = pa ?? pb
          lastCraftCenter.current = pa && pb
            ? { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
            : anchor
              ? { ...anchor }
              : null
          onCraft(elements[aIndex], elements[bIndex])
        }
        activeStartPos.current = null
        return
      }

      // 拖到空白处（或原地）→ 移动卡片位置（px：直接累加位移，并按真实尺寸钳制在容器内）
      if (event.delta) {
        const dx = event.delta.x
        const dy = event.delta.y
        onPositionsChange((prev) => {
          const cur = prev[activeKey]
          if (!cur) return prev
          const size = getCardSize(activeKey)
          const rect = containerRef.current?.getBoundingClientRect()
          const maxX = rect ? Math.max(PADDING, rect.width - size.w - PADDING) : cur.x + dx
          const maxY = rect ? Math.max(PADDING, rect.height - size.h - PADDING) : cur.y + dy
          const next = {
            ...prev,
            [activeKey]: {
              x: Math.min(maxX, Math.max(PADDING, cur.x + dx)),
              y: Math.min(maxY, Math.max(PADDING, cur.y + dy)),
            },
          }
          return next
        })
        // 移动后取消选中（避免误删）
        onSelect(-1)
      }
      activeStartPos.current = null
    },
    [elements, onCraft, onSelect, handleDeleteToTrash, positions, getCardSize, onPositionsChange],
  )

  const handleDragCancel = useCallback(() => {
    setDragOverId(null)
    activeKeyRef.current = null
    activeStartPos.current = null
    setIsDraggingAny(false)
  }, [])

  const dragOverTargetKey = useMemo(() => {
    if (!dragOverId) return null
    return dragOverId.startsWith('drop-') ? dragOverId.slice(5) : null
  }, [dragOverId])

  return (
    <div ref={containerRef} className="workbench relative flex-1 overflow-hidden">
      <DndContext
        sensors={sensors}
        modifiers={[clampToWorkspace]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {elements.map((el, index) => {
          const key = uidKey(el, index)
          // 兜底位置：默认网格排布（px）
          const pos = positions[key] ?? {
            x: PADDING + (index % 5) * 150,
            y: PADDING + (index % 4) * 170,
          }
          return (
            <div
              key={key}
              ref={(node) => {
                if (node) cardNodesRef.current.set(key, node)
                else cardNodesRef.current.delete(key)
              }}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: dragOverTargetKey === key ? 30 : 10,
              }}
            >
              <DraggableCard
                element={el}
                index={index}
                size={cardSize}
                selected={selectedIndex === index}
                flashing={flashUids.has(key)}
                isDragOverTarget={dragOverTargetKey === key}
                onSelect={() => onSelect(index)}
                onDoubleClick={() => {
                  // 复制出的卡片以原卡位置为生成中心
                  const pos = positions[key]
                  if (pos) lastCraftCenter.current = { ...pos }
                  onDuplicate(el)
                }}
              />
            </div>
          )
        })}

        {/* 垃圾桶：拖入即删除实例 */}
        <div
          ref={(node) => {
            setTrashRef(node)
            trashRef.current = node as HTMLDivElement | null
          }}
          className={`absolute bottom-4 right-4 z-20 flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-3xl transition-all duration-200 ${
            isOverTrash
              ? 'scale-110 border-red-400 bg-red-900/80 shadow-lg shadow-red-500/30'
              : isDraggingAny
                ? 'border-amber-400/60 bg-[#4a2e16]/90'
                : 'border-amber-900/50 bg-[#2b1a0d]/80'
          }`}
          title="拖拽元素到垃圾桶删除"
        >
          <span className={isOverTrash ? 'animate-bounce' : ''}>🗑️</span>
        </div>

        {/* 空态 */}
        {elements.length === 0 && (
          <button
            onClick={onOpenLibrary}
            className="parchment-panel absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-dashed border-amber-700/50 px-8 py-10 text-center text-amber-900 shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-colors hover:border-amber-500/80 hover:brightness-105"
          >
            <span className="text-4xl">🧪</span>
            <p className="mt-2 font-serif font-bold">工作区空空如也</p>
            <p className="mt-1 text-sm text-amber-800/80">点击打开元素列表添加元素</p>
          </button>
        )}
      </DndContext>
    </div>
  )
}
