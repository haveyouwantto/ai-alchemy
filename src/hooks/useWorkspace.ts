import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import type {
  AIConfig,
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
import { parseToolArguments, streamChatCompletion } from '../aiClient'
import { sanitizeSVG, uuid } from '../utils'

/** AI 多轮工具调用的最大轮数 */
const MAX_AI_ROUNDS = 6

/** 合成历史保留的最大条数（最近 50 条） */
const MAX_HISTORY_LIMIT = 50

/** 合成结果类型 */
export type CraftOutcome =
  | { type: 'local'; added: Element[]; known: string[] }
  | { type: 'ai'; added: Element[]; known: string[]; newCount: number; recipeCount: number }
  | { type: 'error'; message: string }

interface StateRef {
  elements: Element[]
  recipes: Recipe[]
  categories: ElementCategory[]
  unlockedElements: Element[]
  craftHistory: CraftHistoryEntry[]
}

const STORAGE_KEY = 'alchemy-workspace-data'

/** 旧拼音类别 ID → 英文 ID 迁移映射 */
const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  tian_di_wan_xiang: 'cosmos',
}

interface StoredWorkspace {
  elements: Element[]
  recipes: Recipe[]
  categories: ElementCategory[]
  /** 已解锁的元素类型库（图鉴数据源，独立于工作区实例，不会被消耗删除） */
  unlockedElements: Element[]
  /** 合成触发流水（最近 50 条） */
  craftHistory: CraftHistoryEntry[]
}

/**
 * 从 localStorage 加载持久化的工作区数据。
 * 兼容旧数据：无 categories/description/unlockedElements 时补默认；旧拼音类别 ID 迁移为英文 ID。
 */
