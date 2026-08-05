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
  onDoubleClick?: (e: React.MouseEvent) => void
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
      data-instance-uid={element.instanceUid}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      {...(attributes ?? {})}
      {...(listeners ?? {})}
      className={[
        'relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-150',
        'element-card',
        // 半透明暖色底（毛玻璃模糊由 .element-card 的媒体查询控制，触屏设备禁用避免 iOS 切后台冻结）
        'border-amber-800/40 bg-amber-100/[0.07] shadow-lg shadow-black/40',
        'ring-1 ring-inset ring-amber-200/10',
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/50'
          : 'border-amber-900/60',
        // 可拖拽时禁用触摸默认行为（页面滚动/缩放），否则移动端拖不动
        listeners ? 'cursor-grab dnd-card active:cursor-grabbing' : 'cursor-pointer',
        isDragging ? 'opacity-40 scale-105 ring-4 ring-amber-400/60 z-50' : '',
        isDragOver
          ? 'drag-over-active'
          : 'hover:scale-105 hover:border-amber-400/80 hover:shadow-amber-500/20',
        flashing ? 'animate-flash' : '',
        className,
      ].join(' ')}
    >
      {element.relicId && (
        <span
          className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] leading-none text-violet-200 ring-1 ring-violet-400/40"
          title="秘宝 · 消耗品"
        >
          ✦
        </span>
      )}
      {svg ? (
        <div
          className="svg-shell"
          style={{ width: size * 0.62, height: size * 0.62 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-amber-900/40"
          style={{ width: size * 0.5, height: size * 0.5 }}
        >
          <span className="text-2xl text-amber-200">?</span>
        </div>
      )}
      <span
        className="mt-1 block text-center font-serif font-medium text-amber-100"
        style={{
          fontSize: size * 0.13,
          maxWidth: size * 0.9,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={element.name}
      >
        {element.name}
      </span>
      <span
        className="block text-center font-mono text-amber-200/60"
        style={{
          fontSize: size * 0.08,
          maxWidth: size * 0.85,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={element.id}
      >
        {element.id}
      </span>
    </div>
  )
}

export const ElementCard = memo(ElementCardInner)
