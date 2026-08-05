import { useMemo } from 'react'
import type { Element, Recipe } from '../types'
import { sanitizeSVG } from '../utils'

function ConfirmIcon({ svg, size = 40 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

/** 配方小图标条目 */
function RecipeChip({ el, emerald }: { el: Element; emerald?: boolean }) {
  return (
    <span className="flex items-center gap-1 rounded border border-amber-800/30 bg-[#fdf6e3] px-1 py-0.5">
      <ConfirmIcon svg={el.svg} size={18} />
      <span className={`text-[11px] font-semibold ${emerald ? 'text-emerald-800' : 'text-amber-900'}`}>{el.name}</span>
    </span>
  )
}

interface RelicConfirmModalProps {
  relic: Element
  element: Element
  /** 曾对该元素用过此秘宝的历史配方（命中则展示警告与配方） */
  prevRecipe: Recipe | null
  /** 元素 + 秘宝模板，用于解析配方图标 */
  elements: Element[]
  onConfirm: () => void
  onClose: () => void
}

/** 秘宝使用二次确认：消耗确认 + 重复使用警告（画出历史配方） */
export function RelicConfirmModal({
  relic,
  element,
  prevRecipe,
  elements,
  onConfirm,
  onClose,
}: RelicConfirmModalProps) {
  const byId = (id: string) => elements.find((e) => e.id === id)
  const inputs = prevRecipe ? [byId(prevRecipe.inputA), byId(prevRecipe.inputB)] : []
  const outputs = prevRecipe ? prevRecipe.outputs.map(byId) : []
  const consumeNote = relic.relicId === 'rubedo' ? '点化成功才会消耗' : '使用后库存 -1'

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-lg font-bold tracking-widest">🏺 秘宝 · 使用确认</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="parchment-panel flex flex-col gap-3 p-4 text-amber-900">
          {/* 组合预览：秘宝 + 元素 */}
          <div className="flex items-center justify-center gap-3">
            <span className="flex flex-col items-center gap-1">
              <ConfirmIcon svg={relic.svg} />
              <span className="text-xs font-bold text-amber-800">{relic.name}</span>
            </span>
            <span className="text-2xl font-bold text-amber-700">+</span>
            <span className="flex flex-col items-center gap-1">
              <ConfirmIcon svg={element.svg} />
              <span className="text-xs font-bold text-amber-800">{element.name}</span>
            </span>
          </div>

          <p className="text-center text-sm leading-relaxed text-amber-900">
            是否消耗一个<span className="font-bold text-red-800">「{relic.name}」</span>，对「{element.name}」
            {relic.relicId === 'rubedo' ? '施以点化' : '施放秘术'}？
            <span className="mt-0.5 block text-xs text-amber-700/80">（{consumeNote}）</span>
          </p>

          {/* 重复使用警告：画出历史配方 */}
          {prevRecipe && (
            <div className="rounded-xl border-2 border-red-700/50 bg-red-100/60 p-3">
              <p className="text-center text-xs font-bold text-red-800">
                ⚠️ 你曾对「{element.name}」使用过「{relic.name}」
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {inputs[0] && <RecipeChip el={inputs[0]} />}
                <span className="text-xs font-bold text-amber-800">+</span>
                {inputs[1] && <RecipeChip el={inputs[1]} />}
                <span className="text-xs font-bold text-amber-800">=</span>
                {outputs.length > 0 ? (
                  outputs.map((o) => o && <RecipeChip key={o.id} el={o} emerald />)
                ) : (
                  <span className="text-xs font-semibold text-red-800">未知</span>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-red-900/70">
                再次使用可能得到相似的结果，确定继续吗？
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-amber-800/40 bg-amber-100 py-2 font-semibold text-amber-900 transition-colors hover:bg-amber-200"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 py-2 font-bold text-amber-50 transition-all hover:brightness-110 active:scale-95"
            >
              确认使用
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
