import { useMemo, useState } from 'react'
import type { Element } from '../types'
import { sanitizeSVG } from '../utils'

function TransmuteIcon({ svg, size = 40 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

interface TransmuteModalProps {
  relic: Element
  element: Element
  onClose: () => void
  onSubmit: (request: string) => void
}

/** 赤化点化：玩家写下说服之词，AI 裁决是否把元素点化为指定目标 */
export function TransmuteModal({ relic, element, onClose, onSubmit }: TransmuteModalProps) {
  const [text, setText] = useState('')

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-lg font-bold tracking-widest">🔮 赤化 · 点化审判</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="parchment-panel flex flex-col gap-3 p-4 text-amber-900">
          <div className="flex items-center justify-center gap-3">
            <span className="flex flex-col items-center gap-1">
              <TransmuteIcon svg={relic.svg} />
              <span className="text-xs font-bold text-amber-800">{relic.name}</span>
            </span>
            <span className="text-2xl font-bold text-amber-700">→</span>
            <span className="flex flex-col items-center gap-1">
              <TransmuteIcon svg={element.svg} />
              <span className="text-xs font-bold text-amber-800">{element.name}</span>
            </span>
            <span className="text-2xl font-bold text-amber-700">→</span>
            <span className="text-2xl">❓</span>
          </div>
          <p className="text-center text-xs leading-relaxed text-amber-800/80">
            写下你的说服之词，并指定要把「{element.name}」点化为哪个元素；贤者将据此裁决。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="写下说服贤者的话，并指定目标元素……"
            rows={5}
            className="alchemy-scroll w-full resize-none rounded-xl border border-amber-800/40 bg-[#fdf6e3] p-3 text-sm leading-relaxed text-amber-950 placeholder-amber-700/50 outline-none focus:border-amber-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSubmit(text)}
              disabled={!text.trim()}
              className={`flex-1 rounded-xl px-4 py-2.5 font-bold transition-all active:scale-95 ${
                text.trim()
                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:brightness-110'
                  : 'cursor-not-allowed bg-stone-300 text-stone-500'
              }`}
            >
              请求点化
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-amber-800/40 bg-amber-100 px-4 py-2.5 font-semibold text-amber-900 transition-colors hover:bg-amber-200"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
