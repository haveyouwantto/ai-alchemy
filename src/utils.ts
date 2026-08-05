/** 生成 UUID */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 无 randomUUID 时使用本地实现
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 清理/规范化 AI 返回的 SVG 代码 */
export function sanitizeSVG(svgContent: string): string {
  let svg = svgContent.trim()
  // 如果包含 markdown 代码块标记，去除
  svg = svg.replace(/^```(?:svg|xml)?\s*/i, '').replace(/\s*```$/, '')
  // 提取第一个 <svg ...> ... </svg>
  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/i)
  if (svgMatch) svg = svgMatch[0]
  // 确保有 viewBox 和尺寸
  if (!/viewBox\s*=/.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg viewBox="0 0 100 100"')
  }
  if (!/width\s*=/.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg width="100" height="100"')
  }
  // 禁止脚本注入
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '')
  svg = svg.replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
  return svg
}

/** 判断 SVG 是否安全（无脚本/事件处理器） */
export function isSafeSVG(svg: string): boolean {
  return !/<script|on\w+\s*=|javascript:/i.test(svg)
}

/** 从元素徽章 SVG 提取背景色相（0~360），用于整理桌面时按色相排序 */
export function getBadgeHue(svgContent: string): number {
  const hexToHue = (hex: string): number | null => {
    const m = hex.replace('#', '')
    if (m.length === 3) {
      return hexToHue(`#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`)
    }
    const n = parseInt(m.slice(0, 6), 16)
    if (!Number.isFinite(n)) return null
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    if (d === 0) return 0
    let h = 0
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    return (((h * 60) % 360) + 360) % 360
  }

  // 优先取「plate」线性渐变（徽章底板）的起始色
  const gradRe = /<linearGradient[^>]*>([\s\S]*?)<\/linearGradient>/g
  const stops: Array<{ id: string; colors: string[] }> = []
  let grad: RegExpExecArray | null
  while ((grad = gradRe.exec(svgContent)) !== null) {
    const block = grad[0]
    const idMatch = /id="([^"]+)"/.exec(block)
    const colors = [...block.matchAll(/stop-color="?(#[0-9a-fA-F]{3,6})"?/g)].map((mm) => mm[1])
    if (colors.length > 0) stops.push({ id: idMatch?.[1] ?? '', colors })
  }
  const plate = stops.find((s) => /plate/i.test(s.id))
  const target = plate ?? stops[0]
  if (target) {
    for (const c of target.colors) {
      const h = hexToHue(c)
      if (h !== null) return h
    }
  }
  // 兜底：取整个 SVG 中第一个十六进制颜色
  const any = /#([0-9a-fA-F]{6})/.exec(svgContent)
  if (any) {
    const h = hexToHue(any[0])
    if (h !== null) return h
  }
  return 0
}
