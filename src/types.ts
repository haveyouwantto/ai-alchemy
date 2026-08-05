/** 元素类别：将元素分组归属，一个元素只能属于一个类别 */
export interface ElementCategory {
  /** 类别 ID（小写+下划线） */
  id: string
  /** 类别名称 */
  name: string
  /** 类别图标（SVG 代码） */
  icon: string
  /** 类别描述 */
  description: string
  /** 创建时间戳 */
  createdAt?: number
}

/** 工作区中的元素实例（卡牌） */
export interface Element {
  /** 元素 ID（小写字符，单词间用下划线连接，如 earth、holy_water） */
  id: string
  /** 元素名称 */
  name: string
  /** 元素描述（图鉴用） */
  description: string
  /** 所属类别 ID */
  categoryId: string
  /** SVG 图标代码 */
  svg: string
  /** 创建时间戳 */
  createdAt: number
  /** 被用作合成输入的总次数（使用频率） */
  useCount: number
  /** 是否来自其它世界（重名标记） */
  isForeign?: boolean
  /** 秘宝标记：桌面上的秘宝卡片（消耗品，用一次少一个） */
  relicId?: string
  /** 发现时间戳（图鉴解锁时间，用于时间排序与展示） */
  discoveredAt?: number
  /** 实例唯一标识（同一元素的多个副本区分用，UI 层 DOM key） */
  instanceUid?: string
}

/** 秘宝：消耗品类特殊物品（与元素同画风，但用一次少一个） */
export interface Relic {
  /** 秘宝 ID（如 blackening） */
  id: string
  /** 秘宝名称 */
  name: string
  /** 秘宝描述 */
  description: string
  /** 秘宝图标（元素徽章画风 SVG） */
  svg: string
}

/** 合成配方 */
export interface Recipe {
  id: string
  inputA: string // 元素ID
  inputB: string // 元素ID
  outputs: string[] // 元素ID数组 1~3
}

/** 合成触发记录（流水账：每次触发一次合成记录一条；遵循范式，仅以 recipeId 引用配方，不冗余元素信息） */
export interface CraftHistoryEntry {
  /** 记录唯一 ID */
  id: string
  /** 触发时间戳 */
  timestamp: number
  /** 引用配方 ID（输入/输出元素从配方实时解析） */
  recipeId: string
  /** 合成来源：本地配方 or AI 生成 */
  source: 'local' | 'ai'
  /** AI 生成时是否出现了新元素 */
  newCount?: number
  /** AI 生成时的炼金术笔记（AI 路径才有） */
  note?: string
}

/** 桌面卡片坐标（单位 px，相对工作区容器左上角） */
export interface CardPosition {
  x: number
  y: number
}

/** 工作区完整状态快照 */
export interface Workspace {
  elements: Element[]
  recipes: Recipe[]
  /** 元素类别 */
  categories: ElementCategory[]
}

/** AI 配置 */
export interface AIConfig {
  baseURL: string
  apiKey: string
  /** 模型名称（默认 gpt-4o-mini） */
  model: string
}

/** 新元素（AI 创建的草稿，含 ID 和描述） */
export interface NewElementDraft {
  /** 小写字符 + 下划线 */
  id: string
  name: string
  description: string
  svg_content: string
  /** 所属类别 ID */
  category_id?: string
}

/** 新类别（AI 创建的类别草稿） */
export interface NewCategoryDraft {
  id: string
  name: string
  icon: string
  description: string
}

/** craft_elements 工具参数 */
export interface CraftElementsArgs {
  new_elements: NewElementDraft[]
}

/** craft_recipe 工具参数 */
export interface CraftRecipeArgs {
  output_element_ids: string[]
}

/** create_category 工具参数 */
export interface CreateCategoryArgs {
  category: NewCategoryDraft
}

/** 工具调用 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: 'craft_elements' | 'craft_recipe' | 'create_category' | string
    arguments: string
  }
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}
