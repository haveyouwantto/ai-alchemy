import type { Achievement, Element, ElementCategory, Recipe } from './types'
import defaultWorkspace from './data/defaultWorkspace.json'

/** 初始基础元素列表（完全数据驱动，从 defaultWorkspace.json 加载） */
export const INITIAL_ELEMENTS: Element[] = defaultWorkspace.elements as Element[]

/** 初始元素类别 */
export const INITIAL_CATEGORIES: ElementCategory[] = defaultWorkspace.categories as ElementCategory[]

/** 默认类别 ID：天地万象 */
export const DEFAULT_CATEGORY_ID = 'primal_matter'

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
    description: '漆黑之蚀，炼金四阶段之始。触之令万物析出本相——将一个元素分解为构成它的 1~3 个概念。消耗品，用一次少一个。',
    categoryId: 'relics',
    svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="relicGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#a855f7" stop-opacity="0.55"/><stop offset="100%" stop-color="#3b0764" stop-opacity="0"/></radialGradient><linearGradient id="relicPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2e1065"/><stop offset="55%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#0f0a1e"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#relicGlow)"/><circle cx="50" cy="50" r="37" fill="url(#relicPlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#c4b5fd" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.1" transform="rotate(-28 38 33)"/><circle cx="50" cy="51" r="16" fill="#0d0716" stroke="#e9d5ff" stroke-width="2.5"/><path d="M42 44 L46 51 L42 58 L48 62" stroke="#e9d5ff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 40 L58 47 L52 53 L56 59" stroke="#d8b4fe" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    createdAt: 0,
    useCount: 0,
    relicId: 'nigredo',
  },
  {
    id: 'relic_albedo',
    name: '白化',
    description: '净白之辉，炼金四阶段之次。拂去尘杂，令本质升华——将一个元素提取为更宏大、更抽象的概念。消耗品，用一次少一个。',
    categoryId: 'relics',
    svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="albedoGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.5"/><stop offset="100%" stop-color="#64748b" stop-opacity="0"/></radialGradient><linearGradient id="albedoPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#475569"/><stop offset="55%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#albedoGlow)"/><circle cx="50" cy="50" r="37" fill="url(#albedoPlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#f1f5f9" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.1" transform="rotate(-28 38 33)"/><circle cx="50" cy="57" r="12" fill="#f8fafc"/><path d="M50 17 C53 24 54 27 54 31" stroke="#f8fafc" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M50 30 C44 33 42 37 43 41 C48 39 50 37 50 34" stroke="#e2e8f0" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M50 30 C56 33 58 37 57 41 C52 39 50 37 50 34" stroke="#e2e8f0" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
    createdAt: 0,
    useCount: 0,
    relicId: 'albedo',
  },
  {
    id: 'relic_citrinitas',
    name: '黄化',
    description: '熔金之辉，炼金四阶段之三。烈焰淬炼，令物质升华——将一个元素精炼为更精纯、更高阶的具体物质。消耗品，用一次少一个。',
    categoryId: 'relics',
    svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="citriGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.55"/><stop offset="100%" stop-color="#92400e" stop-opacity="0"/></radialGradient><linearGradient id="citriPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#78350f"/><stop offset="55%" stop-color="#5b2a0b"/><stop offset="100%" stop-color="#451a03"/></linearGradient><linearGradient id="citriGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#citriGlow)"/><circle cx="50" cy="50" r="37" fill="url(#citriPlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#fcd34d" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.1" transform="rotate(-28 38 33)"/><path d="M33 66 L37 44 L63 44 L67 66 Z" fill="url(#citriGold)"/><path d="M37 44 L50 34 L63 44 Z" fill="#fde68a"/><path d="M45 54 L50 48 L55 54 L50 60 Z" fill="#b45309" opacity="0.5"/></svg>',
    createdAt: 0,
    useCount: 0,
    relicId: 'citrinitas',
  },
  {
    id: 'relic_rubedo',
    name: '赤化',
    description: '赤霞之辉，炼金四阶段之终。贤者之石的临门一脚——点化一个元素，将其转化为你指定的另一元素，成败全凭说服。消耗品，成功点化才消耗。',
    categoryId: 'relics',
    svg: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="rubedoGlow" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#f87171" stop-opacity="0.5"/><stop offset="100%" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient><linearGradient id="rubedoPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7f1d1d"/><stop offset="55%" stop-color="#641414"/><stop offset="100%" stop-color="#450a0a"/></linearGradient><radialGradient id="rubedoOrb" cx="45%" cy="38%" r="65%"><stop offset="0%" stop-color="#fecaca"/><stop offset="45%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#rubedoGlow)"/><circle cx="50" cy="50" r="37" fill="url(#rubedoPlate)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#fca5a5" stroke-opacity="0.3" stroke-width="1.5"/><ellipse cx="38" cy="33" rx="15" ry="7" fill="#ffffff" opacity="0.1" transform="rotate(-28 38 33)"/><circle cx="50" cy="51" r="17" fill="none" stroke="#fecaca" stroke-width="2.5" opacity="0.8"/><circle cx="50" cy="51" r="11" fill="url(#rubedoOrb)"/><circle cx="46" cy="46" r="3" fill="#ffffff" opacity="0.6"/></svg>',
    createdAt: 0,
    useCount: 0,
    relicId: 'rubedo',
  },
]

