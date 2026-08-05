import { useMemo } from 'react'
import type { Element } from '../types'
import { INITIAL_ELEMENTS, RELIC_TEMPLATES } from '../constants'
import { sanitizeSVG } from '../utils'

function Mini({ svg, size = 42 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

const baseIds = ['fire', 'water', 'air', 'earth']
const bases = baseIds
  .map((id) => INITIAL_ELEMENTS.find((e) => e.id === id))
  .filter((e): e is Element => !!e)

const relicVerbs: Record<string, string> = {
  nigredo: '分解',
  albedo: '净化',
  citrinitas: '精炼',
  rubedo: '点化',
}

/** 秘宝功能的大白话说明（不照抄物品描述） */
const plainRelicDesc: Record<string, string> = {
  nigredo: '把一个元素拆成组成它的几样具体东西。',
  albedo: '把一个元素提炼成更宏大、更抽象的概念。',
  citrinitas: '把一个元素精炼成更纯、更高阶的具体物质。',
  rubedo: '指定目标元素并写下说服之词，贤者同意才会生效。',
}

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

/** 图解式游戏说明 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  const panel = 'rounded-xl border border-amber-800/30 bg-[#fdf6e3] p-3 shadow-sm'
  const label = 'mb-2 text-center font-serif text-sm font-bold text-amber-950'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">📜 炼金工坊 · 说明</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="alchemy-scroll flex-1 overflow-y-auto bg-[#f5e6c8] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* 合成原理 */}
            <div className={`${panel} sm:col-span-2`}>
              <p className={label}>⚗️ 拖拽合成</p>
              <div className="flex items-center justify-center gap-3">
                <span className="flex flex-col items-center gap-0.5">
                  <Mini svg={bases[1]?.svg ?? ''} />
                  <span className="text-xs font-semibold text-amber-800">水</span>
                </span>
                <span className="text-2xl font-bold text-amber-700">＋</span>
                <span className="flex flex-col items-center gap-0.5">
                  <Mini svg={bases[0]?.svg ?? ''} />
                  <span className="text-xs font-semibold text-amber-800">火</span>
                </span>
                <span className="text-2xl font-bold text-amber-700">→</span>
                <span className="flex flex-col items-center gap-0.5">
                  <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-2 border-dashed border-amber-500 bg-amber-100/60 text-xl font-bold text-amber-600">
                    ?
                  </span>
                  <span className="text-xs font-semibold text-amber-800">新元素</span>
                </span>
              </div>
            </div>

            {/* 四大基础元素 */}
            <div className={`${panel} sm:col-span-2`}>
              <p className={label}>✨ 四大基础元素 · 双击空白处召唤</p>
              <div className="flex items-center justify-center gap-4">
                {bases.map((b) => (
                  <span key={b.id} className="flex flex-col items-center gap-0.5">
                    <Mini svg={b.svg} size={48} />
                    <span className="text-xs font-semibold text-amber-800">{b.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* 卡片操作 */}
            <div className={panel}>
              <p className={label}>🃏 卡片操作</p>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  ['🖱️', '拖到另一张上', '合成'],
                  ['👆', '双击卡片', '复制'],
                  ['🗑️', '拖入垃圾桶', '丢弃'],
                  ['⌫', '选中后 Delete', '删除'],
                ].map(([icon, how, what]) => (
                  <div
                    key={what}
                    className="flex h-[64px] items-center gap-2 rounded-lg border border-amber-800/20 bg-amber-100/50 px-2"
                  >
                    <span className="text-xl">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-amber-900">{what}</p>
                      <p className="text-[10px] text-amber-700/80">{how}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 秘宝 */}
            <div className={panel}>
              <p className={label}>🏺 秘宝 · 消耗品</p>
              <div className="grid grid-cols-1 gap-1.5">
                {RELIC_TEMPLATES.map((r) => (
                  <div
                    key={r.id}
                    className="flex h-[64px] items-center gap-2 rounded-lg border border-amber-800/25 bg-amber-100/60 p-2"
                  >
                    <Mini svg={r.svg} size={30} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-[11px] font-bold text-amber-900">
                        {r.name}
                        <span className="rounded-full bg-amber-400/80 px-1.5 text-[8px] font-semibold text-amber-950">
                          {relicVerbs[r.relicId ?? ''] ?? ''}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug text-amber-900">
                        {plainRelicDesc[r.relicId ?? ''] ?? ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 界面入口 */}
            <div className={`${panel} sm:col-span-2`}>
              <p className={label}>🧭 顶栏入口</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ['📚', '图鉴'],
                  ['📜', '记录'],
                  ['🗺️', '地图'],
                  ['🏆', '成就'],
                  ['🗂️', '整理'],
                  ['🧹', '清空'],
                  ['⚙️', 'AI 设置'],
                  ['❓', '说明'],
                ].map(([icon, name]) => (
                  <div key={name} className="flex flex-col items-center gap-1 rounded-lg border border-amber-800/20 bg-amber-100/50 px-2 py-2.5">
                    <span className="text-xl">{icon}</span>
                    <span className="text-xs font-semibold text-amber-900">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 快捷键 */}
            <div className={`${panel} sm:col-span-2`}>
              <p className={label}>⌨️ 快捷键</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  ['E / Z', '图鉴'],
                  ['X', '记录'],
                  ['C', '秘宝'],
                  ['V', '地图'],
                  ['B', '成就'],
                  ['R', '整理'],
                  ['L', '清空'],
                  ['Delete', '删除选中'],
                ].map(([key, desc]) => (
                  <span
                    key={`${key}-${desc}`}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-800/30 bg-[#fdf6e3] px-2 py-1.5 shadow-sm"
                  >
                    <span className="rounded border border-amber-700/50 bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900">
                      {key}
                    </span>
                    <span className="text-xs font-semibold text-amber-800">{desc}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
