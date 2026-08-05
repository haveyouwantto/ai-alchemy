import { useMemo } from 'react'
import type { Achievement } from '../types'
import { RELIC_TEMPLATES } from '../constants'
import { sanitizeSVG } from '../utils'

interface AchievementsModalProps {
  achievements: Achievement[]
  /** achievementId → 完成时间戳 */
  completed: Record<string, number>
  unlockedCount: number
  categoryCount: number
  /** 已解锁元素 id 列表（用于目标成就进度） */
  unlockedIds: string[]
  open: boolean
  onClose: () => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const relicNameById = Object.fromEntries(RELIC_TEMPLATES.map((r) => [r.relicId, r.name]))

/** 奖励文案：黑化×1、白化×1 … */
function rewardText(reward: Record<string, number>): string {
  return Object.entries(reward)
    .map(([rid, n]) => `${relicNameById[rid] ?? rid}×${n}`)
    .join('、')
}

export function AchievementsModal({
  achievements,
  completed,
  unlockedCount,
  categoryCount,
  unlockedIds,
  open,
  onClose,
}: AchievementsModalProps) {
  const doneCount = Object.keys(completed).length
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds])

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
            {achievements.map((a) => {
              const ts = completed[a.id]
              const progress =
                a.metric === 'elements'
                  ? `${Math.min(unlockedCount, a.targetCount ?? 0)}/${a.targetCount ?? 0}`
                  : a.metric === 'categories'
                    ? `${Math.min(categoryCount, a.targetCount ?? 0)}/${a.targetCount ?? 0}`
                    : `${(a.targetIds ?? []).filter((id) => unlockedSet.has(id)).length}/${(a.targetIds ?? []).length}`
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
                    <p className="mt-0.5 text-[11px] text-amber-700/80">奖励：{rewardText(a.reward)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
