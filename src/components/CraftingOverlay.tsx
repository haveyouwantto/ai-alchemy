import { useEffect, useMemo, useRef } from 'react'
import { sanitizeSVG } from '../utils'

interface CraftingOverlayProps {
  show: boolean
  message: string
  /** 正在合成的两个元素（inline 展示图标 + 名称） */
  inputs?: Array<{ name: string; svg: string } | null>
  /** AI 流式输出文本（思考与笔记统一在此展示） */
  streamText?: string
}

/** 自动缩放 SVG 图标（inline 小尺寸展示，因为 SVG 内部可能是固定 100x100） */
function InlineIcon({ svg, size = 28 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

export function CraftingOverlay({ show, message, inputs = [], streamText = '' }: CraftingOverlayProps) {
  const streamRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [streamText])

  // 文本区域高度自适应（最多约 10 行）
  useEffect(() => {
    const el = streamRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }
  }, [streamText])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-amber-400/40 bg-gradient-to-b from-indigo-950 to-purple-950 p-5 shadow-2xl shadow-amber-500/10 sm:max-w-md">
        {/* 贤者之石 + 正在合成的元素 inline 展示 */}
        <div className="flex w-full items-center justify-center gap-3">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <div className="absolute inset-0 animate-pulse-glow rounded-full bg-amber-400/30 blur-xl" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-400/10 text-2xl">
              💎
            </div>
          </div>

          {/* 合成公式行 */}
          <div className="flex items-center gap-2 text-sm">
            {inputs[0] ? (
              <span className="flex flex-col items-center gap-0.5">
                <InlineIcon svg={inputs[0].svg} size={30} />
                <span className="max-w-16 truncate text-xs font-medium text-purple-100">{inputs[0].name}</span>
              </span>
            ) : (
              <span className="text-purple-400">?</span>
            )}
            <span className="text-lg font-bold text-amber-400">+</span>
            {inputs[1] ? (
              <span className="flex flex-col items-center gap-0.5">
                <InlineIcon svg={inputs[1].svg} size={30} />
                <span className="max-w-16 truncate text-xs font-medium text-purple-100">{inputs[1].name}</span>
              </span>
            ) : (
              <span className="text-purple-400">?</span>
            )}
            <span className="text-lg font-bold text-amber-400">=</span>
            <span className="text-2xl text-amber-300">?</span>
          </div>
        </div>

        {/* 状态文字 */}
        <p className="text-center font-medium text-amber-200">{message || '贤者之石充能中...'}</p>

        {/* 进度条 */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-purple-800/60">
          <div className="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
        </div>

        {/* AI 笔记（思考与回答统一流式输出） */}
        <div className="w-full">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-purple-400">
            AI 炼金术笔记
          </p>
          <textarea
            ref={streamRef}
            readOnly
            value={streamText}
            placeholder="AI 正在思考合成方案..."
            className="alchemy-scroll h-40 w-full resize-none rounded-xl border border-purple-500/30 bg-purple-900/30 p-3 text-sm leading-relaxed text-purple-100 placeholder-purple-400/50 outline-none focus:border-amber-400/60"
          />
        </div>

        <style>{`@keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
      </div>
    </div>
  )
}