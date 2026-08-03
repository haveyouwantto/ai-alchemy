import { useEffect, useMemo, useState } from 'react'
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

/** 每页显示的记录条数 */
const PAGE_SIZE = 20

export function HistoryPanel({ history, open, onClose, onClear }: HistoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [page, setPage] = useState(0)

  // 打开时回到第一页
  useEffect(() => {
    if (open) setPage(0)
  }, [open])

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

  // 分页：按记录条数切页（每页可跨多个日期分组）
  const totalCount = groups.reduce((n, [, entries]) => n + entries.length, 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)

  const visibleGroups = useMemo(() => {
    const result: Array<[string, CraftHistoryEntry[]]> = []
    let count = 0
    let collecting = false
    for (const [date, entries] of groups) {
      if (!collecting) {
        // 定位到本页起始位置
        if (count + entries.length > safePage * PAGE_SIZE) {
          collecting = true
          const skip = safePage * PAGE_SIZE - count
          const slice = entries.slice(skip)
          result.push([date, slice])
          count += slice.length
        } else {
          count += entries.length
        }
      } else {
        const remaining = (safePage + 1) * PAGE_SIZE - count
        if (remaining <= 0) break
        const slice = entries.slice(0, remaining)
        result.push([date, slice])
        count += slice.length
      }
    }
    return result
  }, [groups, safePage])

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
          <h2 className="font-serif text-xl font-bold tracking-widest">📜 炼金记录 · 共 {history.length} 条</h2>
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
              {visibleGroups.map(([date, entries]) => (
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

        {/* 底部翻页 */}
        {history.length > 0 && (
          <div className="flex items-center justify-between border-t border-amber-900/30 bg-[#7a4a20]/95 px-4 py-2 text-amber-100">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage <= 0}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                safePage <= 0
                  ? 'cursor-not-allowed opacity-40'
                  : 'bg-amber-900/50 hover:bg-amber-900/80'
              }`}
            >
              ‹ 上一页
            </button>
            <span className="text-xs font-semibold">
              第 {safePage + 1} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                safePage >= totalPages - 1
                  ? 'cursor-not-allowed opacity-40'
                  : 'bg-amber-900/50 hover:bg-amber-900/80'
              }`}
            >
              下一页 ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}