function loadStoredWorkspace(): StoredWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Workspace> & {
        unlockedElements?: Element[]
        craftHistory?: CraftHistoryEntry[]
      }
      if (Array.isArray(parsed.elements) && Array.isArray(parsed.recipes)) {
        // 迁移类别 ID
        const migId = (id: string) => LEGACY_CATEGORY_ID_MAP[id] ?? id
        const categories = Array.isArray(parsed.categories)
          ? parsed.categories.map((c) => ({ ...c, id: migId(c.id) }))
          : INITIAL_WORKSPACE.categories
        const elements = parsed.elements.map((e) => ({
          ...e,
          categoryId: e.categoryId ? migId(e.categoryId) : DEFAULT_CATEGORY_ID,
        }))
        // 已解锁元素库：优先读存档；缺省时从当前实例推导（保证图鉴不因消耗而丢失元素）
        let unlockedElements: Element[]
        if (Array.isArray(parsed.unlockedElements) && parsed.unlockedElements.length > 0) {
          unlockedElements = parsed.unlockedElements.map((e) => ({
            ...e,
            categoryId: e.categoryId ? migId(e.categoryId) : DEFAULT_CATEGORY_ID,
          }))
        } else {
          const map = new Map<string, Element>()
          for (const e of elements) map.set(e.id, e)
          unlockedElements = Array.from(map.values())
        }
        return {
          elements,
          recipes: parsed.recipes,
          categories,
          unlockedElements,
          // 历史记录：仅保留合法条目，截断到最近 50 条
          craftHistory: Array.isArray(parsed.craftHistory)
            ? parsed.craftHistory
                .filter(
                  (h) =>
                    h &&
                    typeof h.id === 'string' &&
                    typeof h.timestamp === 'number' &&
                    h.inputA &&
                    h.inputB &&
                    Array.isArray(h.outputs),
                )
                .slice(-MAX_HISTORY_LIMIT)
            : [],
        }
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { ...INITIAL_WORKSPACE, unlockedElements: INITIAL_WORKSPACE.elements, craftHistory: [] }
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
    return {
      elements: stored.elements.map((e) => ({
        ...e,
        instanceUid: e.instanceUid ?? uuid(),
        id: e.id && /^[a-z0-9_]+$/.test(e.id) ? e.id : normalizeId(e.name || 'element'),
        description: e.description ?? '',
        categoryId: e.categoryId ?? defaultCategory?.id ?? DEFAULT_CATEGORY_ID,
        // 基础四元素始终采用官方最新图标（如土的棕色粉末堆）
        svg:
          (INITIAL_ELEMENTS.find((def) => def.id === e.id)?.svg ?? e.svg),
      })),
      recipes: stored.recipes,
      // 基础类别（如天地万象）始终采用官方最新描述与图标，旧存档即时生效
      categories:
        stored.categories.length > 0
          ? stored.categories.map((c) => {
              const official = INITIAL_WORKSPACE.categories.find((def) => def.id === c.id)
              return official ? { ...c, description: official.description, icon: official.icon } : c
            })
          : INITIAL_WORKSPACE.categories,
      unlockedElements: stored.unlockedElements.map((e) => ({
        ...e,
        id: e.id && /^[a-z0-9_]+$/.test(e.id) ? e.id : normalizeId(e.name || 'element'),
        description: e.description ?? '',
        categoryId: e.categoryId ?? defaultCategory?.id ?? DEFAULT_CATEGORY_ID,
        svg: INITIAL_ELEMENTS.find((def) => def.id === e.id)?.svg ?? e.svg,
      })),
      craftHistory: stored.craftHistory,
    }
  }, [])

  const [elements, setElements] = useState<Element[]>(initial.elements)
  const [recipes, setRecipes] = useState<Recipe[]>(initial.recipes)
  const [categories, setCategories] = useState<ElementCategory[]>(initial.categories)
  /** 已解锁元素类型库（图鉴数据源，独立于工作区实例，不会因消耗/删除而消失） */
  const [unlockedElements, setUnlockedElements] = useState<Element[]>(initial.unlockedElements)
  /** 合成触发流水（最近 50 条） */
  const [craftHistory, setCraftHistory] = useState<CraftHistoryEntry[]>(initial.craftHistory)

  // 正在合成中（防止重复拖拽）
  const [isCrafting, setIsCrafting] = useState(false)

  // 引用，用于异步回调中读取最新状态
  const stateRef = useRef<StateRef>({ elements, recipes, categories, unlockedElements, craftHistory: [] })
  useEffect(() => {
    stateRef.current = { elements, recipes, categories, unlockedElements, craftHistory }
  }, [elements, recipes, categories, unlockedElements, craftHistory])

  // 自动持久化到 localStorage（元素 + 配方 + 类别 + 图鉴 + 合成历史）
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ elements, recipes, categories, unlockedElements, craftHistory }),
      )
    } catch {
      // ignore quota / privacy errors
    }
  }, [elements, recipes, categories, unlockedElements, craftHistory])

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

  /**
   * 清空桌面：仅清空桌面上的元素实例为初始四基础元素。
   * 保留：配方书、图鉴（已解锁库）、类别、合成历史 —— 玩家的进度不会丢失。
   */
  const resetWorkspace = useCallback(() => {
    setElements(INITIAL_WORKSPACE.elements.map((e) => ({ ...e, instanceUid: uuid() })))
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
  }, [])

  /** 向合成历史追加一条记录（自动截断到最近 MAX_HISTORY_LIMIT 条） */
  const addCraftHistoryEntry = useCallback(
    (entry: Omit<CraftHistoryEntry, 'id' | 'timestamp'>) => {
      setCraftHistory((prev) => {
        const next: CraftHistoryEntry = {
          id: uuid(),
          timestamp: Date.now(),
          ...entry,
        }
        return [...prev, next].slice(-MAX_HISTORY_LIMIT)
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
      // 记录合成历史（每次触发记一条）
      addCraftHistoryEntry({
        inputA: { id: inputA.id, name: inputA.name, svg: inputA.svg },
        inputB: { id: inputB.id, name: inputB.name, svg: inputB.svg },
        outputs: outputs.map((o) => ({ id: o.id, name: o.name, svg: o.svg })),
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

      const systemPrompt = SYSTEM_PROMPT_TEMPLATE
        .replace('[元素列表]', elementList)
        .replace('[类别列表]', categoryList)
        .replace('[元素A]', inputA.name)
        .replace('[元素B]', inputB.name)
        .concat(
          `\n本次合成对象的含义：\n${inputA.name}（类别：${catNameOf(inputA.categoryId)}）${inputDescA}\n${inputB.name}（类别：${catNameOf(inputB.categoryId)}）${inputDescB}\n相关已有配方：${recipeDesc}`,
        )

      const userPrompt = `请现在合成 ${inputA.name} 和 ${inputB.name}，并调用相应工具。`

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

        // ---- 多轮循环 ----
        for (let round = 0; round < MAX_AI_ROUNDS; round++) {
          const result = await streamChatCompletion(
            aiConfig,
            messages,
            [...FUNCTIONS],
            (text) => {
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

          // ---- 执行本轮所有工具调用 ----
          for (const tc of toolCalls) {
            if (tc.function.name === 'create_category') {
              const args = parseToolArguments<CreateCategoryArgs>(tc.function.arguments)
              const draft = args?.category
              if (draft?.name) {
                // 类别 ID：优先用 AI 提供的（规范化），无效/空时基于名称生成
                const catId =
                  normalizeId(draft.id || '') ||
                  normalizeId(draft.name) ||
                  `category_${Date.now().toString(36)}`
                // 避免与已有类别冲突
                const exists =
                  stateRef.current.categories.some((c) => c.id === catId) ||
                  createdCategories.some((c) => c.id === catId)
                if (!exists) {
                  createdCategories.push({
                    id: catId,
                    name: draft.name.trim(),
                    icon: sanitizeSVG(draft.icon || ''),
                    description: draft.description?.trim() || '',
                    createdAt: Date.now(),
                  })
                }
              }
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: true, created_categories: createdCategories.map((c) => c.id) }),
              })
            } else if (tc.function.name === 'craft_elements') {
              const args = parseToolArguments<CraftElementsArgs>(tc.function.arguments)
              const createdResults: Array<{ name: string; id: string }> = []

              for (const draft of args?.new_elements ?? []) {
                const name = draft.name?.trim()
                if (!name) continue

                // 元素 ID：AI 提供或按名称规范化
                let elementId = normalizeId(draft.id || name)

                // 前端兜底：若已解锁库中存在同名/同ID元素，直接复用模板（含原始SVG），不创建新元素
                const existingByName = stateRef.current.unlockedElements.find((e) => e.name === name)
                const existingById = stateRef.current.unlockedElements.find((e) => e.id === elementId)
                const existing = existingByName ?? existingById
                if (existing) {
                  newElementRefs.set(existing.id, existing.id)
                  newElementIdByName.set(name, existing.id)
                  newElementIdByName.set(existing.name, existing.id)
                  createdResults.push({ name: existing.name, id: existing.id })
                  continue
                }

                // 元素重名处理：与现有元素或本轮已创建元素同名时追加“(异界)”后缀
                const nameTaken =
                  stateRef.current.elements.some((e) => e.name === name) ||
                  newElements.some((e) => e.name === name)
                const finalName = nameTaken ? `${name}(异界)` : name
                if (
                  stateRef.current.unlockedElements.some((e) => e.id === elementId) ||
                  newElements.some((e) => e.id === elementId)
                ) {
                  elementId = `${elementId}_${newElements.length + createdCategories.length + 1}`
                }
                // 类别 ID：AI 提供（若是本轮新建则直接归入），否则默认天地万象
                let categoryId = draft.category_id ? normalizeId(draft.category_id) : DEFAULT_CATEGORY_ID
                const categoryValid =
                  stateRef.current.categories.some((c) => c.id === categoryId) ||
                  createdCategories.some((c) => c.id === categoryId)
                if (!categoryValid) {
                  categoryId = DEFAULT_CATEGORY_ID
                }

                newElements.push({
                  id: elementId,
                  name: finalName,
                  description: draft.description?.trim() || '',
                  categoryId,
                  svg: sanitizeSVG(draft.svg_content || ''),
                  createdAt: Date.now(),
                  useCount: 0,
                  isForeign: nameTaken,
                })
                if (!newElementRefs.has(elementId)) newElementRefs.set(elementId, elementId)
                newElementIdByName.set(name, elementId)
                newElementIdByName.set(finalName, elementId)
                createdResults.push({ name: finalName, id: elementId })
              }

              // 将工具执行结果（新元素 ID）回传给模型
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ created: createdResults }),
              })
            } else if (tc.function.name === 'craft_recipe') {
              const args = parseToolArguments<CraftRecipeArgs>(tc.function.arguments)
              recipeOutputIds = args?.output_element_ids ?? []
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: true, received_output_ids: recipeOutputIds }),
              })
            }
          }

          // 已收集到配方输出 → 提前结束
          if (recipeOutputIds.length > 0) break
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

        // 记录合成历史（每次触发记一条）
        addCraftHistoryEntry({
          inputA: { id: inputA.id, name: inputA.name, svg: inputA.svg },
          inputB: { id: inputB.id, name: inputB.name, svg: inputB.svg },
          outputs: producedInstances.map((e) => ({ id: e.id, name: e.name, svg: e.svg })),
          source: 'ai',
          newCount: newElements.length,
        })

        onMessage('凝固新元素...')
        return { type: 'ai', added, known, newCount: newElements.length, recipeCount: 1 }
      } finally {
        setIsCrafting(false)
      }
    },
    [isCrafting, findLocalRecipe, executeLocalRecipe, buildMessages, consumeInputs, bumpUseCount, unlockElements, addCraftHistoryEntry],
  )

  /** 导出工作区为 ZIP（manifest.json） */
  const exportWorkspace = useCallback(async (): Promise<Blob> => {
    const manifest: Workspace & { unlockedElements: Element[]; craftHistory: CraftHistoryEntry[] } = {
      elements: stateRef.current.elements,
      recipes: stateRef.current.recipes,
      categories: stateRef.current.categories,
      unlockedElements: stateRef.current.unlockedElements,
      craftHistory: stateRef.current.craftHistory,
    }
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
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
        const raw = await manifestFile.async('text')
        const data = JSON.parse(raw) as Workspace & {
          unlockedElements?: Element[]
          craftHistory?: CraftHistoryEntry[]
        }
        if (!Array.isArray(data.elements) || !Array.isArray(data.recipes)) {
          return { ok: false, message: 'manifest.json 格式不正确' }
        }

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

        // 规范化导入的元素（保证字段完整，并为每个实例分配独立 instanceUid）
        const importedElements: Element[] = data.elements
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

        // 已解锁元素库（缺省从导入元素推导）
        const importedUnlocked: Element[] =
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
            : importedElements.map((e) => ({ ...e, instanceUid: undefined }))

        // 规范化导入的配方（过滤不存在的元素引用）
        const validIds = new Set(importedElements.map((e) => e.id))
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

        // 导入合成历史（仅保留合法条目，截断到最近 50 条）
        const importedHistory: CraftHistoryEntry[] = Array.isArray(data.craftHistory)
          ? data.craftHistory
              .filter(
                (h) =>
                  h &&
                  typeof h.id === 'string' &&
                  typeof h.timestamp === 'number' &&
                  h.inputA &&
                  typeof h.inputA.name === 'string' &&
                  h.inputB &&
                  typeof h.inputB.name === 'string' &&
                  Array.isArray(h.outputs),
              )
              .map((h) => ({
                id: h.id,
                timestamp: h.timestamp,
                inputA: {
                  id: h.inputA.id ?? '',
                  name: h.inputA.name,
                  svg: typeof h.inputA.svg === 'string' ? h.inputA.svg : '',
                },
                inputB: {
                  id: h.inputB.id ?? '',
                  name: h.inputB.name,
                  svg: typeof h.inputB.svg === 'string' ? h.inputB.svg : '',
                },
                outputs: h.outputs
                  .filter(
                    (o) => o && typeof o.name === 'string' && (typeof o.id === 'string' || typeof o.id === 'undefined'),
                  )
                  .map((o) => ({ id: o.id ?? '', name: o.name, svg: typeof o.svg === 'string' ? o.svg : '' })),
                source: (h.source === 'ai' ? 'ai' : 'local') as 'local' | 'ai',
                newCount: h.newCount,
              }))
              .slice(-MAX_HISTORY_LIMIT)
          : []

        setElements(importedElements)
        setRecipes(importedRecipes)
        setCategories(importedCategories)
        setUnlockedElements(importedUnlocked)
        setCraftHistory(importedHistory)
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
    isCrafting,
    craft,
    exportWorkspace,
    importWorkspace,
    getExportFilename,
    findLocalRecipe,
    duplicateElement,
    removeElementInstance,
    addElementFromLibrary,
    resetWorkspace,
    clearAllData,
    clearCraftHistory,
    stats,
  }
}
