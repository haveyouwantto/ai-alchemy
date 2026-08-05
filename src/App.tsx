import { useCallback, useEffect, useRef, useState } from 'react'
import type { AIConfig, Element } from './types'
import { useWorkspace } from './hooks/useWorkspace'
import { Workspace } from './components/Workspace'
import { ElementCodex } from './components/ElementCodex'
import { HistoryPanel } from './components/HistoryPanel'
import { SettingsModal } from './components/SettingsModal'
import { CraftingOverlay } from './components/CraftingOverlay'
import { ToastContainer } from './components/Toast'
import type { ToastData } from './components/Toast'
import { Tutorial } from './components/Tutorial'

export default function App() {
  const ws = useWorkspace()
  const {
    elements,
    recipes,
    categories,
    unlockedElements,
    craftHistory,
    positions,
    setPositions,
    isCrafting,
    craft,
    exportWorkspace,
    importWorkspace,
    getExportFilename,
    duplicateElement,
    removeElementInstance,
    addElementFromLibrary,
    resetWorkspace,
    clearAllData,
    clearCraftHistory,
    stats,
  } = ws

  // ---- UI 状态 ----
  const [showCodex, setShowCodex] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [craftMessage, setCraftMessage] = useState('')
  const [craftInputs, setCraftInputs] = useState<Array<{ name: string; svg: string } | null>>([])
  const [streamText, setStreamText] = useState('')
  const [flashUids, setFlashUids] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastData[]>([])
  const toastId = useRef(0)

  // AI 配置（持久化到 localStorage）
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      const raw = localStorage.getItem('alchemy-ai-config')
      if (raw) {
        const parsed = JSON.parse(raw) as AIConfig
        return { baseURL: parsed.baseURL ?? '', apiKey: parsed.apiKey ?? '', model: parsed.model ?? 'gpt-4o-mini' }
      }
    } catch {
      // ignore
    }
    return { baseURL: '', apiKey: '', model: 'gpt-4o-mini' }
  })

  const saveAIConfig = useCallback((config: AIConfig) => {
    setAiConfig(config)
    try {
      localStorage.setItem('alchemy-ai-config', JSON.stringify(config))
    } catch {
      // ignore
    }
  }, [])

  // ---- Toast ----
  const pushToast = useCallback(
    (
      title: string,
      elementsData?: ToastData['elements'],
      kind: ToastData['kind'] = 'success',
      content?: string,
      hideObtainText?: boolean,
    ) => {
      toastId.current += 1
      const id = toastId.current
      setToasts((prev) => [...prev.slice(-3), { id, title, elements: elementsData, kind, content, hideObtainText }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5300)
    },
    [],
  )

  // ---- 合成 ----
  const handleCraft = useCallback(
    async (elementA: Element, elementB: Element) => {
      if (isCrafting) return
      // 记录合成中的元素（显示在贤者之石界面），并重置流式输出
      setCraftInputs([
        { name: elementA.name, svg: elementA.svg },
        { name: elementB.name, svg: elementB.svg },
      ])
      setStreamText('')
      setCraftMessage('贤者之石充能中...')
      // 预闪烁两张卡
      const flashKeys = new Set<string>()
      if (elementA.instanceUid) flashKeys.add(elementA.instanceUid)
      if (elementB.instanceUid) flashKeys.add(elementB.instanceUid)
      setFlashUids(flashKeys)
      setTimeout(() => setFlashUids(new Set()), 600)

      const outcome = await craft(
        elementA,
        elementB,
        aiConfig,
        setCraftMessage,
        (text) => setStreamText((prev) => prev + text),
        (text) => setStreamText((prev) => prev + text),
      )
      if (outcome.type === 'error') {
        setCraftInputs([])
        pushToast(`炼金术失灵：${outcome.message}`, undefined, 'error')
        return
      }
      // 明显的合成公式 Toast：输入 + 输出（新元素和已知元素都展示）
      const outcomeElements = [...outcome.added.map((e) => ({ name: e.name, svg: e.svg }))]
      const formulaTitle = `${elementA.name} + ${elementB.name} = ${
        outcomeElements.length > 0
          ? outcomeElements.map((e) => e.name).join('、')
          : outcome.known.join('、') || '？'
      }`
      pushToast(`⚗️ ${formulaTitle}`, outcomeElements, 'success')
      // AI 创造新元素：弹出「贤者低语」toast，展示新元素图标与说明
      if (outcome.type === 'ai' && outcome.newElements.length > 0) {
        for (const el of outcome.newElements) {
          pushToast(
            `✨ 新元素「${el.name}」真身显现`,
            [{ name: el.name, svg: el.svg }],
            'success',
            el.description || '贤者尚未留下笔墨……',
            true,
          )
        }
      }
      // 合成完成，清空合成元素展示
      setTimeout(() => setCraftInputs([]), 500)
    },
    [craft, isCrafting, aiConfig, pushToast],
  )

  // ---- 删除（需二次确认） ----
  const handleDelete = useCallback(
    (index: number) => {
      if (deleteConfirm !== index) {
        setDeleteConfirm(index)
        setTimeout(() => setDeleteConfirm((cur) => (cur === index ? null : cur)), 2500)
        pushToast('再次按 Delete 确认删除该元素', undefined, 'info')
        return
      }
      const el = elements[index]
      if (el) {
        removeElementInstance(index)
        setSelectedIndex(null)
        setDeleteConfirm(null)
        pushToast(`已删除：${el.name}`, undefined, 'info')
      }
    },
    [deleteConfirm, elements, removeElementInstance, pushToast],
  )

  // ---- 拖入垃圾桶删除实例（无需二次确认） ----
  const handleDeleteToTrash = useCallback(
    (index: number) => {
      const el = elements[index]
      if (!el) return
      removeElementInstance(index)
      setSelectedIndex(null)
      pushToast(`已丢弃：${el.name}`, undefined, 'info')
    },
    [elements, removeElementInstance, pushToast],
  )

  // ---- 从图鉴添加到桌面 ----
  const handleAddFromCodex = useCallback(
    (element: Element) => {
      addElementFromLibrary(element)
      pushToast(`已将「${element.name}」添加到桌面`, undefined, 'success')
    },
    [addElementFromLibrary, pushToast],
  )

  // ---- 双击复制 ----
  const handleDuplicate = useCallback(
    (element: Element) => {
      duplicateElement(element)
      pushToast(`已复制：${element.name}`, undefined, 'info')
    },
    [duplicateElement, pushToast],
  )

  // ---- 清空桌面 ----
  const [confirmClear, setConfirmClear] = useState(false)
  const handleClearWorkspace = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 2500)
      pushToast('再次点击「清空」确认重置桌面', undefined, 'info')
      return
    }
    setConfirmClear(false)
    resetWorkspace()
    setSelectedIndex(null)
    pushToast('桌面已重置', undefined, 'success')
  }, [confirmClear, resetWorkspace, pushToast])

  // ---- 导入 / 导出 ----
  const handleExport = useCallback(async () => {
    try {
      const blob = await exportWorkspace()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getExportFilename()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      pushToast('工作区已导出为 ZIP', undefined, 'success')
    } catch {
      pushToast('导出失败', undefined, 'error')
    }
  }, [exportWorkspace, getExportFilename, pushToast])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  const handleImportFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      const result = await importWorkspace(file)
      if (result.ok) {
        pushToast(result.message, undefined, 'success')
        setSelectedIndex(null)
      } else {
        pushToast(result.message, undefined, 'error')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [importWorkspace, pushToast],
  )

  // ---- 键盘快捷键 ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K → 元素图鉴
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCodex((v) => !v)
        return
      }
      // Ctrl/Cmd + H → 炼金记录
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setShowHistory((v) => !v)
        return
      }
      // Delete / Backspace → 删除选中
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndex !== null) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        handleDelete(selectedIndex)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, handleDelete])

  // 快捷按钮容器
  const ToolButton = ({
    onClick,
    disabled,
    active,
    title,
    children,
  }: {
    onClick: () => void
    disabled?: boolean
    active?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95',
        disabled
          ? 'cursor-not-allowed opacity-40'
          : active
            ? 'border border-amber-400 bg-gradient-to-b from-amber-400 to-amber-500 font-bold text-amber-950 shadow-[0_0_14px_rgba(251,191,36,0.45)]'
            : 'border border-amber-900/50 bg-stone-800/70 text-amber-100 hover:border-amber-700/70 hover:bg-stone-700/80 hover:text-amber-50',
      ].join(' ')}
    >
      {children}
    </button>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#160e08] text-amber-100">
      {/* 顶部状态栏 */}
      <div className="border-b-2 border-amber-900/40 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 shadow-[0_1px_0_rgba(255,200,100,0.08)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <h1 className="mr-auto flex items-center gap-2 font-serif text-base font-bold tracking-wide text-amber-300 sm:text-lg">
            <span className="text-2xl">⚗️</span>
            <span className="hidden sm:inline">AI 炼金术工坊</span>
            <span className="sm:hidden">炼金工坊</span>
            <span className="text-lg opacity-80" title="油灯长明">🪔</span>
          </h1>

          {/* 功能按钮 */}
          <ToolButton onClick={() => setShowCodex(true)} title="元素图鉴 (Ctrl+K)" active>
            <span className="text-lg leading-none">📚</span>
            <span className="hidden sm:inline">图鉴</span>
            <span className="rounded-full bg-amber-400/20 px-1.5 text-xs font-bold text-amber-300">
              {stats.uniqueCount}
            </span>
          </ToolButton>
          <ToolButton onClick={() => setShowHistory(true)} title="炼金记录 (Ctrl+H)" active={showHistory}>
            <span className="text-lg leading-none">📜</span>
            <span className="hidden sm:inline">记录</span>
            <span className="rounded-full bg-amber-400/20 px-1.5 text-xs font-bold text-amber-300">
              {craftHistory.length}
            </span>
          </ToolButton>
          <ToolButton onClick={handleExport} title="导出工作区 (ZIP)">
            <span className="text-lg leading-none">💾</span>
            <span className="hidden md:inline">导出</span>
          </ToolButton>
          <ToolButton onClick={handleImportClick} title="导入工作区 (ZIP)">
            <span className="text-lg leading-none">📂</span>
            <span className="hidden md:inline">导入</span>
          </ToolButton>
          <ToolButton onClick={handleClearWorkspace} title="清空桌面" active={confirmClear}>
            <span className="text-lg leading-none">🧹</span>
            <span className="hidden md:inline">{confirmClear ? '确认清空？' : '清空桌面'}</span>
          </ToolButton>
          <ToolButton onClick={() => setShowSettings(true)} title="AI 设置">
            <span className="text-lg leading-none">⚙️</span>
            <span className="hidden md:inline">AI 设置</span>
            {!aiConfig.baseURL && <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />}
          </ToolButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* 工作区 */}
      <Workspace
        elements={elements}
        selectedIndex={selectedIndex}
        flashUids={flashUids}
        positions={positions}
        onPositionsChange={setPositions}
        onSelect={setSelectedIndex}
        onCraft={handleCraft}
        onDuplicate={handleDuplicate}
        onOpenLibrary={() => setShowCodex(true)}
        onDeleteToTrash={handleDeleteToTrash}
      />

      {/* 底部提示条 */}
      <div className="border-t-2 border-amber-900/40 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 px-3 py-1.5 text-center text-xs text-amber-200/70">
        <span className="hidden sm:inline">拖拽卡片到另一张上合成 · 拖到空白可移动 · 双击复制 · Ctrl+K 图鉴 · 选中后 Delete 删除</span>
        <span className="sm:hidden">拖拽卡片合成或移动 · 长按拖拽</span>
      </div>

      {/* Modal 层 */}
      <ElementCodex
        elements={unlockedElements}
        recipes={recipes}
        categories={categories}
        open={showCodex}
        onClose={() => setShowCodex(false)}
        onAdd={handleAddFromCodex}
      />
      <HistoryPanel
        history={craftHistory}
        recipes={recipes}
        elements={unlockedElements}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onClear={() => {
          clearCraftHistory()
          pushToast('炼金记录已清空', undefined, 'info')
        }}
      />
      <SettingsModal
        open={showSettings}
        config={aiConfig}
        onSave={saveAIConfig}
        onClose={() => setShowSettings(false)}
        onClearAllData={() => {
          // 仅清除世界数据（元素/配方/类别/图鉴），AI 配置（Endpoint/API Key/模型）独立保留
          clearAllData()
          setSelectedIndex(null)
          pushToast('世界已重置为初始状态，AI 配置保留', undefined, 'success')
        }}
      />

      {/* 合成加载弹窗（贤者之石 + 合成元素 + AI 流式输出） */}
      <CraftingOverlay
        show={isCrafting}
        message={craftMessage}
        inputs={craftInputs}
        streamText={streamText}
      />

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} />

      {/* 首次引导 */}
      <Tutorial />
    </div>
  )
}
