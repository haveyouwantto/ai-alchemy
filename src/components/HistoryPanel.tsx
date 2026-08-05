import { useEffect, useMemo, useState } from 'react'
import type { CraftHistoryEntry, Element, ElementCategory, Recipe } from '../types'
import { sanitizeSVG } from '../utils'
import { ElementDetailModal } from './ElementCodex'

interface HistoryPanelProps {
  history: CraftHistoryEntry[]
  /** 配方表：用于按 recipeId 解析输入/输出元素 */
  recipes: Recipe[]
  /** 元素库（图鉴）：用于渲染元素名称/SVG */
  elements: Element[]
  /** 类别表（详情弹窗展示类别用） */
  categories: ElementCategory[]
  /** 详情弹窗「添加到桌面」 */
  onAdd: (el: Element) => void
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

export function HistoryPanel({ history, recipes, elements, categories, onAdd, open, onClose, onClear }: HistoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [page, setPage] = useState(0)
  const [detailElement, setDetailElement] = useState<Element | null>(null)

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

  // id → 元素 查找（从图鉴库解析，历史仅存 recipeId，遵循范式）
  const elementById = useMemo(() => {
    const map = new Map<string, Element>()
    for (const e of elements) map.set(e.id, e)
    return map
  }, [elements])

  const recipeById = useMemo(() => {
    const map = new Map<string, Recipe>()
    for (const r of recipes) map.set(r.id, r)
    return map
  }, [recipes])

  // 分页：扁平化后按 PAGE_SIZE 切页，再按日期重组（简单可靠）
  const totalCount = groups.reduce((n, [, entries]) => n + entries.length, 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)

  const visibleGroups = useMemo(() => {
    const items: Array<{ date: string; entry: CraftHistoryEntry }> = []
    for (const [date, entries] of groups) {
      for (const entry of entries) items.push({ date, entry })
    }
    const pageItems = items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
    const map = new Map<string, CraftHistoryEntry[]>()
    for (const { date, entry } of pageItems) {
      const arr = map.get(date) ?? []
      arr.push(entry)
      map.set(date, arr)
    }
    return Array.from(map.entries())
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

  /** 由历史条目解析配方详情（输入/输出元素与名称） */
  const resolveHistory = (h: CraftHistoryEntry) => {
    const recipe = recipeById.get(h.recipeId)
    const elA = recipe ? elementById.get(recipe.inputA) : undefined
    const elB = recipe ? elementById.get(recipe.inputB) : undefined
    const outs = recipe ? recipe.outputs.map((oid) => elementById.get(oid)).filter((e): e is Element => !!e) : []
    return { recipe, elA, elB, outs }
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
                    {entries.map((h) => {
                      const { recipe, elA, elB, outs } = resolveHistory(h)
                      return (
                        <div
                          key={h.id}
                          className="rounded-lg border border-amber-800/30 bg-[#fdf6e3] px-3 py-2 shadow-sm transition-colors hover:border-amber-600"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10px] text-amber-600">{formatTime(h.timestamp)}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                h.source === 'ai'
                                  ? 'bg-amber-800 text-amber-100'
                                  : 'bg-amber-200 text-amber-900'
                              }`}
                            >
                              {h.source === 'ai' ? 'AI 炼成' : '配方'}{' '}
                              {h.newCount ? `(+${h.newCount}新)` : ''}
                            </span>
                          </div>
                          {!recipe ? (
                            <div className="mt-1 text-xs text-amber-700">
                              配方已不存在（id={h.recipeId}）
                            </div>
                          ) : (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => elA && setDetailElement(elA)}
                                title={elA ? `查看「${elA.name}」` : undefined}
                                className="flex items-center gap-1 rounded px-0.5 transition-colors hover:bg-amber-200/70"
                              >
                                <HistoryIcon svg={elA?.svg ?? ''} size={24} />
                                <span className="text-xs font-semibold text-amber-950">{elA?.name ?? '?'}</span>
                              </button>
                              <span className="text-xs font-bold text-amber-700">
                                {recipe.subtract ? '−' : '+'}
                              </span>
                              <button
                                type="button"
                                onClick={() => elB && setDetailElement(elB)}
                                title={elB ? `查看「${elB.name}」` : undefined}
                                className="flex items-center gap-1 rounded px-0.5 transition-colors hover:bg-amber-200/70"
                              >
                                <HistoryIcon svg={elB?.svg ?? ''} size={24} />
                                <span className="text-xs font-semibold text-amber-950">{elB?.name ?? '?'}</span>
                              </button>
                              <span className="text-xs font-bold text-amber-700">=</span>
                              {outs.map((o) => (
                                <button
                                  key={`${h.id}-${o.id}`}
                                  type="button"
                                  onClick={() => setDetailElement(o)}
                                  title={`查看「${o.name}」`}
                                  className="flex items-center gap-1 rounded px-0.5 transition-colors hover:bg-emerald-100"
                                >
                                  <HistoryIcon svg={o.svg} size={24} />
                                  <span className="text-xs font-bold text-emerald-800">{o.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
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

      {/* 元素详情：点击历史记录中的元素打开 */}
      {detailElement && (
        <ElementDetailModal
          element={detailElement}
          category={categories.find((c) => c.id === detailElement.categoryId)}
          recipes={recipes}
          elements={elements}
          categories={categories}
          onAdd={onAdd}
          onClose={() => setDetailElement(null)}
        />
      )}
    </div>
  )
}
