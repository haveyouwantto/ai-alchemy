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

/** 秘宝（消耗品类特殊物品）：与元素同画风，但用一次少一个。
 * 桌面实例以 Element 形式存在（带 relicId 标记），模板用于还原与展示。 */
export const RELIC_TEMPLATES: Element[] = [
  {
    id: 'relic_nigredo',
    name: '黑化',
    description: '与一个元素融合后，将其拆解为组成它的 1~3 个概念元素。消耗品，用一次少一个。',
    categoryId: 'relics',
    svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="relicGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#a855f7" stop-opacity="0.55"/><stop offset="100%" stop-color="#3b0764" stop-opacity="0"/></radialGradient><linearGradient id="relicPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2e1065"/><stop offset="55%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#0f0a1e"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#relicGlow)"/><circle cx="50" cy="50" r="37" fill="url(#relicPlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#c4b5fd" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.1" transform="rotate(-28 38 33)"/><circle cx="50" cy="51" r="16" fill="#0d0716" stroke="#e9d5ff" stroke-width="2.5"/><path d="M42 44 L46 51 L42 58 L48 62" stroke="#e9d5ff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 40 L58 47 L52 53 L56 59" stroke="#d8b4fe" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    createdAt: 0,
    useCount: 0,
    relicId: 'nigredo',
  },
  {
    id: 'relic_albedo',
    name: '白化',
    description: '与一个元素融合后，将其提取为更大更抽象的概念。消耗品，用一次少一个。',
    categoryId: 'relics',
    svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="albedoGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.5"/><stop offset="100%" stop-color="#64748b" stop-opacity="0"/></radialGradient><linearGradient id="albedoPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#475569"/><stop offset="55%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#albedoGlow)"/><circle cx="50" cy="50" r="37" fill="url(#albedoPlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#f1f5f9" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.1" transform="rotate(-28 38 33)"/><circle cx="50" cy="57" r="12" fill="#f8fafc"/><path d="M50 17 C53 24 54 27 54 31" stroke="#f8fafc" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M50 30 C44 33 42 37 43 41 C48 39 50 37 50 34" stroke="#e2e8f0" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M50 30 C56 33 58 37 57 41 C52 39 50 37 50 34" stroke="#e2e8f0" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
    createdAt: 0,
    useCount: 0,
    relicId: 'albedo',
  },
]

/** 秘宝初始库存 */
export const INITIAL_RELIC_COUNTS: Record<string, number> = {
  nigredo: 5,
  albedo: 5,
}

/** 每合成出多少个新元素，奖励 1 个「黑化」 */
export const RELIC_REWARD_NEW_ELEMENTS = 10

/** 元素徽章 SVG 模板（合成与拆解共用） */
const ELEMENT_BADGE_SVG = `    <svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
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
    </svg>`

/** 元素徽章使用规则（合成与拆解共用） */
const ELEMENT_BADGE_RULE =
  '按模板保留徽章结构，颜色换成该元素主题色系，渐变 id 唯一；中央主体浅亮色、拟物化，画在约 35~65 区域，简洁有层次，无额外装饰'

/** 类别图标（洛可可金饰）模板（合成与拆解共用） */
const CATEGORY_ICON_SVG = `    <svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
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
    </svg>`

/** 类别图标使用规则 */
const CATEGORY_ICON_RULE =
  '保持浅色底 + 双层框；四角四边花纹贴合类别主题，繁复精致、对称协调；中央主体大而粗（约 34~66 区域），缩小到 14px 仍清晰；配色按类别主题自定，渐变 id 唯一'

/** LLM 拆解提示词（黑化/nigredo 秘宝专用） */
export const DECOMPOSE_SYSTEM_PROMPT = `你是一个炼金术概念拆解器。玩家使用「黑化」秘宝与一个元素融合，把该元素拆解为组成它的 1~3 个概念元素。
要求：
1. 产出 1~3 个概念元素，尽量多拆：它们是构成该元素的核心概念（构成要素、组成部分、直接支撑它的本质概念），必须同源同层、彼此并列，严禁越级生成更宏大或更高层的事物。
2. 概念元素可以是图鉴中已有的元素（直接引用其现有 ID，绝不重复创建），也可以是全新元素（调用 craft_elements 创建：id 仅小写英文字母、数字、下划线；name 用中文；description 一两句，只描述元素本身；类别优先复用已有，确属全新宏大主题才 create_category）。全新元素的 SVG 必须以「元素徽章」固定模板绘制：
${ELEMENT_BADGE_SVG}
${ELEMENT_BADGE_RULE}
3. 若创建全新类别，其 icon 必须以「洛可可金饰」固定模板绘制：
${CATEGORY_ICON_SVG}
${CATEGORY_ICON_RULE}
4. 必须调用 craft_recipe 绑定本次输入（秘宝 + 被拆解元素）与全部输出。
5. 至少 1 个概念元素，最多 3 个。`

