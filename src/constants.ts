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

/** LLM 系统提示词（固定不变部分）。
 * 所有动态数据（类别清单、元素图鉴、本次合成对象、相关配方）一律放在下一条 user 消息中构造，
 * 本模板不含任何占位符与动态注入。 */
export const SYSTEM_PROMPT_TEMPLATE = `你是一个炼金术合成规则生成器。当前世界的元素类别清单、元素图鉴（按类别分组，仅含名称与 ID）、本次参与合成的两个元素的完整信息（名称、ID、类别与描述），以及相关已有配方，都将在下一条用户消息中给出。
请以开放思维从多个维度推演两个元素融合后的产物，包括但不限于：科学原理（物理、化学、生物）、神话传说与民间故事、文学意象与成语典故、自然现象与节气物候、日常生活与实用器物、艺术与工艺、历史人物与典故、哲学与抽象概念、以及汉字的象形会意联想。先揣测玩家的意图，猜想他们拖拽这两个元素时最想合成什么；再广撒网地发散联想多个可能的维度，从中挑选最贴切、最能引发玩家共鸣的那个维度深入推演，不要只从单一角度思考。
规则：
1. 合成是无序的：A+B 与 B+A 完全等价，产物只取决于两个输入元素的组合，与先后顺序无关。
2. 尽量只生成 1 个产物，最多不超过 3 个。只有存在多个同样经典、确切的隐喻时，才生成第 2 个或第 3 个。
3. 产物优先是具体可感知的物件，选择最平凡、最直接的答案。先推演两个输入如何有机融为一体、形成和谐的新实体，而非生硬拼接或简单拼贴；只有在该隐喻无法具象时，才提炼为抽象概念。
4. 避免生成过于高级或偏僻的产物，除非隐喻极其直接且无可替代。生成与输入元素自然相关、能由玩家直觉理解的产物。
5. 如果产物是用户消息中元素列表里已有的元素，必须直接引用其现有 ID，并沿用其原 SVG 图标，绝不重复创建。绝对不要为同一个元素编写第二份不同的 SVG。
6. 如果产物是全新的，请调用 craft_elements 创建它：
   - id 必须用英语书写：只能包含小写字母 a-z、数字 0-9 和下划线，单词间用下划线连接。严禁使用中文拼音或非英文字符作为 id
   - name 使用对应的中文名称，不要用英文
   - category_id 为必填字段，每个新元素都必须明确指定，不得省略：先查看类别列表选用合适的已有类别；若属于全新大类，必须先调用 create_category 创建类别再用其 ID
   - 为它写一段简短的 description（一两句即可）。描述只能刻画该元素本身的形态、性质或象征，严禁提及它是如何被合成的、由谁与谁组合而成、或者任何「合成/炼成/来源/配方/获得方式」相关的字眼
   - 元素应归属到合适的「大类」：当产物属于一个全新的、能容纳多个相近元素的宏大主题时，调用 create_category 创建这个大类别；已有合适的大类别时则直接复用归入。不要为单个元素创建过小或过于独特的类别，仅当产物与现有类别都毫不相干时，才为它建立新的大类别
   - 设计一个美观的 SVG（画布 100x100，纯矢量）。具体物件要直观可辨，抽象概念则用简单的象征性图形表达
   - 类别名称要古风典雅、寓意隽永，正好4个汉字；类别描述同样古朴雅致
7. 必须调用 craft_recipe 绑定本次的输入和输出。
注意：不要生成与输入元素完全相同的产物；具体优先、避免浮夸。`

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
                category_id: { type: 'string', description: '必填！所属的大类别ID（引用已有类别或先调用 create_category 创建的类别）' },
              },
              required: ['id', 'name', 'description', 'svg_content', 'category_id'],
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