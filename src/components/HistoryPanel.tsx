import { useMemo, useState } from 'react'
import type { CraftHistoryEntry } from '../types'
import { sanitizeSVG } from '../utils'

interface HistoryPanelProps {
  history: CraftHistoryEntry[]
  open: boolean
  onClose: () => void
  onClear: () => void
}

/** 迷你 SVG 图标 */
function HistoryIcon({ svg, size = 28 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

/** 格式化时间为 HH:MM:SS */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 格式化日期：今天/昨天/M月D日 */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function HistoryPanel({ history, open, onClose, onClear }: HistoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)

  // 按日期分组（时间倒序：最近的在前）
  const groups = useMemo(() => {
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp)
    const map = new Map<string, CraftHistoryEntry[]>()
    for (const h of sorted) {
      const dateKey = formatDate(h.timestamp)
      const arr = map.get(dateKey) ?? []
      arr.push(h)
      map.set(dateKey, arr)
    }
    return Array.from(map.entries())
  }, [history])

  if (!open) return null

  const handleClearClick = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 2500)
      return
    }
    setConfirmClear(false)
    onClear()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        {/* 页眉 */}
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">📜 炼金记录 · 最近 {history.length} 次</h2>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClearClick}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  confirmClear
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-900/50 text-amber-100 hover:bg-amber-900/80'
                }`}
                title="清空全部历史"
              >
                {confirmClear ? '确认清空？' : '清空'}
              </button>
            )}
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
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-amber-800">
              <span className="text-5xl">📜</span>
              <p className="font-semibold">暂无炼金记录</p>
              <p className="text-sm text-amber-700/70">拖拽两张元素卡进行合成后，这里会记录每一步炼金历程</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(([date, entries]) => (
                <div key={date}>
                  {/* 日期分隔 */}
                  <div className="sticky top-0 z-10 mb-2 rounded-lg bg-[#7a4a20]/95 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-100 shadow">
                    {date} · {entries.length} 条
                  </div>
                  {/* 条目列表 */}
                  <div className="flex flex-col gap-2">
                    {entries.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-lg border border-amber-800/30 bg-[#fdf6e3] px-3 py-2 shadow-sm transition-colors hover:border-amber-600"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] text-amber-600">{formatTime(h.timestamp)}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              h.source === 'ai'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {h.source === 'ai' ? 'AI 炼成' : '配方'}{' '}
                            {h.newCount ? `(+${h.newCount}新)` : ''}
                          </span>
                        </div>
                        {/* 公式：A + B = 输出 */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="flex items-center gap-1">
                            <HistoryIcon svg={h.inputA.svg} size={24} />
                            <span className="text-xs font-semibold text-amber-950">{h.inputA.name}</span>
                          </span>
                          <span className="text-xs font-bold text-amber-700">+</span>
                          <span className="flex items-center gap-1">
                            <HistoryIcon svg={h.inputB.svg} size={24} />
                            <span className="text-xs font-semibold text-amber-950">{h.inputB.name}</span>
                          </span>
                          <span className="text-xs font-bold text-amber-700">=</span>
                          {h.outputs.map((o) => (
                            <span key={`${h.id}-${o.id}-${Math.random()}`} className="flex items-center gap-1">
                              <HistoryIcon svg={o.svg} size={24} />
                              <span className="text-xs font-bold text-emerald-800">{o.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}