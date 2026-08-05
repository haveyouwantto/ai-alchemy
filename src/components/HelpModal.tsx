interface HelpModalProps {
  open: boolean
  onClose: () => void
}

/** 游戏内说明：炼金工坊操作与机制一览 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  const sections: Array<{ title: string; lines: string[] }> = [
    {
      title: '⚗️ 炼金合成',
      lines: [
        '拖拽一张卡片到另一张上，即开始炼金。',
        '合成无序：A+B 与 B+A 等价，产物取决于两个元素的组合。',
        '产物优先考虑直接反应与二者构成的结构或系统，再谈逻辑组合与象征升华。',
      ],
    },
    {
      title: '🃏 卡片操作',
      lines: [
        '拖动卡片可移动位置，位置会自动保存。',
        '双击卡片复制一张；双击空白处，可召唤火、水、气、土四大基础元素。',
        '点选卡片后按 Delete 删除；拖到右下角垃圾桶可直接丢弃。',
        '点击顶部「整理」可将所有卡片平铺排列。',
      ],
    },
    {
      title: '🏺 秘宝',
      lines: [
        '秘宝是消耗品，放入桌面库存 -1，拖回垃圾桶或清空桌面会返还。',
        '黑化·分解：把元素拆解为 1~3 个具体事物。',
        '白化·净化：把元素提炼为更宏大抽象的概念。',
        '黄化·精炼：把元素精炼为更纯更高阶的具体物质。',
        '赤化·点化：写下说服之词，请贤者把元素转化为你指定的目标。',
        '每解锁/合成到一定数量，秘宝会降临（到账时有提示）。',
      ],
    },
    {
      title: '📖 图鉴 · 🗺️ 地图 · 🏆 成就',
      lines: [
        '图鉴记录已发现的元素与配方，点击条目可查看详情与参与/获得配方。',
        '世界地图以「世界之心」为中心展示元素关系，放大后可看名称，点选元素可查看关系与添加到桌面。',
        '成就会在你发现元素、类别、配方或特定目标时自动达成并奖励秘宝。',
      ],
    },
    {
      title: '⌨️ 快捷键',
      lines: ['Ctrl+K 打开图鉴', 'Ctrl+H 打开炼金记录', 'Delete 删除选中卡片'],
    },
  ]

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-[#8b5a2b] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-amber-900/30 bg-gradient-to-r from-[#7a4a20] to-[#96602e] px-4 py-3 text-amber-100">
          <h2 className="font-serif text-xl font-bold tracking-widest">📜 炼金工坊 · 说明</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/50 text-amber-100 transition-colors hover:bg-amber-900/80"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="alchemy-scroll flex-1 overflow-y-auto bg-[#f5e6c8] p-4">
          <div className="flex flex-col gap-3">
            {sections.map((s) => (
              <div key={s.title} className="rounded-xl border border-amber-800/30 bg-[#fdf6e3] p-3 shadow-sm">
                <h3 className="mb-1.5 font-serif text-base font-bold text-amber-950">{s.title}</h3>
                <ul className="flex flex-col gap-1">
                  {s.lines.map((l, i) => (
                    <li key={i} className="text-xs leading-relaxed text-amber-900/85">
                      · {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