/** 秘宝初始库存 */
export const INITIAL_RELIC_COUNTS: Record<string, number> = {
  nigredo: 5,
  albedo: 3,
  citrinitas: 1,
  rubedo: 0,
}

/** 每合成出多少个新元素，奖励 1 个「黑化」 */
export const RELIC_REWARD_NEW_ELEMENTS = 10

/** 每解锁多少个元素，奖励 1 个「白化」 */
export const RELIC_ALBEDO_UNLOCK_INTERVAL = 20

/** 每解锁多少个元素，奖励 1 个「黄化」 */
export const RELIC_CITRINITAS_UNLOCK_INTERVAL = 40

/** 每解锁多少个元素，奖励 1 个「赤化」 */
export const RELIC_RUBEDO_UNLOCK_INTERVAL = 80

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

/** 类别图标（洛可可花纹）模板（合成与拆解共用） */
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

/** 创建新元素的公共规则（合成与所有秘宝共用，避免命名/类别/SVG 规则分散） */
export const CREATE_ELEMENTS_RULES = `- id 仅小写英文字母、数字、下划线；name 用中文
- category_id 必填：优先复用已有类别，确属全新主题（如天文，化学，生物，地质，文明，人类)才调用 create_category，不要为单个元素建过小类别
- description 一两句，只描述元素本身，严禁提及合成来源
- 全新元素的 SVG 必须以「元素徽章」固定模板绘制：
${ELEMENT_BADGE_SVG}
${ELEMENT_BADGE_RULE}
- 若创建全新类别，其 icon 必须以「洛可可花纹」固定模板绘制：
${CATEGORY_ICON_SVG}
${CATEGORY_ICON_RULE}
- 新类别名称必须正好 4 个汉字，古风典雅、寓意隽永；类别描述同样古朴雅致。
- 不要定义过于模糊和宽泛的类别，并在类别描述后简单说明分类方法
`

/** LLM 拆解提示词（黑化/nigredo 秘宝专用） */
export const DECOMPOSE_SYSTEM_PROMPT = `你是一个炼金术物质分解师。玩家使用「黑化」秘宝与一个元素融合，把该元素分解为组成它的 1~3 个具体事物。
要求：
1. 产出 1~3 个具体事物，尽量多拆：它们是构成该元素的实物成分——材料、部件、原料、实体组成部分等可感知、可独立存在的具体东西，必须同源同层、彼此并列；严禁越级生成更宏大或更高层的事物，也严禁提炼为抽象概念。
2. 具体事物可以是图鉴中已有的元素（直接引用其现有 ID，绝不重复创建），也可以是全新元素；创建新元素必须严格遵守以下公共规则：
${CREATE_ELEMENTS_RULES}
4. 必须调用 craft_recipe 绑定本次输入（秘宝 + 被分解元素）与全部输出。
5. 至少 1 个具体事物，最多 3 个。`

/** LLM 提取提示词（白化/albedo 秘宝专用） */
export const EXTRACT_SYSTEM_PROMPT = `你是一个炼金术净化师。玩家使用「白化」秘宝净化一个元素，把该元素提取为更大更抽象的概念。
要求：
1. 产出 1 个主产物（最多 3 个）：把该元素提炼为更高一层、更宏大的抽象概念（涵盖该元素本质的上位概念），所有产物处于同一抽象层级、彼此并列，严禁一步跳得过于遥远——只能向上抽象一层。
2. 概念可以是图鉴中已有的元素（直接引用其现有 ID，绝不重复创建），也可以是全新元素；创建新元素必须严格遵守以下公共规则：
${CREATE_ELEMENTS_RULES}
4. 必须调用 craft_recipe 绑定本次输入（秘宝 + 被净化元素）与全部输出。`

