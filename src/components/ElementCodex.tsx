import { useMemo, useState } from 'react'
import type { Element, ElementCategory, Recipe } from '../types'
import { sanitizeSVG } from '../utils'

interface ElementCodexProps {
  elements: Element[]
  recipes: Recipe[]
  categories: ElementCategory[]
  open: boolean
  onClose: () => void
  /** 点击「+」添加到桌面 */
  onAdd: (element: Element) => void
}

/** 迷你元素图标 */
function CodexIcon({ svg, size = 44 }: { svg: string; size?: number }) {
  const cleaned = useMemo(() => sanitizeSVG(svg), [svg])
  return (
    <span
      className="svg-shell inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}

/** 配方小条目：A + B = 输出 */
function RecipeMini({ recipe, elements }: { recipe: Recipe; elements: Element[] }) {
  const elA = elements.find((e) => e.id === recipe.inputA)
  const elB = elements.find((e) => e.id === recipe.inputB)
  const outs = recipe.outputs.map((oid) => elements.find((e) => e.id === oid))
  return (
    <div className="flex flex-wrap items-center gap-1 rounded border border-amber-700/40 bg-amber-100/40 px-1.5 py-1">
      <CodexIcon svg={elA?.svg ?? ''} size={22} />
      <span className="text-[11px] font-semibold text-amber-900">{elA?.name ?? '?'}</span>
      <span className="text-[11px] text-amber-700">+</span>
      <CodexIcon svg={elB?.svg ?? ''} size={22} />
      <span className="text-[11px] font-semibold text-amber-900">{elB?.name ?? '?'}</span>
      <span className="px-0.5 text-[11px] text-amber-700">=</span>
      {outs.map((o) => (
        <span key={o?.id ?? Math.random()} className="flex items-center gap-0.5">
          <CodexIcon svg={o?.svg ?? ''} size={22} />
          <span className="text-[11px] font-bold text-emerald-800">{o?.name ?? '?'}</span>
        </span>
      ))}
    </div>
  )
}

/** 元素完整详情 modal（书页风格） */
function ElementDetailModal({
  element,
  category,
  recipes,
  elements,
  onAdd,
  onClose,
}: {
  element: Element
  category: ElementCategory | undefined
  recipes: Recipe[]
  elements: Element[]
  onAdd: (el: Element) => void
  onClose: () => void
}) {
  const recipesAsOutput = recipes.filter((r) => r.outputs.includes(element.id))
  const recipesAsInput = recipes.filter(
    (r) => !recipesAsOutput.includes(r) && (r.inputA === element.id || r.inputB === element.id),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-amber-800/50 bg-[#fdf6e3] shadow-2xl">
        {/* 页眉 */}
        <div className="flex items-center justify-between border-b-2 border-double border-amber-800/40 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h3 className="font-serif text-lg font-bold tracking-wide">✦ 元素档案</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="alchemy-scroll max-h-[70vh] overflow-y-auto p-5">
          {/* 头部：大图标 + 名称 + ID + 类别 */}
          <div className="flex items-center gap-4 pb-3">
            <CodexIcon svg={element.svg} size={72} />
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-amber-950">{element.name}</h2>
              <p className="font-mono text-xs text-amber-700">{element.id}</p>
              {category && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-700/50 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  <CodexIcon svg={category.icon} size={14} />
                  {category.name}
                </span>
              )}
            </div>
          </div>

          {/* 描述 */}
          <p className="border-y border-amber-800/30 py-3 text-sm leading-relaxed text-amber-900/90">
            {element.description || '暂无描述，此元素由炼金术师偶然所得…'}
          </p>

          {/* 双栏配方 */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-amber-800">
                ✦ 获得方式
              </p>
              <div className="flex flex-col gap-1">
                {recipesAsOutput.length === 0 ? (
                  <p className="rounded border border-dashed border-amber-700/40 px-1.5 py-1 text-center text-xs text-amber-700/70">
                    暂无
                  </p>
                ) : (
                  recipesAsOutput.map((r) => <RecipeMini key={r.id} recipe={r} elements={elements} />)
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-amber-800">
                ✦ 参与合成
              </p>
              <div className="flex flex-col gap-1">
                {recipesAsInput.length === 0 ? (
                  <p className="rounded border border-dashed border-amber-700/40 px-1.5 py-1 text-center text-xs text-amber-700/70">
                    暂无
                  </p>
                ) : (
                  recipesAsInput.map((r) => <RecipeMini key={r.id} recipe={r} elements={elements} />)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex gap-2 border-t border-amber-800/30 bg-[#f5e6c8] px-4 py-3">
          <button
            onClick={() => {
              onAdd(element)
              onClose()
            }}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2 font-bold text-amber-950 transition-all hover:brightness-110 active:scale-95"
          >
            ＋ 添加到桌面
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-amber-800/40 bg-amber-100 px-4 py-2 font-semibold text-amber-900 transition-colors hover:bg-amber-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export function ElementCodex({ elements, recipes, categories, open, onClose, onAdd }: ElementCodexProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [detailElement, setDetailElement] = useState<Element | null>(null)

  // 去重后的元素（图鉴以元素类型为单位，非实例）
  const uniqueElements = useMemo(() => {
    const map = new Map<string, Element>()
    for (const el of elements) {
      if (!map.has(el.id)) map.set(el.id, el)
    }
    return Array.from(map.values())
  }, [elements])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return uniqueElements
      .filter((e) => (categoryFilter === 'all' ? true : e.categoryId === categoryFilter))
      .filter((e) => {
        if (!q) return true
        return e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [uniqueElements, search, categoryFilter])

  if (!open) return null

  const detailCategory = detailElement
    ? categories.find((c) => c.id === detailElement.categoryId)
    : undefined

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        {/* 书封头 */}
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">📖 元素图鉴 · 天地之书</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索元素..."
              className="w-32 rounded-lg border border-amber-700/40 bg-[#fdf6e3] px-3 py-1.5 text-sm text-amber-950 placeholder-amber-700/50 outline-none focus:border-amber-500 sm:w-40"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-amber-700/40 bg-[#fdf6e3] px-2 py-1.5 text-sm text-amber-950 outline-none focus:border-amber-500"
            >
              <option value="all">全部类别</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 类别栏：可点击切换筛选 */}
        <div className="alchemy-scroll flex gap-2 overflow-x-auto border-b border-amber-900/20 bg-[#8b5a2b]/90 px-4 py-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
              categoryFilter === 'all'
                ? 'border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 shadow-md'
                : 'border-amber-700/50 bg-[#fdf6e3] text-amber-900 hover:border-amber-500 hover:bg-amber-50'
            }`}
          >
            全部
          </button>
          {categories.map((c) => {
            const count = uniqueElements.filter((e) => e.categoryId === c.id).length
            const active = categoryFilter === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
                  active
                    ? 'border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 shadow-md'
                    : 'border-amber-700/50 bg-[#fdf6e3] text-amber-900 hover:border-amber-500 hover:bg-amber-50'
                }`}
                title={`筛选类别：${c.name}`}
              >
                <CodexIcon svg={c.icon} size={22} />
                <span>{c.name}</span>
                <span
                  className={`rounded-full px-1.5 text-xs font-bold ${
                    active ? 'bg-amber-950/20 text-amber-950' : 'bg-amber-700/15 text-amber-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* 书页内容：网格元素图标 tiles（i / + 按钮） */}
        <div className="alchemy-scroll flex-1 overflow-y-auto bg-[#f5e6c8] p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-amber-800">
              <span className="text-5xl">📜</span>
              <p>图鉴中尚无此条目</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((el) => (
                <div
                  key={el.id}
                  className="rounded-lg border border-amber-800/30 bg-[#fdf6e3] p-2 shadow-sm transition-colors hover:border-amber-600 hover:shadow-md"
                >
                  {/* 图标（点击查看详情） */}
                  <button
                    onClick={() => setDetailElement(el)}
                    className="flex w-full flex-col items-center gap-1"
                    title={`查看 ${el.name} 详情`}
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-md bg-amber-100/70">
                      <CodexIcon svg={el.svg} size={44} />
                    </span>
                    <span className="w-full truncate text-center text-xs font-semibold text-amber-950">
                      {el.name}
                    </span>
                    <span className="w-full truncate font-mono text-[9px] text-amber-700/70">{el.id}</span>
                  </button>
                  {/* 操作按钮：i 详情 / + 添加到桌面 */}
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => setDetailElement(el)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-700/50 bg-amber-100 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-300"
                      title="查看详情"
                    >
                      i
                    </button>
                    <button
                      onClick={() => onAdd(el)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-700/50 bg-amber-100 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-300"
                      title="添加到桌面"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 详情 modal */}
      {detailElement && (
        <ElementDetailModal
          element={detailElement}
          category={detailCategory}
          recipes={recipes}
          elements={uniqueElements}
          onAdd={onAdd}
          onClose={() => setDetailElement(null)}
        />
      )}
    </div>
  )
}