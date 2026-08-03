import { useEffect, useState } from 'react'

export interface ToastData {
  id: number
  title: string
  elements?: Array<{ name: string; svg: string }>
  kind?: 'success' | 'error' | 'info'
  /** 附加正文（如 AI 炼金术笔记，可多行） */
  content?: string
  /** 隐藏「获得：××」文字行（仍保留图标飘落动画） */
  hideObtainText?: boolean
}

interface ToastProps {
  toasts: ToastData[]
}

/** 单个 Toast：顶部弹出 + 元素图标飘落动画 */
function ToastItem({ toast }: { toast: ToastData }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30)
    const t2 = setTimeout(() => setLeaving(true), 4700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const style: React.CSSProperties = {
    opacity: visible && !leaving ? 1 : 0,
    transform: visible && !leaving ? 'translateY(0)' : 'translateY(-20px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  }

  const isSuccess = toast.kind !== 'error'

  return (
    <div
      style={style}
      className="pointer-events-none relative w-72 overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-b from-indigo-950/95 to-purple-950/95 p-4 shadow-2xl shadow-black/40"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{isSuccess ? '✨' : '⚠️'}</span>
        <div>
          <p className="font-bold text-amber-200">{toast.title}</p>
          {!toast.hideObtainText && toast.elements && toast.elements.length > 0 && (
            <p className="mt-0.5 text-sm text-purple-200">
              获得：
              <span className="font-semibold text-emerald-300">
                {toast.elements.map((e) => e.name).join('、')}
              </span>
            </p>
          )}
          {toast.content && (
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-purple-300/90">
              {toast.content}
            </p>
          )}
        </div>
      </div>
      {isSuccess &&
        toast.elements?.map((el, i) => (
          <span
            key={i}
            className="absolute animate-float-down opacity-0"
            style={{
              left: `${20 + i * 28}%`,
              top: '50%',
              animationDelay: `${i * 0.15}s`,
              width: 28,
              height: 28,
            }}
            dangerouslySetInnerHTML={{ __html: el.svg }}
          />
        ))}
    </div>
  )
}

export function ToastContainer({ toasts }: ToastProps) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}