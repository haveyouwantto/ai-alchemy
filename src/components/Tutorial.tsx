import { useEffect, useState } from 'react'

/** 首次打开工作区的拖拽引导浮层，3 秒后自动消失 */
export function Tutorial() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center">
        <div className="animate-arrow-bounce text-6xl drop-shadow-lg">⬇️</div>
        <p className="rounded-2xl border-2 border-amber-800/60 bg-stone-950/90 px-6 py-4 font-serif text-lg font-bold text-amber-200 shadow-[0_0_30px_rgba(255,176,32,0.25)] backdrop-blur">
          拖拽一张卡片到另一张上即可炼金
        </p>
      </div>
    </div>
  )
}
