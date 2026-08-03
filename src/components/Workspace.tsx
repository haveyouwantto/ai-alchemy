import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { Element } from '../types'
import { ElementCard } from './ElementCard'

interface WorkspaceProps {
  elements: Element[]
  selectedIndex: number | null
  flashUids: Set<string>
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

/** 卡片自身尺寸（含边框/边距的大致占位，用于初始摆位避免重叠） */
const CARD_GUESS = { w: 110, h: 130 }

/** 工作区留白（px） */
const PADDING = 24

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
  onSelect,
  onCraft,
  onDuplicate,
  onOpenLibrary,
  onDeleteToTrash,
}: WorkspaceProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  /** 元素位置（像素坐标，相对工作区容器左上角） */
  const [positions, setPositions] = useState<Record<string, Pos>>({})
  const positionCounter = useRef(0)
  /** 最近一次合成时两张输入卡的中心位置（像素坐标），用于新元素围绕它生成 */
  const lastCraftCenter = useRef<Pos | null>(null)
  /** 工作区容器引用 */
  const containerRef = useRef<HTMLDivElement>(null)

  // 响应式卡片尺寸
  const [cardSize, setCardSize] = useState(() =>
    typeof window === 'undefined' ? 96 : window.innerWidth < 640 ? 68 : window.innerWidth < 1024 ? 88 : 104,
  )
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      setCardSize(w < 640 ? 68 : w < 1024 ? 88 : 104)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /** 为新增实例分配位置（px，基于容器实际尺寸）：首次出现时围绕最近合成中心（若存在）散布，否则随机 */
  useEffect(() => {
    setPositions((prev) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const cw = rect?.width ?? window.innerWidth
      const ch = rect?.height ?? window.innerHeight
      const minX = PADDING
      const minY = PADDING
      const maxX = Math.max(minX + 1, cw - CARD_GUESS.w - PADDING)
      const maxY = Math.max(minY + 1, ch - CARD_GUESS.h - PADDING)

      const next = { ...prev }
      let changed = false
      elements.forEach((el, index) => {
        const key = uidKey(el, index)
        if (!(key in next)) {
          positionCounter.current += 1
          const seed = positionCounter.current
          let x: number
          let y: number
          const center = lastCraftCenter.current
          if (center) {
            // 围绕中心散布（扇形，避免重叠）
            const angle = (seed * 137.5 * Math.PI) / 180
            const radius = 50 + (seed % 5) * 30
            x = Math.min(maxX, Math.max(minX, center.x + Math.cos(angle) * radius))
            y = Math.min(maxY, Math.max(minY, center.y + Math.sin(angle) * radius))
          } else {
            const cols = Math.max(1, Math.floor(cw / 150))
            const rows = Math.max(1, Math.floor(ch / 170))
            const col = seed % cols
            const row = Math.floor(seed / cols) % rows
            x = minX + col * 150 + ((seed * 37) % 40)
            y = minY + row * 170 + ((seed * 53) % 40)
            x = Math.min(maxX, x)
            y = Math.min(maxY, y)
          }
          next[key] = { x, y }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [elements])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 移动端：更短的按压延迟 + 更宽容差，让手指轻轻按住即可拖起，无需 <250ms 的精确长按
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 10 } }),
  )

  const activeKeyRef = useRef<string | null>(null)
  const activeStartPos = useRef<Pos | null>(null)

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const key = String(event.active.id)
      activeKeyRef.current = key
      activeStartPos.current = positions[key] ?? null
      setIsDraggingAny(true)
    },
    [positions],
  )

  // 拖拽过程中是否悬停过垃圾桶（松手时 event.over 可能已被清空，以此为准）
  const trashActiveRef = useRef(false)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null
    trashActiveRef.current = overId === 'trash-can'
    setDragOverId(overId && overId.startsWith('drop-') ? overId : null)
  }, [])

  // ---- 垃圾桶（拖入即删实例） ----
  const { setNodeRef: setTrashRef, isOver: isOverTrash } = useDroppable({ id: 'trash-can' })
  const [isDraggingAny, setIsDraggingAny] = useState(false)
  const handleDeleteToTrash = useCallback(
    (activeKey: string) => {
      const aIndex = elements.findIndex((el, i) => uidKey(el, i) === activeKey)
      if (aIndex < 0) return
      // 清理该实例的位置记录
      setPositions((prev) => {
        const next = { ...prev }
        delete next[activeKey]
        return next
      })
      onDeleteToTrash(aIndex)
    },
    [elements, onDeleteToTrash],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeKey = String(event.active.id)
      const overRaw = event.over ? String(event.over.id) : null
      const targetKey = overRaw && overRaw.startsWith('drop-') ? overRaw.slice(5) : null
      setDragOverId(null)
      activeKeyRef.current = null
      setIsDraggingAny(false)
      const wasOverTrash = trashActiveRef.current
      trashActiveRef.current = false

      const aIndex = elements.findIndex((el, i) => uidKey(el, i) === activeKey)
      if (aIndex < 0) {
        activeStartPos.current = null
        return
      }

      // 拖入垃圾桶 → 删除实例（优先使用拖拽过程中记录的目标）
      if (wasOverTrash) {
        handleDeleteToTrash(activeKey)
        activeStartPos.current = null
        return
      }

      // 拖到另一张卡上 → 合成
      if (targetKey && targetKey !== activeKey) {
        const bIndex = elements.findIndex((el, i) => uidKey(el, i) === targetKey)
        if (bIndex >= 0) {
          setPositions((currentPositions) => {
            const pa = currentPositions[activeKey]
            const pb = currentPositions[targetKey]
            if (pa && pb) {
              lastCraftCenter.current = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
            }
            return currentPositions
          })
          onCraft(elements[aIndex], elements[bIndex])
        }
        activeStartPos.current = null
        return
      }

      // 拖到空白处（或原地）→ 移动卡片位置（px：直接累加位移）
      if (event.delta) {
        const dx = event.delta.x
        const dy = event.delta.y
        setPositions((prev) => {
          const cur = prev[activeKey]
          if (!cur) return prev
          const rect = containerRef.current?.getBoundingClientRect()
          const maxX = rect ? rect.width - CARD_GUESS.w - PADDING : cur.x + dx
          const maxY = rect ? rect.height - CARD_GUESS.h - PADDING : cur.y + dy
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
    [elements, onCraft, onSelect, handleDeleteToTrash],
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
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      <DndContext
        sensors={sensors}
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
                onDoubleClick={() => onDuplicate(el)}
              />
            </div>
          )
        })}

        {/* 垃圾桶：拖入即删除实例 */}
        <div
          ref={setTrashRef}
          className={`absolute bottom-4 right-4 z-20 flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-3xl transition-all duration-200 ${
            isOverTrash
              ? 'scale-110 border-red-400 bg-red-900/80 shadow-lg shadow-red-500/30'
              : isDraggingAny
                ? 'border-amber-400/60 bg-purple-900/70'
                : 'border-purple-500/25 bg-purple-900/40'
          }`}
          title="拖拽元素到垃圾桶删除"
        >
          <span className={isOverTrash ? 'animate-bounce' : ''}>🗑️</span>
        </div>

        {/* 空态 */}
        {elements.length === 0 && (
          <button
            onClick={onOpenLibrary}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-dashed border-purple-500/40 bg-purple-900/30 px-8 py-10 text-center transition-colors hover:border-amber-400/60 hover:bg-purple-800/40"
          >
            <span className="text-4xl">🧪</span>
            <p className="mt-2 text-purple-200">工作区空空如也</p>
            <p className="mt-1 text-sm text-purple-400">点击打开元素列表添加元素</p>
          </button>
        )}
      </DndContext>
    </div>
  )
}