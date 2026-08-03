import type { Element, ElementCategory, Recipe } from './types'
import defaultWorkspace from './data/defaultWorkspace.json'

/** 初始基础元素列表（完全数据驱动，从 defaultWorkspace.json 加载） */
export const INITIAL_ELEMENTS: Element[] = defaultWorkspace.elements as Element[]

/** 初始元素类别 */
export const INITIAL_CATEGORIES: ElementCategory[] = defaultWorkspace.categories as ElementCategory[]

/** 默认类别 ID：天地万象 */
export const DEFAULT_CATEGORY_ID = 'cosmos'

/** 初始工作区：仅基础元素 + 天地万象类别，配方书为空 */
export const INITIAL_WORKSPACE: { elements: Element[]; recipes: Recipe[]; categories: ElementCategory[] } = {
  elements: defaultWorkspace.elements as Element[],
  recipes: [],
  categories: defaultWorkspace.categories as ElementCategory[],
}

/** LLM 系统提示词模板（固定前缀 + 动态注入） */
export const SYSTEM_PROMPT_TEMPLATE = `你是一个炼金术合成规则生成器。当前世界拥有以下元素类别（完整信息）：[类别列表]。元素按类别嵌套列出（每条仅含名称与 ID，不重复写出类别）：[元素列表]。本次参与合成的两个元素会在最后给出完整的名称、ID、类别与描述。玩家正尝试合成 [元素A] 和 [元素B]。
请根据科学原理或神话隐喻，生成合成产物。
规则：
1. 合成是无序的：A+B 与 B+A 完全等价，产物只取决于两个输入元素的组合，与先后顺序无关。
2. 生成 1 到 3 个产物。优先只生成 1 个最经典的产物；当存在多个同样经典、确切的隐喻时，可生成多个，最多 3 个。
3. 产物优先是具体可感知的物件。先推演两个输入融合后能形成的实体，只有在该隐喻实在无法具象时，才提炼为抽象概念。
4. 避免生成过于高级或偏僻的产物，除非隐喻极其直接且无可替代。生成与输入元素自然相关、能由玩家直觉理解的产物。
5. 如果产物是元素列表中已有的元素，必须直接引用其现有 ID，并沿用其原 SVG 图标，绝不重复创建。绝对不要为同一个元素编写第二份不同的 SVG。
6. 如果产物是全新的，请调用 craft_elements 创建它：
   - id 必须用英语书写：只能包含小写字母 a-z、数字 0-9 和下划线，单词间用下划线连接。严禁使用中文拼音或非英文字符作为 id
   - name 使用对应的中文名称，不要用英文
   - 为它写一段简短的 description（一两句即可）。描述只能刻画该元素本身的形态、性质或象征，严禁提及它是如何被合成的、由谁与谁组合而成、或者任何「合成/炼成/来源/配方/获得方式」相关的字眼
   - 元素应归属到合适的「大类」：当产物属于一个全新的、能容纳多个相近元素的宏大主题时，调用 create_category 创建这个大类别；已有合适的大类别时则直接复用归入。不要为单个元素创建过小或过于独特的类别，仅当产物与现有类别都毫不相干时，才为它建立新的大类别
   - 设计一个极简、抽象、美观的 SVG（画布 100x100，纯矢量）。具体物件要直观可辨，抽象概念则用简单的象征性图形表达
   - 类别名称要古风典雅、寓意隽永，正好4个汉字；类别描述同样古朴雅致
7. 必须调用 craft_recipe 绑定本次的输入和输出。
注意：不要生成与输入元素完全相同的产物；具体优先、避免浮夸；不要生成过于复杂或不合理的 SVG。`

/** Function Calling 工具 Schema */
export const FUNCTIONS = [
  {
    type: 'function',
    function: {
      name: 'craft_elements',
      description: '创建本次合成中出现的新元素',
      parameters: {
        type: 'object',
        properties: {
          new_elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '必须用英语书写：小写字母 a-z、数字 0-9、下划线，单词间用下划线连接；禁止中文拼音或非英文字符' },
                name: { type: 'string', description: '对应的中文名称' },
                description: { type: 'string', description: '元素文字描述（中文）' },
                svg_content: { type: 'string' },
                category_id: { type: 'string', description: '所属的大类别ID；若该产物属于全新的大主题，请先调用 create_category 创建类别再引用' },
              },
              required: ['id', 'name', 'description', 'svg_content'],
            },
          },
        },
        required: ['new_elements'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'craft_recipe',
      description: '记录本次双输入合成产生的输出结果ID',
      parameters: {
        type: 'object',
        properties: {
          output_element_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 3,
            description: '必须是已有元素ID或刚通过craft_elements创建的元素ID',
          },
        },
        required: ['output_element_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: '创建新的元素大类别（用于容纳多个主题相近的元素；仅当合成产物属于全新的宏大主题时才调用）',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '必须用英语书写：小写字母 a-z、数字 0-9、下划线，单词间用下划线连接；禁止中文拼音或非英文字符' },
              name: { type: 'string', description: '类别中文名称，要求古风典雅、寓意隽永，勿用直白口语或网络用语' },
              icon: { type: 'string', description: '100x100 纯矢量 SVG' },
              description: { type: 'string', description: '类别描述（中文，古朴雅致）' },
            },
            required: ['id', 'name', 'icon', 'description'],
          },
        },
        required: ['category'],
      },
    },
  },
] as const

/** 工作区随机摆放的边界（百分比） */
export const SPAWN_BOUNDS = { min: 10, max: 70 }

/** 合成动画时长（毫秒） */
export const CRAFT_ANIMATION_MS = 600