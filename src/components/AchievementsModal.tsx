import { useMemo, useState } from 'react'
import type { Achievement, Element, ElementCategory, Recipe } from '../types'
import { RELIC_TEMPLATES } from '../constants'
import { sanitizeSVG } from '../utils'
import { ElementDetailModal } from './ElementCodex'

interface AchievementsModalProps {
  achievements: Achievement[]
  /** achievementId → 完成时间戳 */
  completed: Record<string, number>
  unlockedCount: number
  categoryCount: number
  /** 已掌握配方数（配方数量成就进度） */
  recipeCount: number
  /** 已解锁元素 id 列表（用于目标成就进度） */
  unlockedIds: string[]
  /** 已解锁元素（用于目标成就展示触发的元素小图标） */
  unlockedElements: Element[]
  /** 配方表（元素详情弹窗用） */
  recipes: Recipe[]
  /** 元素 + 秘宝模板（元素详情弹窗解析用） */
  elements: Element[]
  /** 类别表（元素详情弹窗用） */
  categories: ElementCategory[]
  /** 添加到桌面（元素详情弹窗用） */
  onAdd: (el: Element) => void
  /** 秘宝部署（奖励秘宝详情弹窗用，消耗库存） */
  onDeployRelic?: (relicId: string) => void
  open: boolean
  onClose: () => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 小图标 + 名称胶囊（成就列表内展示触发元素 / 奖励） */
function AchieveChip({ svg, text }: { svg: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-100 px-1.5 py-0.5">
      <span
        className="svg-shell inline-flex h-4 w-4 shrink-0 items-center justify-center"
        dangerouslySetInnerHTML={{ __html: sanitizeSVG(svg) }}
      />
      <span className="text-[11px] font-semibold text-amber-900">{text}</span>
    </span>
  )
}

export function AchievementsModal({
  achievements,
  completed,
  unlockedCount,
  categoryCount,
  recipeCount,
  unlockedIds,
  unlockedElements,
  recipes,
  elements,
  categories,
  onAdd,
  onDeployRelic,
  open,
  onClose,
}: AchievementsModalProps) {
  const [detailElement, setDetailElement] = useState<Element | null>(null)
  const doneCount = Object.keys(completed).length
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds])
  // 排序：数量成就（元素→类别→配方，阈值升序）在前，目标成就随后
  const sorted = useMemo(() => {
    const metricOrder: Record<string, number> = { elements: 0, categories: 1, recipes: 2 }
    return [...achievements].sort((a, b) => {
      const ma = a.metric ? (metricOrder[a.metric] ?? 3) : 3
      const mb = b.metric ? (metricOrder[b.metric] ?? 3) : 3
      if (ma !== mb) return ma - mb
      if (a.metric) return (a.targetCount ?? 0) - (b.targetCount ?? 0)
      return a.id.localeCompare(b.id)
    })
  }, [achievements])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">
            🏆 成就 · {doneCount}/{achievements.length}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="alchemy-scroll flex-1 overflow-y-auto bg-[#f5e6c8] p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sorted.map((a) => {
              const ts = completed[a.id]
              const progress =
                a.metric === 'elements'
                  ? `${Math.min(unlockedCount, a.targetCount ?? 0)}/${a.targetCount ?? 0}`
                  : a.metric === 'categories'
                    ? `${Math.min(categoryCount, a.targetCount ?? 0)}/${a.targetCount ?? 0}`
                  : a.metric === 'recipes'
                    ? `${Math.min(recipeCount, a.targetCount ?? 0)}/${a.targetCount ?? 0}`
                    : (a.targetIds ?? []).some((id) => unlockedSet.has(id))
                      ? '已发现'
                      : '尚未发现'
              const matched =
                a.targetIds && a.targetIds.length > 0
                  ? unlockedElements.filter((e) => a.targetIds!.includes(e.id))
                  : []
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-colors ${
                    ts
                      ? 'border-amber-600/60 bg-[#fdf3d5]'
                      : 'border-amber-800/30 bg-[#fdf6e3]'
                  }`}
                >
                  <span className="svg-shell inline-flex h-16 w-16 shrink-0 items-center justify-center">
                    <span
                      className="flex h-full w-full items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: sanitizeSVG(a.icon) }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-serif text-base font-bold text-amber-950">{a.name}</h3>
                      {ts && (
                        <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                          ✓ {formatDate(ts)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-amber-900/80">{a.description}</p>
                    <p className="mt-1 text-[11px] font-semibold text-amber-800">
                      {ts ? '已完成' : `进度 ${progress}`}
                    </p>
                    {matched.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[11px] font-semibold text-amber-700/80">触发元素：</span>
                        {matched.map((el) => (
                          <button
                            key={el.id}
                            type="button"
                            onClick={() => setDetailElement(el)}
                            title={`查看「${el.name}」详情`}
                            className="rounded-full transition-transform hover:scale-105 active:scale-95"
                          >
                            <AchieveChip svg={el.svg} text={el.name} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-semibold text-amber-700/80">奖励：</span>
                      {Object.entries(a.reward).map(([rid, n]) => {
                        const t = RELIC_TEMPLATES.find((r) => r.relicId === rid)
                        return t ? (
                          <button
                            key={rid}
                            type="button"
                            onClick={() => setDetailElement(t)}
                            title={`查看「${t.name}」详情`}
                            className="rounded-full transition-transform hover:scale-105 active:scale-95"
                          >
                            <AchieveChip svg={t.svg} text={`${t.name}×${n}`} />
                          </button>
                        ) : null
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 触发元素详情 */}
      {detailElement && (
        <ElementDetailModal
          element={detailElement}
          category={categories.find((c) => c.id === detailElement.categoryId)}
          recipes={recipes}
          elements={elements}
          categories={categories}
          onAdd={onAdd}
          onDeployRelic={onDeployRelic}
          onClose={() => setDetailElement(null)}
        />
      )}
    </div>
  )
}