/** LLM 精炼提示词（黄化/citrinitas 秘宝专用） */
export const REFINE_SYSTEM_PROMPT = `你是一个炼金术物质精炼师。玩家使用「黄化」秘宝与一个元素融合，把该元素精炼为更精纯、更高阶的具体物质形态。
要求：
1. 产出 1 个主产物（最多 3 个）：这是该元素系谱中更精纯、更高阶的物质形态，仍然具体可感（材料、矿石、结晶等实物）；所有产物处于同一精纯层级、彼此并列，严禁越级或凭空升华。
2. 产物可以是图鉴中已有的元素（直接引用其现有 ID，绝不重复创建），也可以是全新元素；创建新元素必须严格遵守以下公共规则：
${CREATE_ELEMENTS_RULES}
4. 必须调用 craft_recipe 绑定本次输入（秘宝 + 被精炼元素）与全部输出。`

/** LLM 点化提示词（赤化/rubedo 秘宝专用，含玩家说服文本） */
export const TRANSMUTE_SYSTEM_PROMPT = `你是一位炼金术点化审判官。玩家使用「赤化」秘宝，请求把一个元素点化为另一个指定的元素。
要求：
1. 玩家会在请求中指定目标元素（可能是图鉴中已有的元素，也可能是玩家设想的新元素）。请判断这次点化是否成立：转换是否有逻辑、神话或意象上的依据，玩家的说服是否有理有据、令人信服。
2. 若批准：目标为已有元素时直接引用其现有 ID；目标为全新元素时调用 craft_elements 创建，创建新元素必须严格遵守以下公共规则：
${CREATE_ELEMENTS_RULES}
必须调用 craft_recipe 绑定本次输入（秘宝 + 被点化元素）与输出。
3. 若拒绝：不调用任何工具，直接回复拒绝的理由（一两句，说明为何点化不成立）。
4. 审批要严格但公平：明显合理且有说服力的点化应当批准，牵强附会或毫无关联的点化应当拒绝。`

/** 每种秘宝专属的反应提示词（key=秘宝 id；触发反应时使用对应秘宝的提示词） */
export const RELIC_PROMPTS: Record<string, string> = {
  nigredo: DECOMPOSE_SYSTEM_PROMPT,
  albedo: EXTRACT_SYSTEM_PROMPT,
  citrinitas: REFINE_SYSTEM_PROMPT,
  rubedo: TRANSMUTE_SYSTEM_PROMPT,
}

/** 每种秘宝的反应动作名（key=秘宝 id；黑化=分解、白化=净化、黄化=精炼、赤化=点化） */
export const RELIC_VERBS: Record<string, string> = {
  nigredo: '分解',
  albedo: '净化',
  citrinitas: '精炼',
  rubedo: '点化',
}

