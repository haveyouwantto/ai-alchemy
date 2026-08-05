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
2. 尽量只生成 1 个主产物，最多不超过 3 个。只有存在多个同样经典、确切的隐喻时，才生成第 2 个或第 3 个；多产物时必须呈现「一个主产物 + 若干副产物」的主次关系——第一个输出必须是最贴切、最直接的主产物，其余为围绕它的副产物（如余料、伴生物、附加产物），所有产物必须逻辑相关、同源衍生，严禁把彼此无关、思路割裂的不同事物强行并列。
3. 产物推理按优先级从高到低，高优先级成立即采用，不要跳级：
   ① 直接反应（第一优先）：两个元素接触后最直接、最自然的反应或变化产物——如遇火燃烧、遇水溶解/凝结、氧化生锈、汽化冷凝、酸碱中和等物理化学结果。优先做这种直觉可验、具体可感知的直接反应；
   ② 逻辑组合（其次）：直接反应不成立或过于无趣时，再从属性、功能、意象上逻辑组合两者，形成具体可感知的新事物（如功能结合、材质结合、场景关联），而非生硬拼接或简单拼贴；
   ③ 象征升华（兜底）：以上都无法具象时，才提炼为抽象概念。
4. 避免生成过于高级或偏僻的产物，除非隐喻极其直接且无可替代。生成与输入元素自然相关、能由玩家直觉理解的产物。
5. 如果产物是用户消息中元素列表里已有的元素，必须直接引用其现有 ID，并沿用其原 SVG 图标，绝不重复创建。绝对不要为同一个元素编写第二份不同的 SVG。
6. 如果产物是全新的，请调用 craft_elements 创建它：
   - id 必须用英语书写：只能包含小写字母 a-z、数字 0-9 和下划线，单词间用下划线连接。严禁使用中文拼音或非英文字符作为 id
   - name 使用对应的中文名称，不要用英文
   - category_id 为必填字段，每个新元素都必须明确指定，不得省略：先查看类别列表选用合适的已有类别；若属于全新大类，必须先调用 create_category 创建类别再用其 ID
   - 为它写一段简短的 description（一两句即可）。描述只能刻画该元素本身的形态、性质或象征，严禁提及它是如何被合成的、由谁与谁组合而成、或者任何「合成/炼成/来源/配方/获得方式」相关的字眼
   - 元素应归属到合适的「大类」：当产物属于一个全新的、能容纳多个相近元素的宏大主题时，调用 create_category 创建这个大类别；已有合适的大类别时则直接复用归入。不要为单个元素创建过小或过于独特的类别，仅当产物与现有类别都毫不相干时，才为它建立新的大类别
   - 设计一个美观的 SVG（画布 100x100，纯矢量），必须以固定模板绘制「元素徽章」：
     <svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <radialGradient id="elementGlow" cx="50%" cy="42%" r="60%">
           <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.55"/>
           <stop offset="100%" stop-color="#0369a1" stop-opacity="0"/>
         </radialGradient>
         <linearGradient id="elementPlate" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="#0c4a6e"/>
           <stop offset="55%" stop-color="#075985"/>
           <stop offset="100%" stop-color="#082f49"/>
         </linearGradient>
       </defs>
       <circle cx="50" cy="50" r="46" fill="url(#elementGlow)"/>
       <circle cx="50" cy="50" r="37" fill="url(#elementPlate)"/>
       <circle cx="50" cy="50" r="37" fill="none" stroke="#bae6fd" stroke-opacity="0.28" stroke-width="1.5"/>
       <ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.12" transform="rotate(-28 38 33)"/>
       <!-- 在此处绘制居中主体图形 -->
     </svg>
     模板使用规则：
     * 保留圆形徽章结构（光晕圆 + 深色渐变圆盘 + 细描边 + 左上高光），把模板中的蓝色系替换为该元素主题色系：深色圆盘用该色系的深色，光晕与描边用其亮色
     * 在圆盘正中（约 35~65 区域）绘制一个浅亮色、拟物化的主体图形——具体物件画出清晰直观的实物造型，抽象概念则用简洁具象的象征图形表达；主体用同色系深浅渐变与高光体现层次与体积感，保持简洁精致，避免零碎细节
     * 除圆盘与中央主体外，不要额外背景、边框、文字或装饰；把模板里的渐变 id（elementGlow/elementPlate）改为与元素相关且唯一的 id（如 fireGlow、firePlate），不要使用 grad、g 这类通用 id
   - 类别（category）icon 使用与元素完全不同的「洛可可金饰」画风：浅色羊皮纸底 + 复杂花纹框架（既不是深色圆形徽章，也不是盾牌，保证区分度）。配色不强制，由你根据类别主题自行决定：
     <svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="catBase" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="#fdf4e0"/>
           <stop offset="100%" stop-color="#eedcb8"/>
         </linearGradient>
       </defs>
       <rect x="4" y="4" width="92" height="92" rx="26" fill="url(#catBase)" stroke="#b08d57" stroke-width="2"/>
       <rect x="9" y="9" width="82" height="82" rx="20" fill="none" stroke="#b08d57" stroke-width="3"/>
       <!-- 四角 + 四边花纹：按类别主题自由设计，配色自定 -->
       <!-- 在此处绘制居中的主体图形（约 34~66 区域） -->
     </svg>
     类别模板规则：
     * 保持浅色底 + 双层框的版式，禁止改成深色底、圆形徽章或盾牌
     * 花纹贴合类别主题自由设计（四角 + 四边至少 6 处），繁复精致、对称协调，不要生硬堆砌无关花纹
     * 中央拟物主体画得大而粗：约占 34~66 区域，轮廓简洁、一眼可辨，严禁细小零碎细节（缩小到 14px 后无法辨认）
     * 配色由你按类别主题决定，保持整体和谐；渐变 id 与类别相关且唯一（如 cosmosBase），不要额外装饰或文字
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
              icon: { type: 'string', description: '100x100 纯矢量 SVG，遵循系统提示词中的「洛可可金饰」类别模板：浅色羊皮纸底 + 双层框，花纹贴合类别主题、配色由你决定，中央大主体图形，与元素徽章完全不同，保证 14~22px 小尺寸下清晰可辨' },
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