/** LLM 提取提示词（白化/albedo 秘宝专用） */
export const EXTRACT_SYSTEM_PROMPT = `你是一个炼金术净化师。玩家使用「白化」秘宝净化一个元素，把该元素提取为更大更抽象的概念。
要求：
1. 产出 1 个主产物（最多 3 个）：把该元素提炼为更高一层、更宏大的抽象概念（涵盖该元素本质的上位概念），所有产物处于同一抽象层级、彼此并列，严禁一步跳得过于遥远——只能向上抽象一层。
2. 概念可以是图鉴中已有的元素（直接引用其现有 ID，绝不重复创建），也可以是全新元素（调用 craft_elements 创建：id 仅小写英文字母、数字、下划线；name 用中文；description 一两句，只描述元素本身；类别优先复用已有，确属全新宏大主题才 create_category）。全新元素的 SVG 必须以「元素徽章」固定模板绘制：
${ELEMENT_BADGE_SVG}
${ELEMENT_BADGE_RULE}
3. 若创建全新类别，其 icon 必须以「洛可可金饰」固定模板绘制：
${CATEGORY_ICON_SVG}
${CATEGORY_ICON_RULE}
4. 必须调用 craft_recipe 绑定本次输入（秘宝 + 被净化元素）与全部输出。`

/** 每种秘宝专属的反应提示词（key=秘宝 id；触发反应时使用对应秘宝的提示词） */
export const RELIC_PROMPTS: Record<string, string> = {
  nigredo: DECOMPOSE_SYSTEM_PROMPT,
  albedo: EXTRACT_SYSTEM_PROMPT,
}

/** 每种秘宝的反应动作名（key=秘宝 id；黑化=拆解、白化=净化） */
export const RELIC_VERBS: Record<string, string> = {
  nigredo: '拆解',
  albedo: '净化',
}

/** LLM 系统提示词（固定不变部分）。
 * 所有动态数据（类别清单、元素图鉴、本次合成对象、相关配方）一律放在下一条 user 消息中构造，
 * 本模板不含任何占位符与动态注入。 */
export const SYSTEM_PROMPT_TEMPLATE = `你是一个炼金术合成规则生成器。当前世界的元素类别清单、元素图鉴（按类别分组，仅含名称与 ID）、本次参与合成的两个元素的完整信息（名称、ID、类别与描述），以及相关已有配方，都将在下一条用户消息中给出。
请以开放思维从多个维度推演，挑选最贴切、最能引发玩家共鸣的答案，不要只从单一角度思考。
规则：
1. 合成是无序的：A+B 与 B+A 完全等价，产物只取决于两个输入元素的组合，与先后顺序无关。
2. 默认只生成 1 个主产物（最多 3 个）。多产物时其余必须是同源同层的副产物，严禁把以主产物为原料才能造出的更高层级事物当作副产物；想不出同级副产物就只保留主产物。
3. 产物推理优先级从高到低，高优先级成立即采用：① 直接反应（两元素接触后最直接自然的物理化学结果）→ ② 逻辑组合（从属性、功能、意象组合成具体新事物）→ ③ 象征升华（都无法具象时才提炼抽象概念）。产物须自然相关、直觉可懂，避免过于高级或偏僻。
4. 产物若已存在于元素列表，直接引用其现有 ID 并沿用原 SVG，绝不重复创建。
5. 全新产物调用 craft_elements：
   - id 仅小写英文字母、数字、下划线；name 用中文
   - category_id 必填：优先复用已有大类，确属全新宏大主题才调用 create_category，不要为单个元素建过小类别
   - description 一两句，只描述元素本身，严禁提及合成来源
   - 设计一个美观的 SVG（画布 100x100，纯矢量），必须以固定模板绘制「元素徽章」：
${ELEMENT_BADGE_SVG}
${ELEMENT_BADGE_RULE}
   - 类别（category）icon 使用与元素完全不同的「洛可可金饰」画风：浅色羊皮纸底 + 复杂花纹框架，二者在风格上形成鲜明区分。配色不强制，由你根据类别主题自行决定：
${CATEGORY_ICON_SVG}
${CATEGORY_ICON_RULE}
   - 新类别名称 4 个汉字，古朴雅致
6. 必须调用 craft_recipe 绑定本次输入与输出。
注意：产物不得与任一输入完全相同。`

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