/** 成就定义。图标底板：正方形四角各挖去一个半径 = 边长一半（50）的四分之一圆，中央为拟物图标 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'discover_10',
    name: '初窥门径',
    description: '发现 10 个元素，炼金之路自此开启。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ach10Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#7c2d12"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#ach10Plate)"/><rect x="30" y="38" width="40" height="28" rx="3" fill="#fdf6e3"/><rect x="28" y="40" width="44" height="5" fill="#e9d295"/><rect x="28" y="59" width="44" height="5" fill="#e9d295"/><path d="M43 47 h14 M43 53 h10" stroke="#a16207" stroke-width="2.2" stroke-linecap="round"/></svg>',
    reward: { nigredo: 1 },
    metric: 'elements',
    targetCount: 10,
  },
  {
    id: 'discover_30',
    name: '博闻强识',
    description: '发现 30 个元素，万象之书已翻过大半。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ach30Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a16207"/><stop offset="100%" stop-color="#713f12"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#ach30Plate)"/><path d="M50 22 L55.5 38 L72.5 38 L59 48 L63.5 64 L50 54 L36.5 64 L41 48 L27.5 38 L44.5 38 Z" fill="#fef3c7"/></svg>',
    reward: { albedo: 1 },
    metric: 'elements',
    targetCount: 30,
  },
  {
    id: 'discover_categories',
    name: '万象初开',
    description: '发现 3 个元素类别，天地有了分野。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achCatPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0e7490"/><stop offset="100%" stop-color="#164e63"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achCatPlate)"/><circle cx="34" cy="52" r="9" fill="#e0f2fe"/><circle cx="50" cy="44" r="9" fill="#cffafe"/><circle cx="66" cy="52" r="9" fill="#e0f2fe"/><circle cx="34" cy="52" r="3.2" fill="#0e7490"/><circle cx="50" cy="44" r="3.2" fill="#155e75"/><circle cx="66" cy="52" r="3.2" fill="#0e7490"/></svg>',
    reward: { citrinitas: 1 },
    metric: 'categories',
    targetCount: 3,
  },
  {
    id: 'find_gold',
    name: '点石成金',
    description: '发现「黄金」，凡铁终成贵金。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achGoldPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#854d0e"/><stop offset="100%" stop-color="#4d2c05"/></linearGradient><linearGradient id="achGoldIngot" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#eab308"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achGoldPlate)"/><path d="M33 64 L38 43 L62 43 L67 64 Z" fill="url(#achGoldIngot)"/><path d="M38 43 L50 34 L62 43 Z" fill="#fef9c3"/><path d="M46 52 L50 46 L54 52 L50 58 Z" fill="#854d0e" opacity="0.55"/></svg>',
    reward: { rubedo: 1 },
    targetIds: ['gold'],
  },
  {
    id: 'find_life',
    name: '生命之泉',
    description: '发现「生命」，万物有了脉搏。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achLifePlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#14532d"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achLifePlate)"/><path d="M50 60 C43 54 34 49 34 41 A7.5 7.5 0 0 1 50 36.5 A7.5 7.5 0 0 1 66 41 C66 49 57 54 50 60 Z" fill="#f0fdf4"/><path d="M50 56 C45 52 39 48 39 42.5 A5.5 5.5 0 0 1 50 39.5 A5.5 5.5 0 0 1 61 42.5 C61 48 55 52 50 56 Z" fill="#4ade80"/></svg>',
    reward: { nigredo: 2 },
    targetIds: ['life'],
  },
  {
    id: 'discover_50',
    name: '博古通今',
    description: '发现 50 个元素，图鉴渐成厚重典籍。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ach50Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#2e1065"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#ach50Plate)"/><path d="M24 30 C30 24 42 24 50 30 C58 24 70 24 76 30 L76 66 C70 60 58 60 50 66 C42 60 30 60 24 66 Z" fill="#ede9fe" stroke="#c4b5fd" stroke-width="2"/><path d="M50 30 L50 66" stroke="#8b5cf6" stroke-width="2"/></svg>',
    reward: { albedo: 1 },
    metric: 'elements',
    targetCount: 50,
  },
  {
    id: 'discover_200',
    name: '万象归一',
    description: '发现 200 个元素，森罗万象终归于一。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ach200Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0e7490"/><stop offset="100%" stop-color="#164e63"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#ach200Plate)"/><path d="M18 72 L36 42 L46 56 L56 38 L82 72 Z" fill="#a7f3d0"/><path d="M28 72 L40 54 L50 66 L60 52 L72 72 Z" fill="#34d399" opacity="0.7"/><circle cx="66" cy="30" r="7" fill="#fde68a"/></svg>',
    reward: { nigredo: 2 },
    metric: 'elements',
    targetCount: 200,
  },
  {
    id: 'discover_100',
    name: '百川归海',
    description: '发现 100 个元素，万象汇聚如百川归海。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ach100Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#854d0e"/><stop offset="100%" stop-color="#4d2c05"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#ach100Plate)"/><path d="M24 66 L24 44 L38 54 L50 36 L62 54 L76 44 L76 66 Z" fill="#fde68a" stroke="#b45309" stroke-width="2"/><path d="M22 70 L78 70 L78 76 L22 76 Z" fill="#fbbf24"/></svg>',
    reward: { albedo: 2 },
    metric: 'elements',
    targetCount: 100,
  },
  {
    id: 'categories_5',
    name: '五方分野',
    description: '发现 5 个元素类别，天地自此五方分野。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achC5Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#172554"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achC5Plate)"/><circle cx="50" cy="24" r="6" fill="#bfdbfe"/><circle cx="26" cy="45" r="6" fill="#93c5fd"/><circle cx="36" cy="72" r="6" fill="#60a5fa"/><circle cx="64" cy="72" r="6" fill="#60a5fa"/><circle cx="74" cy="45" r="6" fill="#93c5fd"/><path d="M50 24 L26 45 L36 72 L64 72 L74 45 Z" fill="none" stroke="#bfdbfe" stroke-width="2" opacity="0.55"/></svg>',
    reward: { citrinitas: 1 },
    metric: 'categories',
    targetCount: 5,
  },
  {
    id: 'categories_8',
    name: '八荒归位',
    description: '发现 8 个元素类别，八荒之内各归其位。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achC8Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c2d12"/><stop offset="100%" stop-color="#431407"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achC8Plate)"/><path d="M50 20 L55 45 L80 50 L55 55 L50 80 L45 55 L20 50 L45 45 Z" fill="#fdba74"/><circle cx="50" cy="50" r="8" fill="#ffedd5"/></svg>',
    reward: { rubedo: 1 },
    metric: 'categories',
    targetCount: 8,
  },
  {
    id: 'recipes_20',
    name: '博采众方',
    description: '掌握 20 条配方，炼金之道初窥门径。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achR20Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#065f46"/><stop offset="100%" stop-color="#022c22"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achR20Plate)"/><path d="M28 24 C34 20 44 20 50 26 C56 20 66 20 72 24 L72 62 C66 56 56 56 50 62 C44 56 34 56 28 62 Z" fill="#d1fae5" stroke="#a7f3d0" stroke-width="2"/><path d="M50 34 L53 44 L63 44 L55 50 L58 60 L50 54 L42 60 L45 50 L37 44 L47 44 Z" fill="#065f46"/></svg>',
    reward: { nigredo: 1 },
    metric: 'recipes',
    targetCount: 20,
  },
  {
    id: 'recipes_60',
    name: '万法归宗',
    description: '掌握 60 条配方，万法终归于一炉。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achR60Plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#581c87"/><stop offset="100%" stop-color="#3b0764"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achR60Plate)"/><path d="M32 46 L68 46 L64 78 Q50 84 36 78 Z" fill="#f5d0fe" stroke="#e879f9" stroke-width="2"/><path d="M30 46 L70 46" stroke="#f0abfc" stroke-width="3"/><path d="M38 40 C40 34 60 34 62 40" stroke="#f0abfc" stroke-width="2.5" fill="none"/><path d="M42 52 L50 66 L58 52 Z" fill="#86198f"/></svg>',
    reward: { albedo: 1 },
    metric: 'recipes',
    targetCount: 60,
  },
  {
    id: 'find_sun',
    name: '烈日当空',
    description: '发现「太阳」，光耀万物的至阳之物。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achSunPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9a3412"/><stop offset="100%" stop-color="#7c2d12"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achSunPlate)"/><circle cx="50" cy="50" r="14" fill="#fde047"/><g stroke="#fbbf24" stroke-width="4" stroke-linecap="round"><line x1="50" y1="24" x2="50" y2="32"/><line x1="50" y1="68" x2="50" y2="76"/><line x1="24" y1="50" x2="32" y2="50"/><line x1="68" y1="50" x2="76" y2="50"/><line x1="32" y1="32" x2="37" y2="37"/><line x1="63" y1="63" x2="68" y2="68"/><line x1="32" y1="68" x2="37" y2="63"/><line x1="63" y1="37" x2="68" y2="32"/></g></svg>',
    reward: { citrinitas: 1 },
    targetIds: ['sun'],
  },
  {
    id: 'find_moon',
    name: '月华如水',
    description: '发现「月亮」，清辉如水的至阴之物。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achMoonPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achMoonPlate)"/><path d="M64 24 A28 28 0 1 0 64 76 A22 22 0 1 1 64 24 Z" fill="#e0f2fe"/><circle cx="28" cy="32" r="2.5" fill="#bfdbfe"/><circle cx="30" cy="64" r="2" fill="#bfdbfe"/><circle cx="74" cy="44" r="2.5" fill="#bfdbfe"/></svg>',
    reward: { albedo: 1 },
    targetIds: ['moon'],
  },
  {
    id: 'find_diamond',
    name: '璀璨晶钻',
    description: '发现「钻石」，坚不可摧的璀璨结晶。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achGemPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0369a1"/><stop offset="100%" stop-color="#0c4a6e"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achGemPlate)"/><path d="M34 30 L66 30 L78 46 L50 78 L22 46 Z" fill="#bae6fd" stroke="#7dd3fc" stroke-width="2"/><path d="M34 30 L50 78 L22 46 Z" fill="#7dd3fc" opacity="0.55"/><path d="M34 30 L50 40 L66 30 L50 44 Z" fill="#e0f2fe" opacity="0.8"/></svg>',
    reward: { citrinitas: 1 },
    targetIds: ['diamond'],
  },
  {
    id: 'find_iron',
    name: '百炼成钢',
    description: '发现「铁」，千锤百炼的刚健之基。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achIronPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#44403c"/><stop offset="100%" stop-color="#292524"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achIronPlate)"/><path d="M26 58 L74 58 L78 70 L22 70 Z" fill="#d6d3d1" stroke="#a8a29e" stroke-width="2"/><path d="M42 58 L42 48 L58 48 L58 58" fill="none" stroke="#d6d3d1" stroke-width="5"/><path d="M36 58 L64 58" stroke="#78716c" stroke-width="2"/><path d="M30 46 L50 38 L70 46" stroke="#e7e5e4" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
    reward: { nigredo: 1 },
    targetIds: ['iron'],
  },
  {
    id: 'find_salt',
    name: '咸淡自知',
    description: '发现「盐」，人间百味皆由此起。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achSaltPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#155e75"/><stop offset="100%" stop-color="#083344"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achSaltPlate)"/><path d="M34 62 L66 62 L60 74 L40 74 Z" fill="#e2e8f0"/><path d="M44 62 L50 48 L56 62 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/><circle cx="30" cy="42" r="3" fill="#f1f5f9"/><circle cx="66" cy="38" r="2.5" fill="#e2e8f0"/></svg>',
    reward: { nigredo: 1 },
    targetIds: ['salt'],
  },
  {
    id: 'find_glass',
    name: '晶莹剔透',
    description: '发现「玻璃」，火与沙淬炼的透明之器。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achGlassPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#4c1d95"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achGlassPlate)"/><path d="M32 28 L68 28 L58 54 Q50 58 42 54 Z" fill="#ddd6fe" stroke="#c4b5fd" stroke-width="2"/><path d="M40 56 L60 56 L56 70 L44 70 Z" fill="#c4b5fd"/><path d="M46 70 L54 70 L54 74 L46 74 Z" fill="#a78bfa"/><path d="M38 34 L54 48" stroke="#ede9fe" stroke-width="2.5" opacity="0.7"/></svg>',
    reward: { albedo: 1 },
    targetIds: ['glass'],
  },
  {
    id: 'find_time',
    name: '逝者如斯',
    description: '发现「时间」，奔流不息的世间长河。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achTimePlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#78350f"/><stop offset="100%" stop-color="#451a03"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achTimePlate)"/><path d="M36 26 L64 26 L64 34 L54 44 L54 56 L64 66 L64 74 L36 74 L36 66 L46 56 L46 44 L36 34 Z" fill="#fcd34d" stroke="#f59e0b" stroke-width="2"/><path d="M50 44 L46 48 L50 52 L54 48 Z" fill="#92400e"/><path d="M50 56 L46 60 L50 64 L54 60 Z" fill="#92400e"/></svg>',
    reward: { rubedo: 1 },
    targetIds: ['time'],
  },
  {
    id: 'find_soul',
    name: '魂归故里',
    description: '发现「灵魂」，万物终有归处。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achSoulPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9f1239"/><stop offset="100%" stop-color="#4c0519"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achSoulPlate)"/><path d="M50 22 C58 34 66 42 66 54 C66 66 59 74 50 74 C41 74 34 66 34 54 C34 48 37 43 40 39 C42 45 45 49 49 51 C48 45 46 39 44 33 C46 28 48 25 50 22 Z" fill="#fecdd3"/><path d="M50 42 C54 48 57 52 57 57 C57 63 54 67 50 67 C46 67 43 63 43 57 C43 52 46 48 50 42 Z" fill="#fb7185"/></svg>',
    reward: { rubedo: 1 },
    targetIds: ['soul'],
  },
  {
    id: 'find_nation',
    name: '家国天下',
    description: '发现「国家」，一方水土一方人。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achNationPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#7c2d12"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achNationPlate)"/><path d="M30 70 L30 44 L50 32 L70 44 L70 70 Z" fill="#fde68a" stroke="#b45309" stroke-width="2"/><path d="M44 70 L44 54 L56 54 L56 70 Z" fill="#92400e"/><path d="M50 32 L50 24" stroke="#fde68a" stroke-width="3"/></svg>',
    reward: { albedo: 1 },
    targetIds: ['nation', 'country', 'kingdom', 'realm'],
  },
  {
    id: 'find_city',
    name: '万家灯火',
    description: '发现「城市」，万家灯火不夜天。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achCityPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#1e3a8a"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achCityPlate)"/><rect x="28" y="42" width="14" height="30" fill="#93c5fd"/><rect x="46" y="30" width="16" height="42" fill="#bfdbfe"/><rect x="66" y="46" width="12" height="26" fill="#7dd3fc"/><rect x="32" y="48" width="4" height="4" fill="#fde047"/><rect x="50" y="36" width="4" height="4" fill="#fde047"/><rect x="70" y="52" width="4" height="4" fill="#fde047"/><rect x="50" y="58" width="4" height="4" fill="#fde047"/></svg>',
    reward: { nigredo: 1 },
    targetIds: ['city', 'town', 'capital', 'village'],
  },
  {
    id: 'find_weapon',
    name: '神兵利器',
    description: '发现「兵器」，锋芒所指皆可破。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achWeaponPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#374151"/><stop offset="100%" stop-color="#111827"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achWeaponPlate)"/><path d="M44 30 L70 56 L64 62 L38 36 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/><path d="M36 62 L44 54 L52 62 Z" fill="#b45309"/><rect x="34" y="62" width="26" height="6" rx="2" fill="#a16207"/></svg>',
    reward: { nigredo: 1 },
    targetIds: ['weapon', 'sword', 'blade', 'spear'],
  },
  {
    id: 'find_plant',
    name: '草木荣华',
    description: '发现「草木」，一花一叶皆有灵。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achPlantPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#14532d"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achPlantPlate)"/><circle cx="50" cy="44" r="6" fill="#fda4af"/><circle cx="42" cy="38" r="5" fill="#f9a8d4"/><circle cx="58" cy="38" r="5" fill="#f9a8d4"/><circle cx="42" cy="50" r="5" fill="#f9a8d4"/><circle cx="58" cy="50" r="5" fill="#f9a8d4"/><path d="M50 50 C47 60 53 68 50 76" stroke="#4ade80" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
    reward: { albedo: 1 },
    targetIds: ['plant', 'flower', 'tree', 'grass'],
  },
  {
    id: 'find_animal',
    name: '万物有灵',
    description: '发现「生灵」，飞禽走兽皆同行。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achAnimalPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#be123c"/><stop offset="100%" stop-color="#881337"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achAnimalPlate)"/><circle cx="36" cy="46" r="6" fill="#fca5a5"/><circle cx="50" cy="40" r="7" fill="#f87171"/><circle cx="64" cy="46" r="6" fill="#fca5a5"/><circle cx="42" cy="60" r="5" fill="#fca5a5"/><circle cx="58" cy="60" r="5" fill="#fca5a5"/></svg>',
    reward: { citrinitas: 1 },
    targetIds: ['animal', 'beast', 'creature'],
  },
  {
    id: 'find_food',
    name: '五味俱全',
    description: '发现「食物」，人间至味是清欢。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achFoodPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#78350f"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achFoodPlate)"/><path d="M30 44 L70 44 L64 66 Q50 72 36 66 Z" fill="#fde68a" stroke="#b45309" stroke-width="2"/><path d="M50 44 L50 38 M42 46 L40 40 M58 46 L60 40" stroke="#fef3c7" stroke-width="2.5" stroke-linecap="round"/></svg>',
    reward: { nigredo: 1 },
    targetIds: ['food', 'bread', 'rice', 'meal'],
  },
  {
    id: 'find_mineral',
    name: '金石为开',
    description: '发现「矿物」，金石之精藏于地。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achMineralPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0e7490"/><stop offset="100%" stop-color="#164e63"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achMineralPlate)"/><path d="M50 26 L58 48 L50 62 L42 48 Z" fill="#a5f3fc" stroke="#67e8f9" stroke-width="1.5"/><path d="M38 46 L44 62 L36 66 L32 54 Z" fill="#cffafe"/><path d="M62 46 L56 62 L64 66 L68 54 Z" fill="#cffafe"/></svg>',
    reward: { citrinitas: 1 },
    targetIds: ['mineral', 'gem', 'ore', 'crystal'],
  },
  {
    id: 'find_celestial',
    name: '星辰大海',
    description: '发现「星辰」，浩瀚苍穹任遨游。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achCelestialPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4338ca"/><stop offset="100%" stop-color="#312e81"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achCelestialPlate)"/><circle cx="52" cy="44" r="10" fill="#fde047"/><ellipse cx="52" cy="44" rx="16" ry="5" fill="none" stroke="#fbbf24" stroke-width="2.5" transform="rotate(-18 52 44)"/><path d="M50 24 L51.5 30 L57.5 30 L53 34 L54.5 40 L50 36.5 L45.5 40 L47 34 L42.5 30 L48.5 30 Z" fill="#ffffff" opacity="0.9"/></svg>',
    reward: { citrinitas: 1 },
    targetIds: ['star', 'planet', 'comet', 'galaxy'],
  },
  {
    id: 'find_weather',
    name: '风云变幻',
    description: '发现「天象」，风云雨雪皆自然。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achWeatherPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0369a1"/><stop offset="100%" stop-color="#075985"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achWeatherPlate)"/><path d="M34 58 A10 10 0 0 1 34 40 Q38 34 46 38 A12 12 0 0 1 66 42 Q72 44 70 52 Q76 58 68 58 Z" fill="#e0f2fe" stroke="#bae6fd" stroke-width="2"/><path d="M44 64 L40 72 L46 70 L42 78" stroke="#7dd3fc" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
    reward: { albedo: 1 },
    targetIds: ['weather', 'rain', 'storm', 'snow'],
  },
  {
    id: 'find_knowledge',
    name: '学富五车',
    description: '发现「智慧」，学海无涯勤为径。',
    icon: '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="achKnowledgePlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#5b21b6"/></linearGradient></defs><path d="M50 0 A50 50 0 0 0 100 50 A50 50 0 0 0 50 100 A50 50 0 0 0 0 50 A50 50 0 0 0 50 0 Z" fill="url(#achKnowledgePlate)"/><path d="M24 32 C30 26 42 26 50 32 C58 26 70 26 76 32 L76 66 C70 60 58 60 50 66 C42 60 30 60 24 66 Z" fill="#fef3c7" stroke="#d6b675" stroke-width="2"/><path d="M50 32 L50 66" stroke="#c9a25c" stroke-width="2"/><path d="M50 44 L53 52 L61 52 L55 57 L57 65 L50 60 L43 65 L45 57 L39 52 L47 52 Z" fill="#b45309"/></svg>',
    reward: { rubedo: 1 },
    targetIds: ['wisdom', 'knowledge', 'book', 'scroll'],
  },
]

/** LLM 系统提示词（固定不变部分）。
 * 所有动态数据（类别清单、元素图鉴、本次合成对象、相关配方）一律放在下一条 user 消息中构造，
 * 本模板不含任何占位符与动态注入。 */
