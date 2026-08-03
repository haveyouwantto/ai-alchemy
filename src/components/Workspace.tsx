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
import { SPAWN_BOUNDS } from '../constants'

interface WorkspaceProps {
  elements: Element[]
  selectedIndex: number | null
  flashUids: Set<string>
  onSelect: (index: number) => void
  onCraft: (a: Element, b: Element) => void
  onDuplicate: (element: Element) => void
  onOpenLibrary: () => void
}

/** 获取元素的稳定 key */
function uidKey(el: Element, index: number): string {
  return el.instanceUid ?? `${el.id}#${index}`
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
  onSelect,
  onCraft,
  onDuplicate,
  onOpenLibrary,
}: WorkspaceProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const positionCounter = useRef(0)
  /** 最近一次合成时两张输入卡的中心位置（百分比坐标），用于新元素围绕它生成 */
  const lastCraftCenter = useRef<{ x: number; y: number } | null>(null)
  /** 工作区容器引用：用于把像素位移换算成容器百分比坐标 */
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

  /** 为新增实例分配位置：首次出现时围绕最近合成中心（若存在）散布，否则随机 */
  useEffect(() => {
    setPositions((prev) => {
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
            // 围绕中心 ±9% 散布（扇形，避免重叠）
            const angle = (seed * 137.5 * Math.PI) / 180
            const radius = 4 + (seed % 5) * 2.5
            x = Math.min(SPAWN_BOUNDS.max, Math.max(SPAWN_BOUNDS.min, center.x + Math.cos(angle) * radius))
            y = Math.min(SPAWN_BOUNDS.max, Math.max(SPAWN_BOUNDS.min, center.y + Math.sin(angle) * radius))
          } else {
            x = SPAWN_BOUNDS.min + ((seed * 37) % (SPAWN_BOUNDS.max - SPAWN_BOUNDS.min + 1))
            y = SPAWN_BOUNDS.min + ((seed * 53) % (SPAWN_BOUNDS.max - SPAWN_BOUNDS.min + 1))
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
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const activeKeyRef = useRef<string | null>(null)
  const activeStartPos = useRef<{ x: number; y: number } | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const key = String(event.active.id)
    activeKeyRef.current = key
    activeStartPos.current = positions[key] ?? null
  }, [positions])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null
    setDragOverId(overId && overId.startsWith('drop-') ? overId : null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeKey = String(event.active.id)
      const overRaw = event.over ? String(event.over.id) : null
      const targetKey = overRaw && overRaw.startsWith('drop-') ? overRaw.slice(5) : null
      setDragOverId(null)
      activeKeyRef.current = null

      const aIndex = elements.findIndex((el, i) => uidKey(el, i) === activeKey)
      if (aIndex < 0) {
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

      // 拖到空白处（或原地）→ 移动卡片位置
      if (event.delta) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          activeStartPos.current = null
          return
        }
        const dxPct = (event.delta.x / rect.width) * 100
        const dyPct = (event.delta.y / rect.height) * 100
        setPositions((prev) => {
          const cur = prev[activeKey]
          if (!cur) return prev
          const next = {
            ...prev,
            [activeKey]: {
              x: Math.min(SPAWN_BOUNDS.max, Math.max(SPAWN_BOUNDS.min, cur.x + dxPct)),
              y: Math.min(SPAWN_BOUNDS.max, Math.max(SPAWN_BOUNDS.min, cur.y + dyPct)),
            },
          }
          return next
        })
        // 移动后取消选中（避免误删）
        onSelect(-1)
      }
      activeStartPos.current = null
    },
    [elements, onCraft, onSelect],
  )

  const handleDragCancel = useCallback(() => {
    setDragOverId(null)
    activeKeyRef.current = null
    activeStartPos.current = null
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
          const pos = positions[key] ?? { x: 15 + (index % 5) * 15, y: 15 + (index % 4) * 15 }
          return (
            <div
              key={key}
              className="absolute"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
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