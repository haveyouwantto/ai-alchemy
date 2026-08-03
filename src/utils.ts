/** 生成 UUID */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 降级方案
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