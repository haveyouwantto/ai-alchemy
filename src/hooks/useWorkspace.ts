import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import type {
  AIConfig,
  CardPosition,
  ChatMessage,
  CraftElementsArgs,
  CraftHistoryEntry,
  CraftRecipeArgs,
  CreateCategoryArgs,
  Element,
  ElementCategory,
  Recipe,
  Workspace,
} from '../types'
import { DEFAULT_CATEGORY_ID, FUNCTIONS, INITIAL_ELEMENTS, INITIAL_WORKSPACE, SYSTEM_PROMPT_TEMPLATE } from '../constants'
import {
  DECOMPOSE_SYSTEM_PROMPT,
  INITIAL_RELIC_COUNTS,
  RELIC_REWARD_NEW_ELEMENTS,
  RELIC_PROMPTS,
  RELIC_TEMPLATES,
} from '../constants'
import { parseToolArguments, streamChatCompletion } from '../aiClient'
import { sanitizeSVG, uuid } from '../utils'

/** AI 多轮工具调用的最大轮数 */
const MAX_AI_ROUNDS = 10

/** 合成结果类型 */
export type CraftOutcome =
  | { type: 'local'; added: Element[]; known: string[] }
  | {
      type: 'ai'
      added: Element[]
      known: string[]
      newCount: number
      recipeCount: number
      /** 本次 AI 新创建的元素（仅真正新建的，未重复已有） */
      newElements: Element[]
      /** 本次合成奖励的秘宝数量（每合成 10 个新元素 +1 黑化） */
      relicReward?: number
      /** 炼金术笔记（流式思考文本） */
      note?: string
    }
  | { type: 'error'; message: string }

interface StateRef {
  elements: Element[]
  recipes: Recipe[]
  categories: ElementCategory[]
  unlockedElements: Element[]
  craftHistory: CraftHistoryEntry[]
  positions: Record<string, CardPosition>
  relics: Record<string, number>
  newElementCount: number
}

const STORAGE_KEY = 'alchemy-workspace-data'

/** 旧拼音类别 ID → 英文 ID 迁移映射 */
const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  tian_di_wan_xiang: 'cosmos',
}

/** 存档中桌面的紧凑元素引用：只存元素 id + 实例 uid + 位置（px，相对工作区容器左上角） */
interface StoredElementRef {
  instanceUid?: string
  id: string
  x?: number
  y?: number
  relicId?: string
}

interface StoredWorkspace {
  elements: Element[]
  recipes: Recipe[]
  categories: ElementCategory[]
  /** 已解锁的元素类型库（图鉴数据源，独立于工作区实例，不会被消耗删除） */
  unlockedElements: Element[]
  /** 合成触发流水（最近 50 条） */
  craftHistory: CraftHistoryEntry[]
  /** 桌面卡片坐标（key=instanceUid，单位 px，相对工作区容器左上角） */
  positions?: Record<string, CardPosition>
  /** 秘宝库存（key=秘宝 id） */
  relics?: Record<string, number>
  /** 累计合成出的新元素数量（用于秘宝奖励） */
  newElementCount?: number
}

/**
 * 从 localStorage 加载持久化的工作区数据。
 * 兼容旧数据：无 categories/description/unlockedElements 时补默认；旧拼音类别 ID 迁移为英文 ID。
 * 桌面元素支持两种格式：
 * - 新格式：紧凑引用 { instanceUid, id, x, y }，加载时用图鉴模板还原完整元素；
 * - 旧格式：完整元素对象（含 svg/description 等冗余字段）。
 */
function loadStoredWorkspace(): StoredWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Workspace> & {
        unlockedElements?: Element[]
        craftHistory?: CraftHistoryEntry[]
        positions?: Record<string, CardPosition>
        relics?: Record<string, number>
        newElementCount?: number
      }
      if (Array.isArray(parsed.elements) && Array.isArray(parsed.recipes)) {
        // 仅迁移类别 ID（元素 ID 不迁移：wind 等 ID 让 AI 自由创建「风」）
        const migId = (id: string) => LEGACY_CATEGORY_ID_MAP[id] ?? id
        const categories = Array.isArray(parsed.categories)
          ? parsed.categories.map((c) => ({ ...c, id: migId(c.id) }))
          : INITIAL_WORKSPACE.categories
        const rawElements = parsed.elements as unknown as Array<Record<string, unknown>>
        // 新格式没有 svg 字段 → 紧凑引用；旧格式每项都是完整元素
        const isCompact = rawElements.length > 0 && !('svg' in rawElements[0])

        // 已解锁元素库：优先读存档；缺省时从当前实例推导（保证图鉴不因消耗而丢失元素）
        let unlockedElements: Element[]
        if (Array.isArray(parsed.unlockedElements) && parsed.unlockedElements.length > 0) {
          unlockedElements = parsed.unlockedElements.map((e) => ({
            ...e,
            categoryId: e.categoryId ? migId(e.categoryId) : DEFAULT_CATEGORY_ID,
          }))
        } else if (isCompact) {
          // 紧凑存档缺图鉴时兜底为基础元素
          unlockedElements = [...INITIAL_WORKSPACE.elements]
        } else {
          const map = new Map<string, Element>()
          for (const e of parsed.elements) map.set(e.id, e)
          unlockedElements = Array.from(map.values())
        }

        // 模板索引：图鉴优先，基础元素兜底（保证桌面 id 总能还原）
        const templateMap = new Map<string, Element>()
        for (const t of unlockedElements) templateMap.set(t.id, t)
        for (const t of INITIAL_ELEMENTS) {
          if (!templateMap.has(t.id)) templateMap.set(t.id, t)
        }
        // 秘宝模板：桌面上的秘宝卡片同样按 id 还原
        for (const t of RELIC_TEMPLATES) {
          if (!templateMap.has(t.id)) templateMap.set(t.id, t)
        }

        let elements: Element[]
        const positions: Record<string, CardPosition> = {}
        if (isCompact) {
          // 新格式：按引用还原完整元素，位置随引用保存
          elements = []
          for (const ref of parsed.elements as StoredElementRef[]) {
            if (!ref || typeof ref.id !== 'string') continue
            const template = templateMap.get(ref.id)
            if (!template) continue
            const instanceUid = ref.instanceUid ?? uuid()
            elements.push({ ...template, instanceUid, ...(ref.relicId ? { relicId: ref.relicId } : {}) })
            if (Number.isFinite(ref.x) && Number.isFinite(ref.y)) {
              positions[instanceUid] = { x: ref.x as number, y: ref.y as number }
            }
          }
        } else {
          // 旧格式：完整元素 + 独立位置表
          elements = parsed.elements.map((e) => ({
            ...e,
            categoryId: e.categoryId ? migId(e.categoryId) : DEFAULT_CATEGORY_ID,
          }))
          if (parsed.positions && typeof parsed.positions === 'object') {
            for (const [key, value] of Object.entries(parsed.positions)) {
              if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
                positions[key] = { x: value.x, y: value.y }
              }
            }
          }
        }

        return {
          elements,
          recipes: parsed.recipes,
          categories,
          unlockedElements,
          // 历史记录：仅保留合法条目（无数量限制，配合前端分页展示）
          craftHistory: Array.isArray(parsed.craftHistory)
            ? parsed.craftHistory.filter(
                (h) =>
                  h && typeof h.id === 'string' && typeof h.timestamp === 'number' && typeof h.recipeId === 'string',
              )
            : [],
          positions,
          // 秘宝库存：仅保留非负整数
          relics: (() => {
            const relics: Record<string, number> = {}
            if (parsed.relics && typeof parsed.relics === 'object') {
              for (const [key, value] of Object.entries(parsed.relics)) {
                const n = Number(value)
                if (Number.isFinite(n) && n >= 0) relics[key] = Math.floor(n)
              }
            }
            return Object.keys(relics).length > 0 ? relics : { ...INITIAL_RELIC_COUNTS }
          })(),
          newElementCount:
            typeof parsed.newElementCount === 'number' && Number.isFinite(parsed.newElementCount)
              ? Math.max(0, Math.floor(parsed.newElementCount))
              : 0,
        }
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return {
    ...INITIAL_WORKSPACE,
    unlockedElements: INITIAL_WORKSPACE.elements,
    craftHistory: [],
    positions: {},
    relics: { ...INITIAL_RELIC_COUNTS },
    newElementCount: 0,
  }
}

