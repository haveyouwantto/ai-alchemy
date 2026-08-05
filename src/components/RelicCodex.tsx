import { useMemo } from 'react'
import type { Element } from '../types'
import { sanitizeSVG } from '../utils'

interface RelicCodexProps {
  /** 秘宝模板（Element 形式，带 relicId） */
  relics: Element[]
  /** 库存：relicId → 数量 */
  counts: Record<string, number>
  open: boolean
  onClose: () => void
  /** 部署秘宝到桌面（库存 -1） */
  onDeploy: (relicId: string) => void
}

/** 秘宝图标（元素徽章同画风） */
function RelicIcon({ svg, size = 52 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

/** 秘宝录：查看秘宝库存并部署到桌面 */
export function RelicCodex({ relics, counts, open, onClose, onDeploy }: RelicCodexProps) {
  if (!open) return null

  const total = relics.reduce((sum, r) => sum + (counts[r.relicId ?? ''] ?? 0), 0)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        {/* 页眉 */}
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">
            🏺 秘宝录 · 库存 {total}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="alchemy-scroll flex-1 overflow-y-auto bg-[#f5e6c8] p-4">
          {relics.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-amber-800">
              <span className="text-5xl">🏺</span>
              <p>秘宝录空空如也</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {relics.map((r) => {
                const relicId = r.relicId ?? ''
                const count = counts[relicId] ?? 0
                return (
                  <div
                    key={relicId}
                    className="flex items-center gap-3 rounded-xl border border-amber-800/30 bg-[#fdf6e3] p-3 shadow-sm"
                  >
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-amber-100/70">
                      <RelicIcon svg={r.svg} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-base font-bold text-amber-950">{r.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            count > 0
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-stone-300 text-stone-600'
                          }`}
                        >
                          ×{count}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-amber-900/80">{r.description}</p>
                      <button
                        onClick={() => onDeploy(relicId)}
                        disabled={count <= 0}
                        className={`mt-2 w-full rounded-lg px-3 py-1.5 text-sm font-bold transition-all active:scale-95 ${
                          count > 0
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 hover:brightness-110'
                            : 'cursor-not-allowed bg-stone-300 text-stone-500'
                        }`}
                      >
                        {count > 0 ? '放置到桌面' : '库存不足'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t border-amber-900/30 bg-[#7a4a20]/95 px-4 py-2 text-xs text-amber-100/80">
          秘宝为消耗品：放置到桌面后库存 -1；拖入垃圾桶或清空桌面会返还；与元素卡片结合触发秘宝反应。
        </div>
      </div>
    </div>
  )
}
