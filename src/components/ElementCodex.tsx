import { useEffect, useMemo, useState } from 'react'
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
  /** 秘宝模板（配方中的秘宝输入解析用） */
  relics?: Element[]
  /** 秘宝部署：详情里对秘宝点「添加到桌面」时消耗库存 */
  onDeployRelic?: (relicId: string) => void
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

/** 配方小条目：A + B = 输出（可点击跳转到对应元素详情） */
function RecipeMini({
  recipe,
  elements,
  onSelect,
}: {
  recipe: Recipe
  elements: Element[]
  onSelect: (el: Element) => void
}) {
  const elA = elements.find((e) => e.id === recipe.inputA)
  const elB = elements.find((e) => e.id === recipe.inputB)
  const outs = recipe.outputs
    .map((oid) => elements.find((e) => e.id === oid))
    .filter((e): e is Element => !!e)
  const firstOut = outs[0]
  return (
    <div
      onClick={() => firstOut && onSelect(firstOut)}
      title={firstOut ? `查看「${firstOut.name}」` : undefined}
      className="flex cursor-pointer flex-wrap items-center gap-1 rounded border border-amber-700/40 bg-amber-100/40 px-1.5 py-1 transition-colors hover:border-amber-500 hover:bg-amber-200/60"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (elA) onSelect(elA)
        }}
        title={elA ? `查看「${elA.name}」` : undefined}
        className="flex items-center gap-0.5 rounded px-0.5 hover:bg-amber-300/50"
      >
        <CodexIcon svg={elA?.svg ?? ''} size={22} />
        <span className="text-[11px] font-semibold text-amber-900">{elA?.name ?? '?'}</span>
      </button>
      <span className="text-[11px] text-amber-700">{recipe.subtract ? '−' : '+'}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (elB) onSelect(elB)
        }}
        title={elB ? `查看「${elB.name}」` : undefined}
        className="flex items-center gap-0.5 rounded px-0.5 hover:bg-amber-300/50"
      >
        <CodexIcon svg={elB?.svg ?? ''} size={22} />
        <span className="text-[11px] font-semibold text-amber-900">{elB?.name ?? '?'}</span>
      </button>
      <span className="px-0.5 text-[11px] text-amber-700">=</span>
      {outs.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(o)
          }}
          title={`查看「${o.name}」`}
          className="flex items-center gap-0.5 rounded px-0.5 hover:bg-emerald-200/60"
        >
          <CodexIcon svg={o.svg} size={22} />
          <span className="text-[11px] font-bold text-emerald-800">{o.name}</span>
        </button>
      ))}
    </div>
  )
}