/** 规范化元素 ID：小写字符 + 下划线 */
function normalizeId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function useWorkspace() {
  // 初始数据：加载持久化存档并确保每个实例都有 instanceUid，旧元素补描述/类别
  const initial = useMemo(() => {
    const stored = loadStoredWorkspace()
    const defaultCategory = INITIAL_WORKSPACE.categories[0]
    const elements = stored.elements.map((e) => {
      const official = INITIAL_ELEMENTS.find((def) => def.id === e.id)
      return {
        ...e,
        instanceUid: e.instanceUid ?? uuid(),
        id: e.id && /^[a-z0-9_]+$/.test(e.id) ? e.id : normalizeId(e.name || 'element'),
        description: e.description ?? '',
        categoryId: e.categoryId ?? defaultCategory?.id ?? DEFAULT_CATEGORY_ID,
        // 基础元素始终采用官方最新名称与图标（旧存档「风」→「气」+ 棕色粉末堆土）
        name: official?.name ?? e.name,
        svg: official?.svg ?? e.svg,
      }
    })
    // 桌面坐标：key=instanceUid；仅保留仍存在于工作区实例中的坐标
    const positions: Record<string, CardPosition> = {}
    for (const e of elements) {
      if (e.instanceUid && stored.positions?.[e.instanceUid]) {
        positions[e.instanceUid] = stored.positions[e.instanceUid]
      }
    }
    return {
      elements,
      recipes: stored.recipes,
      // 基础类别（如天地万象）始终采用官方最新描述与图标，旧存档即时生效
      categories:
        stored.categories.length > 0
          ? stored.categories.map((c) => {
              const official = INITIAL_WORKSPACE.categories.find((def) => def.id === c.id)
              return official ? { ...c, description: official.description, icon: official.icon } : c
            })
          : INITIAL_WORKSPACE.categories,
      unlockedElements: stored.unlockedElements.map((e) => {
        const official = INITIAL_ELEMENTS.find((def) => def.id === e.id)
        return {
          ...e,
          id: e.id && /^[a-z0-9_]+$/.test(e.id) ? e.id : normalizeId(e.name || 'element'),
          description: e.description ?? '',
          categoryId: e.categoryId ?? defaultCategory?.id ?? DEFAULT_CATEGORY_ID,
          // 基础元素始终采用官方最新名称与图标
          name: official?.name ?? e.name,
          svg: official?.svg ?? e.svg,
        }
      }),
      craftHistory: stored.craftHistory,
      positions,
      relics: stored.relics ?? { ...INITIAL_RELIC_COUNTS },
      newElementCount: stored.newElementCount ?? 0,
    }
  }, [])

  const [elements, setElements] = useState<Element[]>(initial.elements)
  const [recipes, setRecipes] = useState<Recipe[]>(initial.recipes)
  const [categories, setCategories] = useState<ElementCategory[]>(initial.categories)
  /** 已解锁元素类型库（图鉴数据源，独立于工作区实例，不会因消耗/删除而消失） */
  const [unlockedElements, setUnlockedElements] = useState<Element[]>(initial.unlockedElements)
  /** 合成触发流水（最近 50 条） */
  const [craftHistory, setCraftHistory] = useState<CraftHistoryEntry[]>(initial.craftHistory)
  /** 桌面卡片坐标（key=instanceUid，单位 px） */
  const [positions, setPositions] = useState<Record<string, CardPosition>>(initial.positions)
  /** 秘宝库存（key=秘宝 id → 数量） */
  const [relics, setRelics] = useState<Record<string, number>>(initial.relics)
  /** 累计合成出的新元素数量（用于秘宝奖励） */
  const [newElementCount, setNewElementCount] = useState(initial.newElementCount)

  // 正在合成中（防止重复拖拽）
  const [isCrafting, setIsCrafting] = useState(false)

  // 引用，用于异步回调中读取最新状态
  const stateRef = useRef<StateRef>({
    elements,
    recipes,
    categories,
    unlockedElements,
    craftHistory: [],
    positions,
    relics,
    newElementCount,
  })
  useEffect(() => {
    stateRef.current = { elements, recipes, categories, unlockedElements, craftHistory, positions, relics, newElementCount }
  }, [elements, recipes, categories, unlockedElements, craftHistory, positions, relics, newElementCount])

  // 自动持久化到 localStorage（桌面元素只存 id + 位置 + 实例 uid，其余字段运行时由图鉴还原）
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          elements: elements.map((e) => {
            const uid = e.instanceUid ?? ''
            return {
              instanceUid: uid,
              id: e.id,
              ...(e.relicId ? { relicId: e.relicId } : {}),
              ...(positions[uid] ?? {}),
            }
          }),
          recipes,
          categories,
          unlockedElements,
          craftHistory,
          relics,
          newElementCount,
        }),
      )
    } catch {
      // ignore quota / privacy errors
    }
  }, [elements, recipes, categories, unlockedElements, craftHistory, positions, relics, newElementCount])

  /** 查找本地配方（双向匹配） */
  const findLocalRecipe = useCallback(
    (aId: string, bId: string): Recipe | null => {
      return (
        recipes.find(
          (r) =>
            (r.inputA === aId && r.inputB === bId) ||
            (r.inputA === bId && r.inputB === aId),
        ) ?? null
      )
    },
    [recipes],
  )

  /** 双击复制：生成一个相同元素的副本，副本携带独立 instanceUid */
  const duplicateElement = useCallback(
    (element: Element): Element => {
      const copy: Element = {
        ...element,
        createdAt: Date.now(),
        instanceUid: uuid(),
      }
      setElements((prev) => [...prev, copy])
      return copy
    },
    [],
  )

  /** 删除一个元素实例（按 elements 数组索引） */
  const removeElementInstance = useCallback(
    (index: number): boolean => {
      const list = stateRef.current.elements
      if (index < 0 || index >= list.length) return false
      const next = [...list]
      next.splice(index, 1)
      setElements(next)
      return true
    },
    [],
  )

  /** 从元素库添加一个副本到工作区（返回新实例） */
  const addElementFromLibrary = useCallback(
    (element: Element): Element => {
      const copy: Element = { ...element, createdAt: Date.now(), instanceUid: uuid() }
      setElements((prev) => [...prev, copy])
      return copy
    },
    [],
  )

  /** 直接向桌面添加一批已构造好的实例（每个实例必须自带独立 instanceUid） */
  const addElementInstances = useCallback((instances: Element[]) => {
    if (instances.length === 0) return
    setElements((prev) => [...prev, ...instances])
  }, [])

  /** 部署秘宝到桌面：库存 -1，返回生成的桌面实例（库存不足返回 null） */
  const deployRelic = useCallback((relicId: string): Element | null => {
    const template = RELIC_TEMPLATES.find((t) => t.relicId === relicId)
    if (!template) return null
    if ((stateRef.current.relics[relicId] ?? 0) <= 0) return null
    setRelics((prev) => ({ ...prev, [relicId]: Math.max(0, (prev[relicId] ?? 0) - 1) }))
    const instance: Element = { ...template, createdAt: Date.now(), instanceUid: uuid() }
    setElements((prev) => [...prev, instance])
    return instance
  }, [])

  /** 返还秘宝：桌面实例被删除（拖垃圾桶/清空桌面）时库存 +1 */
  const refundRelic = useCallback((instanceUid: string) => {
    const el = stateRef.current.elements.find((e) => e.instanceUid === instanceUid)
    if (!el?.relicId) return
    setRelics((prev) => ({ ...prev, [el.relicId!]: (prev[el.relicId!] ?? 0) + 1 }))
  }, [])

  /**
   * 清空桌面：仅清空桌面上的元素实例为初始四基础元素。
   * 保留：配方书、图鉴（已解锁库）、类别、合成历史 —— 玩家的进度不会丢失。
   */
  const resetWorkspace = useCallback(() => {
    setElements(INITIAL_WORKSPACE.elements.map((e) => ({ ...e, instanceUid: uuid() })))
    setPositions({})
  }, [])

  /**
   * 清除全部世界数据（危险操作）：
   * 删除 localStorage 的世界存档（元素/配方/类别/图鉴/合成历史）并重置为初始状态。
   * 注意：AI 配置（Endpoint/API Key/模型）属于独立的「游戏设置」，不在此清除范围内，予以保留。
   */
  const clearAllData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setElements(INITIAL_WORKSPACE.elements.map((e) => ({ ...e, instanceUid: uuid() })))
    setRecipes([])
    setCategories(INITIAL_WORKSPACE.categories)
    setUnlockedElements(INITIAL_WORKSPACE.elements)
    setCraftHistory([])
    setPositions({})
    setRelics({ ...INITIAL_RELIC_COUNTS })
    setNewElementCount(0)
  }, [])

  /** 向合成历史追加一条记录（无数量上限，前端分页展示） */
  const addCraftHistoryEntry = useCallback(
    (entry: Omit<CraftHistoryEntry, 'id' | 'timestamp'>) => {
      setCraftHistory((prev) => {
        const next: CraftHistoryEntry = {
          id: uuid(),
          timestamp: Date.now(),
          ...entry,
        }
        return [...prev, next]
      })
    },
    [],
  )

  /** 手动清空合成历史 */
  const clearCraftHistory = useCallback(() => {
    setCraftHistory([])
  }, [])

  /** 将一批元素注册为「已解锁」（图鉴数据；已存在则跳过） */
  const unlockElements = useCallback((items: Element[]) => {
    if (items.length === 0) return
    setUnlockedElements((prev) => {
      const existing = new Set(prev.map((e) => e.id))
      const fresh = items.filter((e) => !existing.has(e.id))
      return fresh.length > 0 ? [...prev, ...fresh] : prev
    })
  }, [])

  /** 将元素的使用频次 +delta */
  const bumpUseCount = useCallback((id: string, delta = 1) => {
    setElements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, useCount: e.useCount + delta } : e)),
    )
  }, [])

  /**
   * 消耗两张输入卡：从工作区移除对应 instanceUid 的实例
   */
  const consumeInputs = useCallback(
    (a: Element, b: Element) => {
      const aUid = a.instanceUid ?? ''
      const bUid = b.instanceUid ?? ''
      setElements((prev) => {
        return prev.filter((e) => e.instanceUid !== aUid && e.instanceUid !== bUid)
      })
    },
    [],
  )

  /** 处理本地配方命中（命中后消耗输入卡 + 产出） */
  const executeLocalRecipe = useCallback(
    (recipe: Recipe, inputA: Element, inputB: Element): CraftOutcome => {
      // 输出元素模板：从「已解锁库」查找（图鉴库永久保留模板，即使桌面没有实例也能重新产出）
      const outputs = recipe.outputs
        .map((oid) => stateRef.current.unlockedElements.find((e) => e.id === oid))
        .filter((e): e is Element => !!e)

      bumpUseCount(recipe.inputA)
      bumpUseCount(recipe.inputB)

      // 消耗输入卡
      consumeInputs(inputA, inputB)

      // 将输出元素注册为已解锁（图鉴）
      unlockElements(outputs)

      // 无条件为每个输出元素产出新实例（忠实遵循配方，即使元素已在工作区）
      const added: Element[] = outputs.map((out) => ({ ...out, instanceUid: uuid() }))
      const known: string[] = []
      if (added.length > 0) {
        setElements((prev) => [...prev, ...added])
      }
      // 记录合成历史（范式：仅引用配方 ID）
      addCraftHistoryEntry({
        recipeId: recipe.id,
        source: 'local',
      })
      return { type: 'local', added, known }
    },
    [bumpUseCount, consumeInputs, unlockElements, addCraftHistoryEntry],
  )

  /** 构建 LLM 上下文消息 */
  const buildMessages = useCallback(
    (inputA: Element, inputB: Element): ChatMessage[] => {
      // 类别：完整发送（ID、名称、描述）
      const categoryList = stateRef.current.categories
        .map((c) => `${c.name} (ID: ${c.id})：${c.description}`)
        .join('；')
      // 元素：按类别嵌套分组，仅含名称与 ID（不重复类别字段，不发完整描述以免上下文过长）
      const categories = stateRef.current.categories
      const elementsByCategory = categories
        .map((c) => {
          const items = stateRef.current.unlockedElements
            .filter((e) => e.categoryId === c.id)
            .map((e) => `${e.name} (ID: ${e.id})`)
          return items.length > 0 ? `「${c.name}」：${items.join('、')}` : null
        })
        .filter((s): s is string => !!s)
      // 未归入任何已知类别的元素兜底（防止遗漏）
      const knownCategoryIds = new Set(categories.map((c) => c.id))
      const uncategorized = stateRef.current.unlockedElements
        .filter((e) => !knownCategoryIds.has(e.categoryId))
        .map((e) => `${e.name} (ID: ${e.id})`)
      if (uncategorized.length > 0) {
        elementsByCategory.push(`「未归类」：${uncategorized.join('、')}`)
      }
      const elementList = elementsByCategory.join('\n')
      const relatedRecipes = stateRef.current.recipes.filter(
        (r) =>
          (r.inputA === inputA.id && r.inputB === inputB.id) ||
          (r.inputA === inputB.id && r.inputB === inputA.id),
      )
      const recipeDesc =
        relatedRecipes.length > 0
          ? relatedRecipes
              .map((r) => `${r.inputA}+${r.inputB} -> ${r.outputs.join(',')}`)
              .join('; ')
          : '（无）'

      // 本次合成的两个元素，附带所属类别与完整描述供 AI 推理
      const catNameOf = (categoryId: string) =>
        stateRef.current.categories.find((c) => c.id === categoryId)?.name ?? categoryId
      const inputDescA = inputA.description ? `："${inputA.description}"` : ''
      const inputDescB = inputB.description ? `："${inputB.description}"` : ''

      // system：固定不变规则（无动态注入）
      const systemPrompt = SYSTEM_PROMPT_TEMPLATE

      // user：本次合成全部动态数据（类别清单 / 元素图鉴 / 合成对象 / 相关配方）
      const userPrompt = `【元素类别】\n${categoryList}\n\n【元素图鉴】\n${elementList}\n\n【本次合成对象】\n${inputA.name}（ID: ${inputA.id}，类别：${catNameOf(inputA.categoryId)}）${inputDescA}\n${inputB.name}（ID: ${inputB.id}，类别：${catNameOf(inputB.categoryId)}）${inputDescB}\n\n【相关已有配方】\n${recipeDesc}\n\n请现在合成 ${inputA.name} 和 ${inputB.name}，并调用相应工具。`

      return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
    },
    [],
  )

  /**
   * 核心合成流程（严格顺序）：
   * 1. 本地查重 → 命中：执行配方并消耗输入卡
   * 2. AI 生成：多轮 Function Calling 循环（craft_elements / create_category / craft_recipe）
   * 3. 统一提交：消耗输入卡 + 保存新类别 + 保存新元素 + 保存配方
   */
  const craft = useCallback(
    async (
      inputA: Element,
      inputB: Element,
      aiConfig: AIConfig | null,
      onMessage: (msg: string) => void,
      onStream?: (text: string) => void,
      onReasoning?: (text: string) => void,
    ): Promise<CraftOutcome> => {
      if (isCrafting) return { type: 'error', message: '正在合成中，请稍候' }
      setIsCrafting(true)
      try {
        // 步骤 1：本地查重
        const local = findLocalRecipe(inputA.id, inputB.id)
        if (local) {
          return executeLocalRecipe(local, inputA, inputB)
        }

        // 步骤 2：AI 生成
        if (!aiConfig || !aiConfig.baseURL.trim() || !aiConfig.apiKey.trim()) {
          return { type: 'error', message: '尚未配置 AI，无法生成新合成配方' }
        }

        onMessage('正在解析元素...')
        const messages = buildMessages(inputA, inputB)
        onMessage('贤者之石充能中...')

        // 多轮工具调用中累积的状态
        const newElements: Element[] = []
        const newElementRefs = new Map<string, string>() // 新元素名 -> 元素ID
        const newElementIdByName = new Map<string, string>() // 元素名 -> 元素ID
        const createdCategories: ElementCategory[] = []
        let recipeOutputIds: string[] = []
        // 炼金术笔记：累积 AI 流式输出的思考文字
        let craftNote = ''

        // ---- 多轮循环 ----
        for (let round = 0; round < MAX_AI_ROUNDS; round++) {
          const result = await streamChatCompletion(
            aiConfig,
            messages,
            [...FUNCTIONS],
            (text) => {
              craftNote += text
              onStream?.(text)
              onMessage('贤者之石充能中...')
            },
            (text) => onReasoning?.(text),
          )
          if (!result.ok) {
            return { type: 'error', message: result.error }
          }

          const assistantMessage = result.message
          const toolCalls = assistantMessage.tool_calls ?? []

          // 将 assistant 消息追加到对话历史
          messages.push(assistantMessage)

          // 模型未调用任何工具 → 终止
          if (toolCalls.length === 0) {
            if (recipeOutputIds.length === 0) {
              return { type: 'error', message: '模型未调用合成工具，请确保 API 支持 Function Calling' }
            }
            break
          }

          // ---- 执行本轮所有工具调用（严格校验：任一参数非法即回传 error 让 AI 重试，绝不写默认值） ----
          let toolError: string | null = null
          for (const tc of toolCalls) {
            if (toolError) break
            if (tc.function.name === 'create_category') {
              const args = parseToolArguments<CreateCategoryArgs>(tc.function.arguments)
              const draft = args?.category
              if (!draft || typeof draft !== 'object') {
                toolError = 'create_category 缺少 category 参数'
                break
              }
              const catId = normalizeId(draft.id)
              const catName = draft.name?.trim()
              const catIcon = draft.icon?.trim()
              const catDesc = draft.description?.trim()
              if (!catId) toolError = 'create_category 的 id 缺失或非法（需小写字母/数字/下划线）'
              else if (!catName) toolError = 'create_category 的 name 缺失'
              else if (!catIcon) toolError = 'create_category 的 icon 缺失'
              else if (!catDesc) toolError = 'create_category 的 description 缺失'
              else if (
                stateRef.current.categories.some((c) => c.id === catId) ||
                createdCategories.some((c) => c.id === catId)
              ) {
                toolError = `create_category 的 id「${catId}」已存在，请换一个`
              } else {
                createdCategories.push({
                  id: catId,
                  name: catName,
                  icon: sanitizeSVG(catIcon),
                  description: catDesc,
                  createdAt: Date.now(),
                })
              }
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: toolError
                  ? JSON.stringify({ error: toolError })
                  : JSON.stringify({ ok: true, created_categories: createdCategories.map((c) => c.id) }),
              })
            } else if (tc.function.name === 'craft_elements') {
              const args = parseToolArguments<CraftElementsArgs>(tc.function.arguments)
              const drafts = args?.new_elements
              if (!Array.isArray(drafts) || drafts.length === 0) {
                toolError = 'craft_elements 的 new_elements 缺失或为空'
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: toolError }),
                })
                break
              }
              const createdResults: Array<{ name: string; id: string }> = []

              for (let i = 0; i < drafts.length; i++) {
                if (toolError) break
                const draft = drafts[i]
                const name = draft.name?.trim()
                const elementId = normalizeId(draft.id)
                const desc = draft.description?.trim()
                const svgRaw = draft.svg_content?.trim()
                const catRaw = draft.category_id?.trim()
                // 若与已有元素同名或同ID → 报错，并附上已存在元素的详细信息，引导 AI 引用已有 ID 或改名
                const existingByName = name ? stateRef.current.unlockedElements.find((e) => e.name === name) : undefined
                const existingById = elementId ? stateRef.current.unlockedElements.find((e) => e.id === elementId) : undefined
                const existing = existingByName ?? existingById
                if (existing) {
                  const catName =
                    stateRef.current.categories.find((c) => c.id === existing.categoryId)?.name ?? existing.categoryId
                  toolError =
                    `new_elements[${i}] 与已有元素重复（id=${existing.id}, name="${existing.name}", ` +
                    `category="${catName}(id=${existing.categoryId})", description="${existing.description}"）。` +
                    `请直接引用已有元素 ID「${existing.id}」作为产物，不要重复创建；如需全新元素请换一个不同的 id 和 name`
                  break
                }
                if (!name) toolError = `new_elements[${i}] 的 name 缺失`
                else if (!elementId) toolError = `new_elements[${i}]（${name}）的 id 缺失或非法（需小写字母/数字/下划线）`
                else if (!desc) toolError = `new_elements[${i}]（${name}）的 description 缺失`
                else if (!svgRaw) toolError = `new_elements[${i}]（${name}）的 svg_content 缺失`
                else if (!catRaw) toolError = `new_elements[${i}]（${name}）的 category_id 缺失，必须引用已有类别或先调用 create_category`
                else {
                  const categoryId = normalizeId(catRaw)
                  const categoryValid =
                    stateRef.current.categories.some((c) => c.id === categoryId) ||
                    createdCategories.some((c) => c.id === categoryId)
                  if (!categoryValid) {
                    toolError = `new_elements[${i}]（${name}）的 category_id「${categoryId}」不存在，请改用已有类别或先调用 create_category`
                  } else {
                    // 元素重名处理：与现有元素或本轮已创建元素同名时追加“(异界)”后缀
                    const nameTaken =
                      stateRef.current.elements.some((e) => e.name === name) ||
                      newElements.some((e) => e.name === name)
                    const finalName = nameTaken ? `${name}(异界)` : name
                    let finalId = elementId
                    if (
                      stateRef.current.unlockedElements.some((e) => e.id === finalId) ||
                      newElements.some((e) => e.id === finalId)
                    ) {
                      finalId = `${finalId}_${newElements.length + createdCategories.length + 1}`
                    }
                    newElements.push({
                      id: finalId,
                      name: finalName,
                      description: desc,
                      categoryId,
                      svg: sanitizeSVG(svgRaw),
                      createdAt: Date.now(),
                      useCount: 0,
                      isForeign: nameTaken,
                    })
                    if (!newElementRefs.has(finalId)) newElementRefs.set(finalId, finalId)
                    newElementIdByName.set(name, finalId)
                    newElementIdByName.set(finalName, finalId)
                    createdResults.push({ name: finalName, id: finalId })
                  }
                }
              }
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: toolError
                  ? JSON.stringify({ error: toolError })
                  : JSON.stringify({ created: createdResults }),
              })
            } else if (tc.function.name === 'craft_recipe') {
              const args = parseToolArguments<CraftRecipeArgs>(tc.function.arguments)
              const ids = args?.output_element_ids
              if (!Array.isArray(ids) || ids.length === 0 || ids.length > 3) {
                toolError = 'craft_recipe 的 output_element_ids 必须为 1~3 个元素ID'
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: toolError }),
                })
                break
              }
              recipeOutputIds = ids
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: true, received_output_ids: recipeOutputIds }),
              })
            }
          }

          // 已收集到配方输出 → 提前结束
          if (recipeOutputIds.length > 0) break
          // 本轮参数出错 → 继续循环，让 AI 根据错误修正重试
          if (toolError) continue
        }

        // ---- 解析输出 ID：可能引用元素 ID、元素名 ----
        const resolveElementId = (rawId: string): string | null => {
          const trimmed = rawId.trim()
          const unquoted = trimmed.replace(/^["']|["']$/g, '')
          // 新元素 ID/名字
          if (newElementRefs.has(trimmed)) return trimmed
          if (newElementIdByName.has(unquoted)) return newElementIdByName.get(unquoted)!
          if (newElementIdByName.has(trimmed)) return newElementIdByName.get(trimmed)!
          // 已有元素 ID / 名称
          if (stateRef.current.unlockedElements.some((e) => e.id === trimmed)) return trimmed
          if (stateRef.current.elements.some((e) => e.id === trimmed)) return trimmed
          const byName = stateRef.current.unlockedElements.find((e) => e.name === trimmed)
          if (byName) return byName.id
          const byName2 = stateRef.current.unlockedElements.find((e) => e.name === unquoted)
          if (byName2) return byName2.id
          return null
        }

        const resolvedOutputs = recipeOutputIds
          .map(resolveElementId)
          .filter((id): id is string => !!id)
          .filter((id, i, arr) => arr.indexOf(id) === i)
          .slice(0, 3)

        if (resolvedOutputs.length === 0) {
          return { type: 'error', message: 'AI 未返回有效的合成产物，请重试' }
        }

        const newRecipe: Recipe = {
          id: uuid(),
          inputA: inputA.id,
          inputB: inputB.id,
          outputs: resolvedOutputs,
        }

        bumpUseCount(inputA.id)
        bumpUseCount(inputB.id)

        // 消耗输入卡
        consumeInputs(inputA, inputB)

        // 保存新类别（若有）
        if (createdCategories.length > 0) {
          setCategories((prev) => [...prev, ...createdCategories])
        }
        // 将输出元素注册为已解锁（图鉴）
        const outputElements = [
          ...newElements,
          ...stateRef.current.elements
            .filter((e) => resolvedOutputs.includes(e.id))
            .map((e) => ({ ...e })),
        ]
        unlockElements(outputElements)
        // ★ 无条件为每个输出元素产出新实例（忠实遵循配方，无论元素是否已在工作区）
        const producedInstances: Element[] = resolvedOutputs
          .map((oid): Element | null => {
            const template =
              newElements.find((e) => e.id === oid) ??
              stateRef.current.unlockedElements.find((e) => e.id === oid)
            return template ? { ...template, instanceUid: uuid() } : null
          })
          .filter((e): e is Element => !!e)
        if (producedInstances.length > 0) {
          setElements((prev) => [...prev, ...producedInstances])
        }
        // 保存配方（避免重复）
        setRecipes((prev) => {
          const exists = prev.some(
            (r) =>
              (r.inputA === newRecipe.inputA && r.inputB === newRecipe.inputB) ||
              (r.inputA === newRecipe.inputB && r.inputB === newRecipe.inputA),
          )
          return exists ? prev : [...prev, newRecipe]
        })

        // 所有已产出的实例（新元素 + 复用已有元素）都会出现在桌面上
        const added = producedInstances.map((e) => ({ ...e }))
        const known: string[] = []

        // 记录合成历史（范式：仅引用配方 ID，附炼金术笔记）
        const finalNote = craftNote.trim()
        addCraftHistoryEntry({
          recipeId: newRecipe.id,
          source: 'ai',
          newCount: newElements.length,
          note: finalNote || undefined,
        })

        // 秘宝奖励：每合成出 10 个新元素，奖励 1 个黑化
        let relicReward = 0
        if (newElements.length > 0) {
          const prevCount = stateRef.current.newElementCount
          const nextCount = prevCount + newElements.length
          const awarded =
            Math.floor(nextCount / RELIC_REWARD_NEW_ELEMENTS) - Math.floor(prevCount / RELIC_REWARD_NEW_ELEMENTS)
          if (awarded > 0) {
            setRelics((prev) => ({ ...prev, blackening: (prev.blackening ?? 0) + awarded }))
            relicReward = awarded
          }
          setNewElementCount(nextCount)
        }

        onMessage('凝固新元素...')
        return {
          type: 'ai',
          added,
          known,
          newCount: newElements.length,
          recipeCount: 1,
          newElements,
          relicReward: relicReward > 0 ? relicReward : undefined,
          note: finalNote || undefined,
        }
      } finally {
        setIsCrafting(false)
      }
    },
    [isCrafting, findLocalRecipe, executeLocalRecipe, buildMessages, consumeInputs, bumpUseCount, unlockElements, addCraftHistoryEntry],
  )

  /** 黑化秘宝：与元素结合，把该元素拆解为 1~3 个组成它的概念元素（消耗秘宝与元素） */
  const decomposeElement = useCallback(
    async (
      relic: Element,
      element: Element,
      aiConfig: AIConfig | null,
      onMessage: (msg: string) => void,
      onStream?: (text: string) => void,
    ): Promise<CraftOutcome> => {
      if (isCrafting) return { type: 'error', message: '正在合成中，请稍候' }
      if (!relic.relicId) return { type: 'error', message: '这不是秘宝' }
      if (element.relicId) return { type: 'error', message: '秘宝只能与元素结合' }
      if (!aiConfig || !aiConfig.baseURL.trim() || !aiConfig.apiKey.trim()) {
        return { type: 'error', message: '尚未配置 AI，无法触发黑化' }
      }
      setIsCrafting(true)
      try {
        onMessage(`${relic.name}侵蚀中...`)
        const prompt = RELIC_PROMPTS[relic.relicId ?? ''] ?? DECOMPOSE_SYSTEM_PROMPT
        const messages: ChatMessage[] = [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: `【待拆解元素】${element.name}（ID: ${element.id}，类别：${
              stateRef.current.categories.find((c) => c.id === element.categoryId)?.name ?? element.categoryId
            }）${element.description ? `：${element.description}` : ''}\n\n请使用「${relic.name}」把它拆解为 1~3 个组成它的概念元素，并调用 craft_elements 创建。`,
          },
        ]

        const newElements: Element[] = []
        const createdCategories: ElementCategory[] = []
        let note = ''
        let lastError = ''

        for (let round = 0; round < MAX_AI_ROUNDS; round++) {
          const result = await streamChatCompletion(aiConfig, messages, [...FUNCTIONS], (text) => {
            note += text
            onStream?.(text)
            onMessage(`${relic.name}侵蚀中...`)
          })
          if (!result.ok) return { type: 'error', message: result.error }
          messages.push(result.message)
          const toolCalls = result.message.tool_calls ?? []
          if (toolCalls.length === 0) {
            if (newElements.length === 0) {
              return { type: 'error', message: lastError || '模型未产出概念元素，请重试' }
            }
            break
          }

          let toolError: string | null = null
          for (const tc of toolCalls) {
            if (toolError) break
            if (tc.function.name === 'create_category') {
              const args = parseToolArguments<CreateCategoryArgs>(tc.function.arguments)
              const draft = args?.category
              if (!draft || typeof draft !== 'object') {
                toolError = 'create_category 缺少 category 参数'
                break
              }
              const catId = normalizeId(draft.id)
              const catName = draft.name?.trim()
              const catIcon = draft.icon?.trim()
              const catDesc = draft.description?.trim()
              if (!catId) toolError = 'create_category 的 id 缺失或非法（需小写字母/数字/下划线）'
              else if (!catName) toolError = 'create_category 的 name 缺失'
              else if (!catIcon) toolError = 'create_category 的 icon 缺失'
              else if (!catDesc) toolError = 'create_category 的 description 缺失'
              else if (
                stateRef.current.categories.some((c) => c.id === catId) ||
                createdCategories.some((c) => c.id === catId)
              ) {
                toolError = `create_category 的 id「${catId}」已存在，请换一个`
              } else {
                createdCategories.push({
                  id: catId,
                  name: catName,
                  icon: sanitizeSVG(catIcon),
                  description: catDesc,
                  createdAt: Date.now(),
                })
              }
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: toolError
                  ? JSON.stringify({ error: toolError })
                  : JSON.stringify({ ok: true, created_categories: createdCategories.map((c) => c.id) }),
              })
            } else if (tc.function.name === 'craft_elements') {
              const args = parseToolArguments<CraftElementsArgs>(tc.function.arguments)
              const drafts = args?.new_elements
              if (!Array.isArray(drafts) || drafts.length === 0) {
                toolError = 'craft_elements 的 new_elements 缺失或为空'
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: toolError }),
                })
                break
              }
              const createdResults: Array<{ name: string; id: string }> = []
              for (let i = 0; i < drafts.length; i++) {
                if (toolError) break
                const draft = drafts[i]
                const name = draft.name?.trim()
                const elementId = normalizeId(draft.id)
                const desc = draft.description?.trim()
                const svgRaw = draft.svg_content?.trim()
                const catRaw = draft.category_id?.trim()
                const existingByName = name
                  ? stateRef.current.unlockedElements.find((e) => e.name === name)
                  : undefined
                const existingById = elementId ? stateRef.current.unlockedElements.find((e) => e.id === elementId) : undefined
                const existing = existingByName ?? existingById
                if (existing) {
                  const catName =
                    stateRef.current.categories.find((c) => c.id === existing.categoryId)?.name ?? existing.categoryId
                  toolError =
                    `new_elements[${i}] 与已有元素重复（id=${existing.id}, name="${existing.name}", ` +
                    `category="${catName}(id=${existing.categoryId})", description="${existing.description}"）。` +
                    `请直接引用已有元素 ID「${existing.id}」作为产物，不要重复创建；如需全新元素请换一个不同的 id 和 name`
                  break
                }
                if (!name) toolError = `new_elements[${i}] 的 name 缺失`
                else if (!elementId) toolError = `new_elements[${i}]（${name}）的 id 缺失或非法（需小写字母/数字/下划线）`
                else if (!desc) toolError = `new_elements[${i}]（${name}）的 description 缺失`
                else if (!svgRaw) toolError = `new_elements[${i}]（${name}）的 svg_content 缺失`
                else if (!catRaw) toolError = `new_elements[${i}]（${name}）的 category_id 缺失，必须引用已有类别或先调用 create_category`
                else {
                  const categoryId = normalizeId(catRaw)
                  const categoryValid =
                    stateRef.current.categories.some((c) => c.id === categoryId) ||
                    createdCategories.some((c) => c.id === categoryId)
                  if (!categoryValid) {
                    toolError = `new_elements[${i}]（${name}）的 category_id「${categoryId}」不存在，请改用已有类别或先调用 create_category`
                  } else {
                    const nameTaken =
                      stateRef.current.elements.some((e) => e.name === name) ||
                      newElements.some((e) => e.name === name)
                    const finalName = nameTaken ? `${name}(异界)` : name
                    let finalId = elementId
                    if (
                      stateRef.current.unlockedElements.some((e) => e.id === finalId) ||
                      newElements.some((e) => e.id === finalId)
                    ) {
                      finalId = `${finalId}_${newElements.length + createdCategories.length + 1}`
                    }
                    newElements.push({
                      id: finalId,
                      name: finalName,
                      description: desc,
                      categoryId,
                      svg: sanitizeSVG(svgRaw),
                      createdAt: Date.now(),
                      useCount: 0,
                      isForeign: nameTaken,
                    })
                    createdResults.push({ name: finalName, id: finalId })
                  }
                }
              }
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: toolError
                  ? JSON.stringify({ error: toolError })
                  : JSON.stringify({ created: createdResults }),
              })
            } else if (tc.function.name === 'craft_recipe') {
              toolError = '拆解模式不需要调用 craft_recipe，直接调用 craft_elements 创建概念元素'
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ error: toolError }),
              })
            }
          }
          if (toolError) lastError = toolError
          // 已有产出且本轮无错误 → 提前结束
          if (newElements.length > 0 && !toolError) break
        }

        if (newElements.length === 0) {
          return { type: 'error', message: lastError || '黑化失败：未产出概念元素' }
        }

        // 保存新类别、解锁概念、消耗秘宝与元素、产出实例
        if (createdCategories.length > 0) {
          setCategories((prev) => [...prev, ...createdCategories])
        }
        unlockElements(newElements)
        consumeInputs(relic, element)
        const producedInstances: Element[] = newElements.map((t) => ({ ...t, instanceUid: uuid() }))
        setElements((prev) => [...prev, ...producedInstances])

        onMessage('概念析出...')
        return {
          type: 'ai',
          added: producedInstances.map((e) => ({ ...e })),
          known: [],
          newCount: newElements.length,
          recipeCount: 0,
          newElements: newElements.map((e) => ({ ...e })),
          note: note.trim() || undefined,
        }
      } finally {
        setIsCrafting(false)
      }
    },
    [isCrafting, consumeInputs, unlockElements],
  )

  /** 导出工作区为 ZIP（manifest.json 仅含基础信息，数据拆分独立 JSON 文件；桌面元素只含 id + 位置） */
  const exportWorkspace = useCallback(async (): Promise<Blob> => {
    const now = new Date()
    const manifest = {
      formatVersion: 4,
      exportedAt: now.toISOString(),
      title: 'AI 炼金术工坊存档',
      files: {
        elements: 'elements.json',
        recipes: 'recipes.json',
        categories: 'categories.json',
        unlockedElements: 'unlockedElements.json',
        craftHistory: 'craftHistory.json',
        relics: 'relics.json',
      },
    }
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    zip.file(
      'elements.json',
      JSON.stringify(
        stateRef.current.elements.map((e) => {
          const uid = e.instanceUid ?? ''
          return {
            instanceUid: uid,
            id: e.id,
            ...(stateRef.current.positions[uid] ?? {}),
          }
        }),
        null,
        2,
      ),
    )
    zip.file('recipes.json', JSON.stringify(stateRef.current.recipes, null, 2))
    zip.file('categories.json', JSON.stringify(stateRef.current.categories, null, 2))
    zip.file('unlockedElements.json', JSON.stringify(stateRef.current.unlockedElements, null, 2))
    zip.file('craftHistory.json', JSON.stringify(stateRef.current.craftHistory, null, 2))
    zip.file(
      'relics.json',
      JSON.stringify(
        {
          relics: stateRef.current.relics,
          newElementCount: stateRef.current.newElementCount,
        },
        null,
        2,
      ),
    )
    return await zip.generateAsync({ type: 'blob' })
  }, [])

  /** 从 File 导入工作区（解析 ZIP 中的 manifest.json 并覆写） */
  const importWorkspace = useCallback(
    async (file: File): Promise<{ ok: boolean; message: string }> => {
      try {
        const zip = await JSZip.loadAsync(file)
        const manifestFile = zip.file('manifest.json')
        if (!manifestFile) {
          return { ok: false, message: 'ZIP 内未找到 manifest.json' }
        }
        const readJson = async <T>(name: string): Promise<T | null> => {
          const f = zip.file(name)
          if (!f) return null
          try {
            return JSON.parse(await f.async('text')) as T
          } catch {
            return null
          }
        }

        // manifest: 仅基础信息（formatVersion/time）。数据从独立 JSON 文件读取。
        const manifest = JSON.parse(await manifestFile.async('text')) as {
          formatVersion?: number
          data?: {
            elements?: string
            recipes?: string
            categories?: string
            unlockedElements?: string
            craftHistory?: string
          }
        }
        // v2 新格式：各数据独立文件；File 名也可由 manifest.json 内层 files 指定
        const fileNames = (manifest as { files?: Record<string, string> }).files ?? {}
        const nameOf = (key: string, fallback: string) => fileNames[key] ?? fallback

        let data: {
          elements: Array<Element | StoredElementRef>
          recipes: Recipe[]
          categories?: ElementCategory[]
          unlockedElements?: Element[]
          craftHistory?: CraftHistoryEntry[]
          positions?: Record<string, CardPosition>
          relicsData?: { relics?: Record<string, number>; newElementCount?: number }
        } | null = null

        if (manifest.formatVersion === 4) {
          // v4 新格式：桌面元素紧凑引用 + 秘宝库存
          const [rawElements, recipes, categories, unlockedElements, craftHistory, relicsData] = await Promise.all([
            readJson<Array<Element | StoredElementRef>>(nameOf('elements', 'elements.json')),
            readJson<Recipe[]>(nameOf('recipes', 'recipes.json')),
            readJson<ElementCategory[]>(nameOf('categories', 'categories.json')),
            readJson<Element[]>(nameOf('unlockedElements', 'unlockedElements.json')),
            readJson<CraftHistoryEntry[]>(nameOf('craftHistory', 'craftHistory.json')),
            readJson<{ relics?: Record<string, number>; newElementCount?: number }>(nameOf('relics', 'relics.json')),
          ])
          if (Array.isArray(rawElements) && Array.isArray(recipes)) {
            data = {
              elements: rawElements,
              recipes,
              categories: categories ?? [],
              unlockedElements: unlockedElements ?? undefined,
              craftHistory: craftHistory ?? undefined,
              relicsData: relicsData ?? undefined,
            }
          }
        } else if (manifest.formatVersion === 3) {
          // v3 新格式：桌面元素为紧凑引用（id + 位置），完整模板由图鉴还原
          const [rawElements, recipes, categories, unlockedElements, craftHistory] = await Promise.all([
            readJson<Array<Element | StoredElementRef>>(nameOf('elements', 'elements.json')),
            readJson<Recipe[]>(nameOf('recipes', 'recipes.json')),
            readJson<ElementCategory[]>(nameOf('categories', 'categories.json')),
            readJson<Element[]>(nameOf('unlockedElements', 'unlockedElements.json')),
            readJson<CraftHistoryEntry[]>(nameOf('craftHistory', 'craftHistory.json')),
          ])
          if (Array.isArray(rawElements) && Array.isArray(recipes)) {
            data = {
              elements: rawElements,
              recipes,
              categories: categories ?? [],
              unlockedElements: unlockedElements ?? undefined,
              craftHistory: craftHistory ?? undefined,
            }
          }
        } else if (manifest.formatVersion === 2) {
          // v2 旧格式：完整元素 + 独立 positions.json
          const [elements, recipes, categories, unlockedElements, craftHistory, positions] = await Promise.all([
            readJson<Element[]>(nameOf('elements', 'elements.json')),
            readJson<Recipe[]>(nameOf('recipes', 'recipes.json')),
            readJson<ElementCategory[]>(nameOf('categories', 'categories.json')),
            readJson<Element[]>(nameOf('unlockedElements', 'unlockedElements.json')),
            readJson<CraftHistoryEntry[]>(nameOf('craftHistory', 'craftHistory.json')),
            readJson<Record<string, CardPosition>>(nameOf('positions', 'positions.json')),
          ])
          if (Array.isArray(elements) && Array.isArray(recipes)) {
            data = {
              elements,
              recipes,
              categories: categories ?? [],
              unlockedElements: unlockedElements ?? undefined,
              craftHistory: craftHistory ?? undefined,
              positions: positions ?? undefined,
            }
          }
        } else {
          // v1 旧格式：manifest.json 内嵌全部数据
          const legacy = JSON.parse(await manifestFile.async('text')) as Workspace & {
            unlockedElements?: Element[]
            craftHistory?: CraftHistoryEntry[]
            positions?: Record<string, CardPosition>
          }
          if (Array.isArray(legacy.elements) && Array.isArray(legacy.recipes)) {
            data = legacy
          }
        }
        if (!data) {
          return { ok: false, message: 'manifest.json 格式不正确或数据文件缺失' }
        }

        // 秘宝库存（v4 存档；旧版本回退初始值）
        const importedRelics: Record<string, number> = { ...INITIAL_RELIC_COUNTS }
        if (data.relicsData?.relics && typeof data.relicsData.relics === 'object') {
          for (const [key, value] of Object.entries(data.relicsData.relics)) {
            const n = Number(value)
            if (Number.isFinite(n) && n >= 0) importedRelics[key] = Math.floor(n)
          }
        }
        const importedNewElementCount =
          typeof data.relicsData?.newElementCount === 'number' &&
          Number.isFinite(data.relicsData.newElementCount)
            ? Math.max(0, Math.floor(data.relicsData.newElementCount))
            : 0

        // 规范化类别（保证字段完整）
        const importedCategories: ElementCategory[] = Array.isArray(data.categories)
          ? data.categories.map((c) => ({
              id: typeof c.id === 'string' ? normalizeId(c.id) : 'unknown_category',
              name: c.name ?? '未知类别',
              icon: typeof c.icon === 'string' ? sanitizeSVG(c.icon) : '',
              description: c.description ?? '',
              createdAt: c.createdAt ?? Date.now(),
            }))
          : INITIAL_WORKSPACE.categories

        const validCategoryIds = new Set(importedCategories.map((c) => c.id))
        const defaultCategoryId = importedCategories[0]?.id ?? DEFAULT_CATEGORY_ID

        const isCompactElements =
          Array.isArray(data.elements) && data.elements.length > 0 && !('svg' in (data.elements[0] as object))

        // 已解锁元素库（缺省从导入元素推导）
        let importedUnlocked: Element[] =
          Array.isArray(data.unlockedElements) && data.unlockedElements.length > 0
            ? data.unlockedElements
                .filter((e) => e && typeof e.id === 'string')
                .map((e) => ({
                  id: normalizeId(e.id) || normalizeId(e.name),
                  name: e.name,
                  description: e.description ?? '',
                  categoryId: validCategoryIds.has(e.categoryId) ? e.categoryId : defaultCategoryId,
                  svg: typeof e.svg === 'string' ? sanitizeSVG(e.svg) : '',
                  createdAt: e.createdAt ?? Date.now(),
                  useCount: e.useCount ?? 0,
                  isForeign: e.isForeign,
                }))
            : isCompactElements
              ? INITIAL_WORKSPACE.elements.map((e) => ({ ...e }))
              : []

        // 桌面元素 + 位置：v3 紧凑引用用图鉴模板还原；旧格式直接规范化完整元素
        const importedPositions: Record<string, CardPosition> = {}
        let importedElements: Element[]
        if (isCompactElements) {
          const templateMap = new Map(importedUnlocked.map((e) => [e.id, e]))
          for (const t of RELIC_TEMPLATES) {
            if (!templateMap.has(t.id)) templateMap.set(t.id, t)
          }
          importedElements = []
          for (const ref of data.elements as StoredElementRef[]) {
            if (!ref || typeof ref.id !== 'string') continue
            const template = templateMap.get(ref.id)
            if (!template) continue
            const instanceUid = ref.instanceUid ?? uuid()
            importedElements.push({ ...template, instanceUid, ...(ref.relicId ? { relicId: ref.relicId } : {}) })
            if (Number.isFinite(ref.x) && Number.isFinite(ref.y)) {
              importedPositions[instanceUid] = { x: ref.x as number, y: ref.y as number }
            }
          }
        } else {
          importedElements = (data.elements as Element[])
            .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
            .map((e) => ({
              id: normalizeId(e.id) || normalizeId(e.name),
              name: e.name,
              description: e.description ?? '',
              categoryId: validCategoryIds.has(e.categoryId) ? e.categoryId : defaultCategoryId,
              svg: typeof e.svg === 'string' ? sanitizeSVG(e.svg) : '',
              createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
              useCount: typeof e.useCount === 'number' ? e.useCount : 0,
              isForeign: e.isForeign,
              instanceUid: e.instanceUid ?? uuid(),
            }))
          // 旧格式缺图鉴时从实例推导
          if (importedUnlocked.length === 0) {
            importedUnlocked = importedElements.map((e) => ({ ...e, instanceUid: undefined }))
          }
          // 旧格式位置表：key=instanceUid；仅保留与导入实例匹配的合法坐标
          const importedUids = new Set(importedElements.map((e) => e.instanceUid).filter((u): u is string => !!u))
          if (data.positions && typeof data.positions === 'object') {
            for (const [key, value] of Object.entries(data.positions)) {
              if (importedUids.has(key) && value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
                importedPositions[key] = { x: value.x, y: value.y }
              }
            }
          }
        }

        // 规范化导入的配方（过滤不存在的元素引用）。
        // ★ 必须用「已解锁图鉴库 + 桌面实例」的并集来验证 ID：
        //   只存在于图鉴（无桌面实例）的元素，其配方同样应保留，否则导入后会发现配方凭空消失。
        const validIds = new Set([
          ...importedElements.map((e) => e.id),
          ...importedUnlocked.map((e) => e.id),
        ])
        const importedRecipes: Recipe[] = data.recipes
          .filter(
            (r) =>
              r &&
              typeof r.id === 'string' &&
              validIds.has(r.inputA) &&
              validIds.has(r.inputB) &&
              Array.isArray(r.outputs) &&
              r.outputs.length > 0 &&
              r.outputs.every((o) => validIds.has(o)),
          )
          .map((r) => ({ id: r.id, inputA: r.inputA, inputB: r.inputB, outputs: r.outputs.slice(0, 3) }))

        // 导入合成历史（范式：仅 recipeId 引用配方）
        // - 新格式：h.recipeId 直接用
        // - 旧格式：h.inputA/h.inputB 快照 → 按无序输入对匹配导入配方；匹配不到则丢弃
        type RawHistory = Partial<CraftHistoryEntry> & {
          inputA?: { id?: string; name?: string; svg?: string }
          inputB?: { id?: string; name?: string; svg?: string }
        }
        const importedHistory: CraftHistoryEntry[] = Array.isArray(data.craftHistory)
          ? (data.craftHistory as RawHistory[])
              .filter((h) => {
                if (!h || typeof h.id !== 'string' || typeof h.timestamp !== 'number') return false
                if (typeof h.recipeId === 'string') return true
                return typeof h.inputA?.id === 'string' && typeof h.inputB?.id === 'string'
              })
              .map((h) => {
                let recipeId = typeof h.recipeId === 'string' ? h.recipeId : ''
                if (!recipeId) {
                  const a = h.inputA?.id ?? ''
                  const b = h.inputB?.id ?? ''
                  recipeId =
                    importedRecipes.find(
                      (r) => (r.inputA === a && r.inputB === b) || (r.inputA === b && r.inputB === a),
                    )?.id ?? ''
                }
                if (!recipeId) return null
                return {
                  id: h.id,
                  timestamp: h.timestamp,
                  recipeId,
                  source: (h.source === 'ai' ? 'ai' : 'local') as 'local' | 'ai',
                  ...(typeof h.newCount === 'number' ? { newCount: h.newCount } : {}),
                  ...(typeof h.note === 'string' ? { note: h.note } : {}),
                } as CraftHistoryEntry
              })
              .filter((h): h is CraftHistoryEntry => !!h)
          : []

        setElements(importedElements)
        setRecipes(importedRecipes)
        setCategories(importedCategories)
        setUnlockedElements(importedUnlocked)
        setCraftHistory(importedHistory)
        setPositions(importedPositions)
        setRelics(importedRelics)
        setNewElementCount(importedNewElementCount)
        return {
          ok: true,
          message: `成功导入 ${importedElements.length} 个元素、${importedRecipes.length} 条配方、${importedCategories.length} 个类别、${importedHistory.length} 条历史`,
        }
      } catch {
        return { ok: false, message: '导入失败：无法解析该文件' }
      }
    },
    [],
  )

  /** 获取导出文件名 */
  const getExportFilename = useCallback(() => {
    const date = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `alchemy-workspace-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.zip`
  }, [])

  /** 统计信息 */
  const stats = useMemo(
    () => ({
      /** id -> 工作区实例数量 */
      instanceCounts: elements.reduce<Record<string, number>>((acc, e) => {
        acc[e.id] = (acc[e.id] ?? 0) + 1
        return acc
      }, {}),
      /** id -> 被配方引用为输出的次数（使用频率） */
      usageCounts: recipes.reduce<Record<string, number>>((acc, r) => {
        for (const oid of r.outputs) {
          acc[oid] = (acc[oid] ?? 0) + 1
        }
        return acc
      }, {}),
      uniqueCount: new Set(unlockedElements.map((e) => e.id)).size,
      instanceCount: elements.length,
      recipeCount: recipes.length,
      categoryCount: categories.length,
    }),
    [elements, recipes, categories, unlockedElements],
  )

  return {
    elements,
    recipes,
    categories,
    unlockedElements,
    craftHistory,
    positions,
    setPositions,
    relics,
    newElementCount,
    isCrafting,
    craft,
    decomposeElement,
    exportWorkspace,
    importWorkspace,
    getExportFilename,
    findLocalRecipe,
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
  }
}