export const SYSTEM_PROMPT_TEMPLATE = `你是一个炼金术合成规则生成器。当前世界的元素类别清单、元素图鉴（按类别分组，仅含名称与 ID）、本次参与合成的两个元素的完整信息（名称、ID、类别与描述），以及相关已有配方，都将在下一条用户消息中给出。
请以开放思维从多个维度推演，挑选最贴切、最能引发玩家共鸣的答案，不要只从单一角度思考。应分析当前元素列表，揣摩玩家欲合成的目的，并考虑打破当前的僵局。
规则：
1. 合成是无序的：A+B 与 B+A 完全等价，产物只取决于两个输入元素的组合，与先后顺序无关。
2. 默认只生成 1 个主产物（最多 3 个）。多产物时其余必须是同源同层的副产物，严禁把以主产物为原料才能造出的更高层级事物当作副产物；想不出同级副产物就只保留主产物。
3. 产物推理优先级：① 直接反应（两元素接触后最直接自然的物理化学结果）→ ② 由两者组合而成的结构或系统 → ③ 逻辑组合（从属性、功能、意象组合成具体新事物）→ ④ 象征升华（都无法具象时才提炼抽象概念）。优先选与输入概念上最相似的候选，再按①②③④取舍。产物须和二者相关、直觉可懂，不能生硬拼接字符串。
4. 产物若已存在于元素列表，直接引用其现有 ID 并沿用原 SVG，绝不重复创建。
5. 全新产物调用 craft_elements；创建新元素必须严格遵守以下公共规则：
${CREATE_ELEMENTS_RULES}
6. 必须调用 craft_recipe 绑定本次输入与输出。
注意：产物不得与任一输入完全相同。`

