import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AIConfig, Element, Recipe } from './types'
import { ACHIEVEMENTS, RELIC_PROMPTS, RELIC_TEMPLATES } from './constants'
import { useWorkspace } from './hooks/useWorkspace'
import { AchievementsModal } from './components/AchievementsModal'
import { Workspace } from './components/Workspace'
import { ElementCodex } from './components/ElementCodex'
import { RelicCodex } from './components/RelicCodex'
import { TransmuteModal } from './components/TransmuteModal'
import { RelicConfirmModal } from './components/RelicConfirmModal'
import { NewElementReveal, type RevealItem } from './components/NewElementReveal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HelpModal } from './components/HelpModal'
import { Tutorial } from './components/Tutorial'

import { HistoryPanel } from './components/HistoryPanel'
import { SettingsModal } from './components/SettingsModal'
import { CraftingOverlay } from './components/CraftingOverlay'
import { ToastContainer } from './components/Toast'
import type { ToastData } from './components/Toast'

export default function App() {
  // ---- Toast（需在 useWorkspace 之前定义，供成就达成回调使用） ----
  const toastId = useRef(0)
  const [toasts, setToasts] = useState<ToastData[]>([])
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

  const ws = useWorkspace({
    onAchievementComplete: (list) => {
      for (const a of list) {
        const reward = Object.entries(a.reward)
          .map(([rid, n]) => `${RELIC_TEMPLATES.find((t) => t.relicId === rid)?.name ?? rid}×${n}`)
          .join('、')
        pushToast(`🏆 成就达成：${a.name}`, undefined, 'success', reward ? `奖励秘宝：${reward}` : undefined)
      }
    },
    onRelicAward: (awards) => {
      for (const a of awards) {
        const t = RELIC_TEMPLATES.find((r) => r.relicId === a.relicId)
        if (!t) continue
        pushToast(`🏺 秘宝降临：${t.name} ×${a.count}`, [{ name: t.name, svg: t.svg }], 'success')
      }
    },
  })
  const {
    elements,
    recipes,
    categories,
    unlockedElements,
    craftHistory,
    positions,
    setPositions,
    relics,
    achievements,
    newElementCount,
    isCrafting,
    craft,
    transmutePoint,
    exportWorkspace,
    importWorkspace,
    getExportFilename,
    duplicateElement,
    removeElementInstance,
    addElementFromLibrary,
    addElementInstances,
    deployRelic,
    refundRelic,
    resetWorkspace,
    clearAllData,
    clearCraftHistory,
    stats,
  } = ws

  // ---- UI 状态 ----
  const [showCodex, setShowCodex] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRelics, setShowRelics] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  /** 减法模式：A−B 有序合成（合成 150 个元素后解锁） */
  const [subtractMode, setSubtractMode] = useState(false)
  /** 减法模式解锁时的箭头教程 */
  const [subtractHint, setSubtractHint] = useState(false)
  const SUBTRACT_HINT_KEY = 'alchemy-subtract-hint-seen'
  const subtractUnlocked = (newElementCount ?? 0) >= 150

  // 解锁减法模式时展示一次箭头说明
  useEffect(() => {
    if (!subtractUnlocked) return
    let seen = false
    try {
      seen = localStorage.getItem(SUBTRACT_HINT_KEY) === '1'
    } catch {
      // ignore
    }
    if (seen) return
    setSubtractHint(true)
    const t = setTimeout(() => {
      setSubtractHint(false)
      try {
        localStorage.setItem(SUBTRACT_HINT_KEY, '1')
      } catch {
        // ignore
      }
    }, 6000)
    return () => clearTimeout(t)
  }, [subtractUnlocked])

  const toggleSubtract = useCallback(() => {
    if (!subtractUnlocked) return
    setSubtractMode((v) => !v)
    setSubtractHint(false)
    try {
      localStorage.setItem(SUBTRACT_HINT_KEY, '1')
    } catch {
      // ignore
    }
  }, [subtractUnlocked])
  /** 赤化点化：待提交说服文本（relic=赤化，element=被点化元素） */
  const [pendingTransmute, setPendingTransmute] = useState<{ relic: Element; element: Element } | null>(null)
  /** 秘宝使用二次确认（含重复使用警告） */
  const [pendingRelicConfirm, setPendingRelicConfirm] = useState<{
    relic: Element
    element: Element
    prevRecipe: Recipe | null
  } | null>(null)
  /** 地图加载失败后的重试次数（作为错误边界 key，重置子树） */
  const [mapRetry, setMapRetry] = useState(0)
  /** 新元素发现动画队列（依次播放：中央金光 → 飞向新卡） */
  const [revealQueue, setRevealQueue] = useState<RevealItem[]>([])
  // 世界地图按需懒加载；重试版本变化时重建组件
  const WorldMap = useMemo(
    () => lazy(() => import('./components/WorldMap').then((m) => ({ default: m.WorldMap }))),
    [mapRetry],
  )
  /** 整理桌面请求版本号（每次 +1 触发工作区平铺） */
  const [tidyVersion, setTidyVersion] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [craftMessage, setCraftMessage] = useState('')
  const [craftInputs, setCraftInputs] = useState<Array<{ name: string; svg: string } | null>>([])
  const [streamText, setStreamText] = useState('')
  const [flashUids, setFlashUids] = useState<Set<string>>(new Set())

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

  // ---- 合成（实际执行） ----
  const executeCraft = useCallback(
    async (elementA: Element, elementB: Element) => {
      if (isCrafting) return
      // 记录合成中的元素（显示在贤者之石界面），并重置流式输出
      setCraftInputs([
        { name: elementA.name, svg: elementA.svg },
        { name: elementB.name, svg: elementB.svg },
      ])
      setStreamText('')
      setCraftMessage('正在搅拌中...')
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
        // 秘宝参与 → 使用该秘宝专属提示词（拆解模式）
        (elementA.relicId ?? elementB.relicId)
          ? RELIC_PROMPTS[(elementA.relicId ?? elementB.relicId)!]
          : undefined,
        undefined,
        // 减法模式仅对普通合成生效（秘宝反应不参与）
        !(elementA.relicId ?? elementB.relicId) && subtractMode,
      )
      if (outcome.type === 'error') {
        setCraftInputs([])
        pushToast(`炼金术失灵：${outcome.message}`, undefined, 'error')
        return
      }
      if (outcome.type === 'refused') {
        setCraftInputs([])
        pushToast(`贤者拒绝了这次请求：${outcome.message}`, undefined, 'error')
        return
      }
      // 明显的合成公式 Toast：输入 + 输出（新元素和已知元素都展示）
      const outcomeElements = [...outcome.added.map((e) => ({ name: e.name, svg: e.svg }))]
      const op = !(elementA.relicId ?? elementB.relicId) && subtractMode ? ' − ' : ' + '
      const formulaTitle = `${elementA.name}${op}${elementB.name} = ${
        outcomeElements.length > 0
          ? outcomeElements.map((e) => e.name).join('、')
          : outcome.known.join('、') || '？'
      }`
      pushToast(`⚗️ ${formulaTitle}`, outcomeElements, 'success')
      // AI 创造新元素：屏幕中央放大闪金光 → 缩小飞向工作区的新卡片
      if (outcome.type === 'ai' && outcome.newElements.length > 0) {
        const items: RevealItem[] = outcome.newElements.map((el) => {
          const inst = outcome.added.find((a) => a.id === el.id)
          return { id: el.id, name: el.name, svg: el.svg, instanceUid: inst?.instanceUid }
        })
        setRevealQueue((q) => [...q, ...items])
      }
      // 秘宝奖励：合成出足够多的新元素后获得黑化
      if (outcome.type === 'ai' && outcome.relicReward && outcome.relicReward > 0) {
        pushToast(`🏺 秘宝奖励 +${outcome.relicReward}：合成出新的元素后，黑化秘宝降临`, undefined, 'success')
      }
      // 合成完成，清空合成元素展示
      setTimeout(() => setCraftInputs([]), 500)
    },
    [craft, isCrafting, aiConfig, pushToast, subtractMode],
  )

  // ---- 合成入口：秘宝参与时先二次确认 ----
  const handleCraft = useCallback(
    (elementA: Element, elementB: Element) => {
      if (isCrafting) return
      const relicId = elementA.relicId ?? elementB.relicId
      if (!relicId) {
        executeCraft(elementA, elementB)
        return
      }
      const relic = elementA.relicId ? elementA : elementB
      const elem = elementA.relicId ? elementB : elementA
      // 是否已保存过该组合的配方（命中则展示配方警告）
      const prevRecipe =
        recipes.find(
          (r) =>
            (r.inputA === relic.id && r.inputB === elem.id) ||
            (r.inputA === elem.id && r.inputB === relic.id),
        ) ?? null
      setPendingRelicConfirm({ relic, element: elem, prevRecipe })
    },
    [isCrafting, executeCraft, recipes],
  )

  // ---- 秘宝使用确认 ----
  const confirmRelicUse = useCallback(() => {
    if (!pendingRelicConfirm) return
    const { relic, element } = pendingRelicConfirm
    setPendingRelicConfirm(null)
    if (relic.relicId === 'rubedo') {
      setPendingTransmute({ relic, element })
      return
    }
    executeCraft(relic, element)
  }, [pendingRelicConfirm, executeCraft])

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
        if (el.relicId) refundRelic(el.instanceUid ?? '')
        removeElementInstance(index)
        setSelectedIndex(null)
        setDeleteConfirm(null)
        pushToast(el.relicId ? `已移除：${el.name}（秘宝已返还仓库）` : `已删除：${el.name}`, undefined, 'info')
      }
    },
    [deleteConfirm, elements, removeElementInstance, refundRelic, pushToast],
  )

  // ---- 拖入垃圾桶删除实例（无需二次确认） ----
  const handleDeleteToTrash = useCallback(
    (index: number) => {
      const el = elements[index]
      if (!el) return
      if (el.relicId) refundRelic(el.instanceUid ?? '')
      removeElementInstance(index)
      setSelectedIndex(null)
      pushToast(el.relicId ? `已丢弃：${el.name}（秘宝已返还仓库）` : `已丢弃：${el.name}`, undefined, 'info')
    },
    [elements, removeElementInstance, refundRelic, pushToast],
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
      if (element.relicId) {
        pushToast('秘宝为消耗品，无法复制', undefined, 'info')
        return
      }
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
    // 清空桌面：桌面上的秘宝全部返还仓库
    for (const el of elements) {
      if (el.relicId) refundRelic(el.instanceUid ?? '')
    }
    resetWorkspace()
    setSelectedIndex(null)
    pushToast('桌面已重置', undefined, 'success')
  }, [confirmClear, elements, refundRelic, resetWorkspace, pushToast])

  // ---- 整理桌面：平铺所有卡片 ----
  const handleTidyWorkspace = useCallback(() => {
    setTidyVersion((v) => v + 1)
    setSelectedIndex(null)
    pushToast('桌面已整理，卡片已平铺', undefined, 'info')
  }, [pushToast])

  // ---- 秘宝：部署到桌面（库存 -1） ----
  const handleDeployRelic = useCallback(
    (relicId: string) => {
      const relic = RELIC_TEMPLATES.find((r) => r.relicId === relicId)
      const inst = deployRelic(relicId)
      if (inst && relic) {
        pushToast(`已将「${relic.name}」放置到桌面，库存 -1`, [{ name: relic.name, svg: relic.svg }], 'success')
      } else {
        pushToast('秘宝库存不足', undefined, 'error')
      }
    },
    [deployRelic, pushToast],
  )

  // ---- 赤化点化：提交说服文本，AI 裁决 ----
  const handleTransmute = useCallback(
    async (request: string) => {
      if (!pendingTransmute) return
      const { relic, element } = pendingTransmute
      setPendingTransmute(null)
      if (isCrafting) return
      setCraftInputs([
        { name: relic.name, svg: relic.svg },
        { name: element.name, svg: element.svg },
      ])
      setStreamText('')
      setCraftMessage('赤化点化中...')
      const flashKeys = new Set<string>()
      if (relic.instanceUid) flashKeys.add(relic.instanceUid)
      if (element.instanceUid) flashKeys.add(element.instanceUid)
      setFlashUids(flashKeys)
      setTimeout(() => setFlashUids(new Set()), 600)

      const outcome = await transmutePoint(
        relic,
        element,
        request,
        aiConfig,
        setCraftMessage,
        (text) => setStreamText((prev) => prev + text),
        (text) => setStreamText((prev) => prev + text),
      )
      if (outcome.type === 'refused') {
        setCraftInputs([])
        pushToast(`贤者拒绝了点化：${outcome.message}`, undefined, 'error')
        return
      }
      if (outcome.type === 'error') {
        setCraftInputs([])
        pushToast(`点化失灵：${outcome.message}`, undefined, 'error')
        return
      }
      const outcomeElements = outcome.added.map((e) => ({ name: e.name, svg: e.svg }))
      pushToast(
        `🔮 点化应允：${element.name} 化为 ${outcomeElements.map((e) => e.name).join('、')}`,
        outcomeElements,
        'success',
      )
      if (outcome.type === 'ai' && outcome.newElements.length > 0) {
        for (const el of outcome.newElements) {
          pushToast(
            `✨ 新元素「${el.name}」显现`,
            [{ name: el.name, svg: el.svg }],
            'success',
            el.description || undefined,
            true,
          )
        }
      }
      setTimeout(() => setCraftInputs([]), 500)
    },
    [pendingTransmute, isCrafting, transmutePoint, aiConfig, pushToast],
  )

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
      // 输入框/文本框/可编辑区域内不响应单键快捷键
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      // 单键快捷键：E/Z 图鉴 · X 记录 · C 秘宝 · V 地图 · B 成就 · R 整理 · L 清空
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'e':
          case 'z':
            setShowCodex(true)
            return
          case 'x':
            setShowHistory(true)
            return
          case 'c':
            setShowRelics(true)
            return
          case 'v':
            setShowMap(true)
            return
          case 'b':
            setShowAchievements(true)
            return
          case 'r':
            handleTidyWorkspace()
            return
          case 'l':
            handleClearWorkspace()
            return
        }
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
  }, [selectedIndex, handleDelete, handleTidyWorkspace, handleClearWorkspace])

  // 快捷按钮容器：上大图标 + 下小字，数字徽章为右上角小黄点
  // 页面重新可见时强制整页重排重绘，确保内容完整上屏
  useEffect(() => {
    const forceRepaint = () => {
      const root = document.getElementById('root')
      if (!root) return
      root.style.display = 'none'
      // 强制同步 reflow，确保浏览器重新合成整页
      void root.offsetHeight
      root.style.display = ''
      window.dispatchEvent(new Event('resize'))
    }
    const onVisibility = () => {
      if (!document.hidden) forceRepaint()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache/页面恢复时同样强制重绘
      if (e.persisted) forceRepaint()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  const ToolButton = ({
    onClick,
    disabled,
    active,
    title,
    badge,
    dot,
    label,
    children,
  }: {
    onClick: () => void
    disabled?: boolean
    active?: boolean
    title: string
    badge?: number
    dot?: boolean
    label: string
    children: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all active:scale-95',
        disabled
          ? 'cursor-not-allowed opacity-40'
          : active
            ? 'border border-amber-400 bg-gradient-to-b from-amber-400 to-amber-500 font-bold text-amber-950 shadow-[0_0_14px_rgba(251,191,36,0.45)]'
            : 'border border-amber-800/50 bg-[#4a2e16]/80 text-amber-100 hover:border-amber-600/70 hover:bg-[#5d3a1c]/80 hover:text-amber-50',
      ].join(' ')}
    >
      <span className="relative leading-none">
        <span className="block text-xl leading-none">{children}</span>
        {badge !== undefined && (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 px-0.5 text-[10px] font-bold leading-none text-amber-950 shadow-[0_0_6px_rgba(251,191,36,0.55)]">
            {badge}
          </span>
        )}
        {dot && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-red-400" />}
      </span>
      <span className="font-serif leading-none">{label}</span>
    </button>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#241508] text-amber-100">
      {/* 顶部状态栏 */}
      <div className="border-b-2 border-amber-900/40 bg-gradient-to-r from-[#3a2512] via-[#4a2e16] to-[#2b1a0d] shadow-[0_1px_0_rgba(255,200,100,0.12)]">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-2 py-1.5 sm:px-3">
          <h1 className="mr-1 flex shrink-0 items-center gap-1.5 font-serif text-sm font-bold tracking-wide text-amber-300 sm:text-base">
            <span className="text-xl">⚗️</span>
            <span className="hidden sm:inline">AI 炼金术工坊</span>
            <span className="sm:hidden">炼金工坊</span>
          </h1>

          {/* 功能按钮栏：单行、贴右，可左右滚动 */}
          <div className="alchemy-scroll flex min-w-0 flex-1 overflow-x-auto py-0.5">
            <div className="ml-auto flex w-max items-stretch gap-1 pl-1">
            <ToolButton
              onClick={() => setShowCodex(true)}
              title="元素图鉴 (Ctrl+K)"
              badge={stats.uniqueCount}
              label="图鉴"
              active
            >
              📚
            </ToolButton>
            <ToolButton
              onClick={() => setShowHistory(true)}
              title="炼金记录 (Ctrl+H)"
              badge={craftHistory.length}
              label="记录"
              active={showHistory}
            >
              📜
            </ToolButton>
            <ToolButton
              onClick={() => setShowRelics(true)}
              title="秘宝录：消耗品，用一次少一个"
              badge={Object.values(relics).reduce((sum, n) => sum + n, 0)}
              label="秘宝"
              active={showRelics}
            >
              🏺
            </ToolButton>
            <ToolButton
              onClick={() => setShowMap(true)}
              title="世界地图：元素关系可视化"
              label="地图"
              active={showMap}
            >
              🗺️
            </ToolButton>
            <ToolButton
              onClick={() => setShowAchievements(true)}
              title="成就"
              badge={Object.keys(achievements).length}
              label="成就"
              active={showAchievements}
            >
              🏆
            </ToolButton>
            <ToolButton onClick={handleExport} title="导出工作区 (ZIP)" label="导出">
              💾
            </ToolButton>
            <ToolButton onClick={handleImportClick} title="导入工作区 (ZIP)" label="导入">
              📂
            </ToolButton>
            <ToolButton onClick={handleTidyWorkspace} title="整理桌面：平铺所有卡片" label="整理">
              🗂️
            </ToolButton>
            <ToolButton
              onClick={handleClearWorkspace}
              title="清空桌面"
              label={confirmClear ? '确认清空？' : '清空桌面'}
              active={confirmClear}
            >
              🧹
            </ToolButton>
            <ToolButton
              onClick={() => setShowSettings(true)}
              title="AI 设置"
              label="AI 设置"
              dot={!aiConfig.baseURL}
            >
              ⚙️
            </ToolButton>
            <ToolButton onClick={() => setShowHelp(true)} title="游戏说明" label="说明">
              ❓
            </ToolButton>
            </div>
          </div>
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
        onAddBasics={(instances) => {
          addElementInstances(instances)
          pushToast(
            `已召唤：${instances.map((e) => e.name).join('、')}`,
            instances.map((e) => ({ name: e.name, svg: e.svg })),
            'success',
          )
        }}
        tidyVersion={tidyVersion}
        onSelect={setSelectedIndex}
        onCraft={handleCraft}
        onDuplicate={handleDuplicate}
        onOpenLibrary={() => setShowCodex(true)}
        onDeleteToTrash={handleDeleteToTrash}
        subtractMode={subtractMode}
        subtractUnlocked={subtractUnlocked}
        onToggleSubtract={toggleSubtract}
        showSubtractHint={subtractHint}
        onSubtractHintSeen={() => {
          setSubtractHint(false)
          try {
            localStorage.setItem(SUBTRACT_HINT_KEY, '1')
          } catch {
            // ignore
          }
        }}
      />

      {/* Modal 层 */}
      <ElementCodex
        elements={unlockedElements}
        recipes={recipes}
        categories={categories}
        open={showCodex}
        onClose={() => setShowCodex(false)}
        onAdd={handleAddFromCodex}
        relics={RELIC_TEMPLATES}
        onDeployRelic={handleDeployRelic}
      />
      <HistoryPanel
        history={craftHistory}
        recipes={recipes}
        elements={[...unlockedElements, ...RELIC_TEMPLATES]}
        categories={categories}
        onAdd={handleAddFromCodex}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onClear={() => {
          clearCraftHistory()
          pushToast('炼金记录已清空', undefined, 'info')
        }}
      />
      <RelicCodex
        relics={RELIC_TEMPLATES}
        counts={relics}
        recipes={recipes}
        elements={unlockedElements}
        open={showRelics}
        onClose={() => setShowRelics(false)}
        onDeploy={handleDeployRelic}
      />
      <AchievementsModal
        achievements={ACHIEVEMENTS}
        completed={achievements}
        unlockedCount={unlockedElements.length}
        categoryCount={categories.length}
        recipeCount={recipes.length}
        unlockedIds={unlockedElements.map((e) => e.id)}
        unlockedElements={unlockedElements}
        recipes={recipes}
        elements={[...unlockedElements, ...RELIC_TEMPLATES]}
        categories={categories}
        onAdd={handleAddFromCodex}
        onDeployRelic={handleDeployRelic}
        open={showAchievements}
        onClose={() => setShowAchievements(false)}
      />
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      {showMap && (
        <ErrorBoundary
          key={mapRetry}
          fallback={
            <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
              <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-amber-700/40 bg-[#8b5a2b] p-6 text-center shadow-2xl">
                <span className="text-4xl">🗺️</span>
                <p className="font-serif text-lg font-bold text-amber-100">世界地图未能展开</p>
                <p className="text-xs leading-relaxed text-amber-200/70">
                  地图加载失败，可能是网络波动或浏览器兼容问题。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMapRetry((v) => v + 1)}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-sm font-bold text-amber-950 transition-all hover:brightness-110 active:scale-95"
                  >
                    重试
                  </button>
                  <button
                    onClick={() => setShowMap(false)}
                    className="rounded-xl border border-amber-800/40 bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-200"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowMap(false)} />
                <div className="relative z-10 flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
                  <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
                    <h2 className="font-serif text-xl font-bold tracking-widest">🗺️ 世界地图</h2>
                    <button
                      onClick={() => setShowMap(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
                      aria-label="关闭"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#f5e6c8] text-amber-800">
                    <span className="animate-pulse text-5xl">🗺️</span>
                    <p className="font-serif font-bold">正在展开世界地图...</p>
                  </div>
                </div>
              </div>
            }
          >
            <WorldMap
              elements={unlockedElements}
              recipes={recipes}
              categories={categories}
              onAdd={handleAddFromCodex}
              open
              onClose={() => setShowMap(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
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

      {/* 秘宝使用二次确认（消耗 + 重复使用警告） */}
      {pendingRelicConfirm && (
        <RelicConfirmModal
          relic={pendingRelicConfirm.relic}
          element={pendingRelicConfirm.element}
          prevRecipe={pendingRelicConfirm.prevRecipe}
          elements={[...unlockedElements, ...RELIC_TEMPLATES]}
          onConfirm={confirmRelicUse}
          onClose={() => setPendingRelicConfirm(null)}
        />
      )}

      {/* 赤化点化：说服弹窗 */}
      {pendingTransmute && (
        <TransmuteModal
          relic={pendingTransmute.relic}
          element={pendingTransmute.element}
          onClose={() => setPendingTransmute(null)}
          onSubmit={handleTransmute}
        />
      )}

      {/* 合成加载弹窗（贤者之石 + 合成元素 + AI 流式输出） */}
      <CraftingOverlay
        show={isCrafting}
        message={craftMessage}
        inputs={craftInputs}
        streamText={streamText}
      />

      {/* 新元素发现动画：中央金光 → 飞向新卡 */}
      {revealQueue.length > 0 && (
        <NewElementReveal
          key={revealQueue[0].instanceUid ?? revealQueue[0].id}
          item={revealQueue[0]}
          onFinished={() => setRevealQueue((q) => q.slice(1))}
        />
      )}

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} />

      {/* 首次引导 */}
      <Tutorial />
    </div>
  )
}
