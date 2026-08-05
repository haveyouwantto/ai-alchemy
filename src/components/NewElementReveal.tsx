import { useEffect, useRef, useState } from 'react'
import { sanitizeSVG } from '../utils'

export interface RevealItem {
  id: string
  name: string
  svg: string
  /** 新卡实例 uid（用于定位卡片位置） */
  instanceUid?: string
}

const HOLD_MS = 1000
const FLY_MS = 520
const SIZE = 170

/** 新元素发现动画：屏幕中央放大闪金光 1s，再缩小飞向工作区的新卡片 */
export function NewElementReveal({ item, onFinished }: { item: RevealItem; onFinished: () => void }) {
  const [flying, setFlying] = useState(false)
  const [target, setTarget] = useState<{ x: number; y: number; s: number } | null>(null)
  const finishedRef = useRef(false)

  // 阶段1：中央金光 1s，随后定位目标卡片
  useEffect(() => {
    const t = setTimeout(() => {
      const el = item.instanceUid
        ? document.querySelector<HTMLElement>(`[data-instance-uid="${item.instanceUid}"]`)
        : null
      const rect = el?.getBoundingClientRect()
      if (rect && rect.width > 0) {
        setTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, s: rect.width / SIZE })
      } else {
        setTarget({ x: window.innerWidth / 2, y: window.innerHeight / 2, s: 0.42 })
      }
      setFlying(true)
    }, HOLD_MS)
    return () => clearTimeout(t)
  }, [item])

  // 阶段2：飞行动画结束后移除
  useEffect(() => {
    if (!flying) return
    const t = setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true
        onFinished()
      }
    }, FLY_MS)
    return () => clearTimeout(t)
  }, [flying, onFinished])

  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const x = flying && target ? target.x : cx
  const y = flying && target ? target.y : cy
  const scale = flying && target ? target.s : 1

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <style>{`
        @keyframes revealGold {
          0%, 100% { box-shadow: 0 0 18px rgba(251,191,36,0.35), 0 0 46px rgba(251,191,36,0.22); }
          50% { box-shadow: 0 0 44px rgba(251,191,36,0.95), 0 0 96px rgba(251,191,36,0.6); }
        }
        @keyframes revealPop {
          0% { transform: scale(0.45); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        className="absolute left-0 top-0"
        style={{
          width: SIZE,
          height: SIZE,
          transform: `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px) scale(${scale})`,
          transformOrigin: 'center',
          transition: flying ? `transform ${FLY_MS}ms cubic-bezier(0.5, 0, 0.9, 0.4)` : 'none',
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{ animation: flying ? 'none' : 'revealGold 1s ease-in-out infinite' }}
        >
          <span
            className="svg-shell block h-full w-full"
            style={{ animation: flying ? 'none' : 'revealPop 0.35s ease-out' }}
            dangerouslySetInnerHTML={{ __html: sanitizeSVG(item.svg) }}
          />
        </div>
        {!flying && (
          <span className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap font-serif text-lg font-bold text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]">
            ✨ 新元素「{item.name}」真身显现
          </span>
        )}
      </div>
    </div>
  )
}