/** LLM 减法合成提示词（在加法基础上修改：有序 A−B，从 A 中剥离 B 的影响） */
export const SUBTRACT_SYSTEM_PROMPT = `你是一个炼金术减法规则生成器。当前世界的元素类别清单、元素图鉴（按类别分组，仅含名称与 ID）、本次参与合成的两个元素的完整信息（名称、ID、类别与描述），以及相关已有配方，都将在下一条用户消息中给出。
请以开放思维从多个维度推演，挑选最贴切、最能引发玩家共鸣的答案，不要只从单一角度思考。
规则：
1. 减法合成是「A−B」：从第一个元素 A 中剥离第二个元素 B 的影响，产物是 A 减去 B 之后剩下的自然结果。顺序有要求：A−B 与 B−A 是不同的减法，产物各不相同。
2. 默认只生成 1 个主产物（最多 3 个）。多产物时其余必须是同源同层的副产物，严禁把以主产物为原料才能造出的更高层级事物当作副产物；想不出同级副产物就只保留主产物。
3. 产物推理优先级：① 剥离后的直接剩余（A 失去 B 的成分后最直接自然的结果）→ ② 逻辑组合（从 A 的属性、功能、意象中减去 B 的影响后组合成具体新事物）→ ③ 象征升华（都无法具象时才提炼抽象概念）。优先选与 A 概念上最相似的候选，再按①②③取舍。产物须与 A 相关、直觉可懂，不能生硬拼接字符串。
4. 产物若已存在于元素列表，直接引用其现有 ID 并沿用原 SVG，绝不重复创建。
5. 全新产物调用 craft_elements；创建新元素必须严格遵守以下公共规则：
${CREATE_ELEMENTS_RULES}
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
