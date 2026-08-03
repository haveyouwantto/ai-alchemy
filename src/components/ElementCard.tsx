import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Element } from '../types'
import { sanitizeSVG } from '../utils'

interface ElementCardProps {
  element: Element
  /** 卡片尺寸（px） */
  size?: number
  /** 拖拽属性（由 dnd-kit 注入） */
  listeners?: object
  /** 拖拽 ARIA 属性 */
  attributes?: object
  /** 拖拽引用 */
  ref?: React.Ref<HTMLDivElement>
  /** 是否处于拖拽中 */
  isDragging?: boolean
  /** 是否为拖拽目标（高亮） */
  isDragOver?: boolean
  /** 是否选中 */
  selected?: boolean
  /** 点击回调（选中） */
  onClick?: () => void
  /** 双击回调（复制） */
  onDoubleClick?: () => void
  /** 自定义样式 */
  style?: CSSProperties
  /** 额外类名 */
  className?: string
  /** 是否闪烁（合成动画） */
  flashing?: boolean
}

function ElementCardInner({
  element,
  size = 96,
  listeners,
  attributes,
  ref,
  isDragging = false,
  isDragOver = false,
  selected = false,
  onClick,
  onDoubleClick,
  style,
  className = '',
  flashing = false,
}: ElementCardProps) {
  const svg = useMemo(() => (element.svg ? sanitizeSVG(element.svg) : ''), [element.svg])

  return (
    <div
      ref={ref}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      {...(attributes ?? {})}
      {...(listeners ?? {})}
      className={[
        'relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-150',
        'bg-gradient-to-br from-purple-900/80 via-indigo-900/70 to-fuchsia-900/80 shadow-lg shadow-purple-950/50 backdrop-blur-sm',
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/50'
          : 'border-purple-500/40',
        listeners ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging ? 'opacity-40 scale-105 ring-4 ring-amber-400/60 z-50' : '',
        isDragOver
          ? 'drag-over-active'
          : 'hover:scale-105 hover:border-amber-400/80 hover:shadow-amber-500/20',
        flashing ? 'animate-flash' : '',
        className,
      ].join(' ')}
    >
      {svg ? (
        <div
          className="svg-shell"
          style={{ width: size * 0.62, height: size * 0.62 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-purple-700/50"
          style={{ width: size * 0.5, height: size * 0.5 }}
        >
          <span className="text-2xl text-purple-200">?</span>
        </div>
      )}
      <span
        className="mt-1 truncate text-center font-medium text-purple-100"
        style={{ fontSize: size * 0.13, maxWidth: size * 0.9 }}
        title={element.name}
      >
        {element.name}
      </span>
      <span
        className="truncate text-center font-mono text-purple-400/80"
        style={{ fontSize: size * 0.08, maxWidth: size * 0.85 }}
        title={element.id}
      >
        {element.id}
      </span>
    </div>
  )
}

export const ElementCard = memo(ElementCardInner)