/** 时间戳 → YYYY-MM-DD */
function formatDiscovered(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 元素完整详情 modal（书页风格）——也用于秘宝详情 */
export function ElementDetailModal({
  element,
  category,
  recipes,
  elements,
  onAdd,
  onClose,
  categories,
  onDeployRelic,
}: {
  element: Element
  category: ElementCategory | undefined
  recipes: Recipe[]
  elements: Element[]
  onAdd: (el: Element) => void
  onClose: () => void
  /** 类别表（可选）：提供后，跳转到其它元素时也能显示其类别 */
  categories?: ElementCategory[]
  /** 秘宝部署（可选）：详情中的秘宝点「添加到桌面」时消耗库存 */
  onDeployRelic?: (relicId: string) => void
}) {
  const [viewElement, setViewElement] = useState(element)
  /** 查看大图模式 */
  const [showBigIcon, setShowBigIcon] = useState(false)
  useEffect(() => setViewElement(element), [element])

  const recipesAsOutput = recipes.filter((r) => r.outputs.includes(viewElement.id))
  const recipesAsInput = recipes.filter(
    (r) => !recipesAsOutput.includes(r) && (r.inputA === viewElement.id || r.inputB === viewElement.id),
  )
  const viewCategory =
    categories?.find((c) => c.id === viewElement.categoryId) ??
    (viewElement.id === element.id ? category : undefined)
  const navigateTo = (el: Element) => setViewElement(el)

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
            <button
              type="button"
              onClick={() => setShowBigIcon(true)}
              title="点击查看大图"
              className="shrink-0 rounded-xl outline-none transition-transform hover:scale-105 active:scale-95"
            >
              <CodexIcon svg={viewElement.svg} size={72} />
            </button>
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-bold text-amber-950">{viewElement.name}</h2>
              <p className="font-mono text-xs text-amber-700">{viewElement.id}</p>
              {viewElement.discoveredAt !== undefined && viewElement.discoveredAt > 0 && (
                <p className="mt-0.5 text-[11px] text-amber-700/80">
                  发现于 {formatDiscovered(viewElement.discoveredAt)}
                </p>
              )}
              {viewCategory && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-700/50 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  <CodexIcon svg={viewCategory.icon} size={14} />
                  {viewCategory.name}
                </span>
              )}
            </div>
          </div>

          {/* 描述 */}
          <p className="border-y border-amber-800/30 py-3 font-serif text-sm leading-relaxed text-amber-900/90">
            {viewElement.description || '暂无描述，此元素由炼金术师偶然所得…'}
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
                  recipesAsOutput.map((r) => (
                    <RecipeMini key={r.id} recipe={r} elements={elements} onSelect={navigateTo} />
                  ))
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
                  recipesAsInput.map((r) => (
                    <RecipeMini key={r.id} recipe={r} elements={elements} onSelect={navigateTo} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex gap-2 border-t border-amber-800/30 bg-[#f5e6c8] px-4 py-3">
          <button
            onClick={() => {
              if (viewElement.relicId && onDeployRelic) {
                onDeployRelic(viewElement.relicId)
              } else {
                onAdd(viewElement)
              }
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

      {/* 大图模式 */}
      {showBigIcon && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setShowBigIcon(false)}
        >
          <span
            className="pointer-events-none flex h-72 w-72 items-center justify-center rounded-3xl border-2 border-amber-700/50 bg-gradient-to-b from-[#3a2512]/95 to-[#241608]/95 shadow-[0_0_60px_rgba(251,191,36,0.25)] sm:h-80 sm:w-80"
          >
            <CodexIcon svg={viewElement.svg} size={256} />
          </span>
          <div className="pointer-events-none text-center">
            <p className="font-serif text-2xl font-bold text-amber-100">{viewElement.name}</p>
            <p className="mt-1 font-mono text-xs text-amber-200/60">{viewElement.id}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowBigIcon(false)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-700/50 bg-amber-900/60 text-amber-100 transition-colors hover:bg-amber-900/90"
            aria-label="关闭大图"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export function ElementCodex({
  elements,
  recipes,
  categories,
  open,
  onClose,
  onAdd,
  relics,
  onDeployRelic,
}: ElementCodexProps) {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortMode, setSortMode] = useState<'time' | 'name'>('time')
  const [detailElement, setDetailElement] = useState<Element | null>(null)

  // 去重后的元素（图鉴以元素类型为单位，非实例）
  const uniqueElements = useMemo(() => {
    const map = new Map<string, Element>()
    for (const el of elements) {
      if (!map.has(el.id)) map.set(el.id, el)
    }
    return Array.from(map.values())
  }, [elements])

  // 配方解析列表：已解锁元素 + 秘宝模板（秘宝会作为配方输入出现）
  const recipeElements = useMemo(
    () => [...uniqueElements, ...(relics ?? [])],
    [uniqueElements, relics],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return uniqueElements
      .filter((e) => (categoryFilter === 'all' ? true : e.categoryId === categoryFilter))
      .filter((e) => {
        if (!q) return true
        return e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      })
      .sort((a, b) =>
        sortMode === 'time'
          ? (b.discoveredAt ?? b.createdAt ?? 0) - (a.discoveredAt ?? a.createdAt ?? 0)
          : a.name.localeCompare(b.name, 'zh-CN'),
      )
  }, [uniqueElements, search, categoryFilter, sortMode])

  if (!open) return null

  const detailCategory = detailElement
    ? categories.find((c) => c.id === detailElement.categoryId)
    : undefined

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        {/* 书封头 */}
        <div className="border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold tracking-widest">📖 元素图鉴 · 天地之书</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
          {/* 第二行：搜索 + 排序 */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* 搜索：默认只显示放大镜，点击后展开输入框 */}
            {searchOpen ? (
              <>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索元素..."
                  className="w-32 rounded-lg border border-amber-700/40 bg-[#fdf6e3] px-3 py-1.5 text-sm text-amber-950 placeholder-amber-700/50 outline-none focus:border-amber-500 sm:w-40"
                />
                <button
                  onClick={() => {
                    setSearch('')
                    setSearchOpen(false)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
                  title="关闭搜索"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
                title="搜索元素"
              >
                🔍
              </button>
            )}
            <div className="flex overflow-hidden rounded-lg border border-amber-700/40 bg-[#fdf6e3]">
              <button
                onClick={() => setSortMode('time')}
                className={`px-2 py-1.5 text-xs font-bold transition-colors ${
                  sortMode === 'time' ? 'bg-amber-400 text-amber-950' : 'text-amber-800 hover:bg-amber-200/60'
                }`}
                title="按发现时间排序（最近优先）"
              >
                最近发现
              </button>
              <button
                onClick={() => setSortMode('name')}
                className={`px-2 py-1.5 text-xs font-bold transition-colors ${
                  sortMode === 'name' ? 'bg-amber-400 text-amber-950' : 'text-amber-800 hover:bg-amber-200/60'
                }`}
                title="按名称排序"
              >
                按名称
              </button>
            </div>
          </div>
        </div>

        {/* 类别栏：可点击切换筛选 */}
        <div className="alchemy-scroll flex min-h-[56px] items-center gap-2 overflow-x-auto border-b border-amber-900/20 bg-[#8b5a2b]/90 px-4 py-2">
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
        <div className="alchemy-scroll flex-1 overflow-y-auto bg-[#f5e6c8] p-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-amber-800">
              <span className="text-5xl">📜</span>
              <p>图鉴中尚无此条目</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((el) => (
                <div
                  key={el.id}
                  className="flex flex-col items-center gap-1 rounded-lg border border-amber-800/30 bg-[#fdf6e3] p-1 shadow-sm transition-colors hover:border-amber-600 hover:shadow-md sm:flex-row sm:items-center sm:gap-2 sm:p-1.5"
                >
                  {/* 图标：窄屏=添加到桌面；宽屏=查看详情 */}
                  <button
                    onClick={() =>
                      window.matchMedia('(max-width: 639px)').matches ? onAdd(el) : setDetailElement(el)
                    }
                    className="shrink-0 rounded-md transition-transform hover:scale-105"
                    title={
                      window.matchMedia('(max-width: 639px)').matches
                        ? `添加「${el.name}」到桌面`
                        : `查看 ${el.name} 详情`
                    }
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-md bg-amber-100/70 sm:hidden">
                      <CodexIcon svg={el.svg} size={56} />
                    </span>
                    <span className="hidden h-20 w-20 items-center justify-center rounded-md bg-amber-100/70 sm:flex">
                      <CodexIcon svg={el.svg} size={72} />
                    </span>
                  </button>
                  {/* 名称（点击进入详情）+ ID + 左右按钮（仅宽屏） */}
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 sm:items-start">
                    <button
                      onClick={() => setDetailElement(el)}
                      className="line-clamp-2 break-words text-center font-serif text-sm font-semibold leading-tight text-amber-950 hover:text-amber-700 sm:text-left"
                      title={`查看 ${el.name} 详情`}
                    >
                      {el.name}
                    </button>
                    <span className="truncate font-mono text-[10px] text-amber-700/70">{el.id}</span>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      <button
                        onClick={() => onAdd(el)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-700/50 bg-amber-100 text-base font-bold text-amber-900 transition-colors hover:bg-amber-300 active:scale-95"
                        title="添加到桌面"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setDetailElement(el)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-700/50 bg-amber-100 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-300 active:scale-95"
                        title="查看详情"
                      >
                        i
                      </button>
                    </div>
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
          elements={recipeElements}
          categories={categories}
          onAdd={onAdd}
          onDeployRelic={onDeployRelic}
          onClose={() => setDetailElement(null)}
        />
      )}
    </div>
  )
}
