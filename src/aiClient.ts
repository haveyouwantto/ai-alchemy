import type { AIConfig, ChatMessage, ToolCall } from './types'

/** OpenAI 兼容的聊天补全请求体 */
interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  tools?: unknown[]
  tool_choice?: unknown
  temperature?: number
  stream?: boolean
}

/** OpenAI 兼容的聊天补全响应 */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: ChatMessage
    finish_reason?: string
  }>
  error?: {
    message?: string
  }
}

/** AI 调用结果：返回完整 assistant 消息（含 tool_calls） */
export type AIResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: string }

/** 构建请求体 */
function buildRequestBody(
  config: AIConfig,
  messages: ChatMessage[],
  tools: unknown[],
  stream: boolean,
): ChatCompletionRequest {
  return {
    model: config.model?.trim() || 'gpt-4o-mini',
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.7,
    stream,
  }
}

/** 执行 fetch 并返回 Response，统一错误处理 */
async function sendRequest(
  config: AIConfig,
  messages: ChatMessage[],
  tools: unknown[],
  stream: boolean,
): Promise<Response | AIResult> {
  const baseURL = config.baseURL.trim().replace(/\/+$/, '')
  const url = `${baseURL}/chat/completions`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(buildRequestBody(config, messages, tools, stream)),
    })
  } catch {
    return { ok: false as const, error: '网络连接失败，请检查网络或 Endpoint 配置' }
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const data = (await response.json()) as ChatCompletionResponse
      if (data.error?.message) detail = data.error.message
    } catch {
      // ignore parse error
    }
    return { ok: false as const, error: `API 请求失败：${detail}` }
  }

  return response
}

/**
 * 非流式调用 OpenAI 兼容 API（Function Calling）
 */
export async function callChatCompletion(
  config: AIConfig,
  messages: ChatMessage[],
  tools: unknown[],
): Promise<AIResult> {
  const res = await sendRequest(config, messages, tools, false)
  if (res instanceof Response) {
    let data: ChatCompletionResponse
    try {
      data = (await res.json()) as ChatCompletionResponse
    } catch {
      return { ok: false, error: 'API 返回了无法解析的响应' }
    }

    const message = data.choices?.[0]?.message
    if (!message) {
      return { ok: false, error: 'API 未返回有效消息' }
    }

    // 规范化 tool_calls（过滤无效项）
    const normalizedMessage: ChatMessage = {
      ...message,
      content: message.content ?? null,
      tool_calls: (message.tool_calls ?? []).filter(
        (tc): tc is ToolCall => !!tc && !!tc.function && typeof tc.function.arguments === 'string',
      ),
    }

    return { ok: true, message: normalizedMessage }
  }
  return res
}

/**
 * 流式调用 OpenAI 兼容 API（SSE 解析）。
 * 按 SSE 事件（空行分隔）解析，正确处理跨块/跨行的 data 行，并累积 tool_calls 分片。
 *
 * @param onDelta 每次收到文本增量时回调（用于实时显示 AI 输出）
 */
export async function streamChatCompletion(
  config: AIConfig,
  messages: ChatMessage[],
  tools: unknown[],
  onDelta: (text: string) => void,
  onReasoning?: (text: string) => void,
): Promise<AIResult> {
  const res = await sendRequest(config, messages, tools, true)
  if (!(res instanceof Response)) return res

  try {
    const reader = res.body?.getReader()
    if (!reader) {
      return { ok: false, error: '当前浏览器/API 不支持流式响应' }
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    // tool_calls 分片累积：index -> 正在拼接的 tool call
    const toolCallMap = new Map<number, ToolCall>()
    const toolCallOrder: number[] = []

    /** 解析单个 data JSON，累积内容与工具调用分片 */
    const parseDataPayload = (payload: string) => {
      if (!payload || payload === '[DONE]') return

      let chunk: {
        choices?: Array<{
          delta?: {
            content?: string | null
            /** 推理模型的思考内容（如 DeepSeek reasoning_content） */
            reasoning_content?: string | null,
            reasoning?: string | null,
            tool_calls?: Array<{
              index?: number
              id?: string
              type?: string
              function?: { name?: string; arguments?: string }
            }>
          }
          finish_reason?: string | null
        }>
        error?: { message?: string }
      }
      try {
        chunk = JSON.parse(payload)
      } catch {
        return
      }

      if (chunk.error?.message) {
        throw new Error(chunk.error.message)
      }

      const choice = chunk.choices?.[0]
      if (!choice?.delta) return

      const delta = choice.delta

      // 累积文本内容
      if (delta.content) {
        fullContent += delta.content
        onDelta(delta.content)
      }

      // 累积推理内容（思考过程，单独回调用于 UI 展示）
      let fields = ['reasoning_content', 'reasoning'] as const
      for (const field of fields) {
        const reasoning = delta[field]
        if (reasoning) {
          onReasoning?.(reasoning)
        }
      }

      // 累积工具调用分片（index -> 拼接 name/arguments）
      for (const tcChunk of delta.tool_calls ?? []) {
        const index = tcChunk.index ?? 0
        let tc = toolCallMap.get(index)
        if (!tc) {
          tc = {
            id: tcChunk.id ?? `call_${index}_${Date.now()}`,
            type: 'function',
            function: { name: '', arguments: '' },
          }
          toolCallMap.set(index, tc)
          toolCallOrder.push(index)
        }
        if (tcChunk.id) tc.id = tcChunk.id
        if (tcChunk.function?.name) tc.function.name += tcChunk.function.name
        if (tcChunk.function?.arguments) tc.function.arguments += tcChunk.function.arguments
      }
    }

    /** 处理一行（可能是完整的 data: 或事件内的一行） */
    const handleLine = (rawLine: string) => {
      const line = rawLine.trim()
      if (line.startsWith('data:')) {
        parseDataPayload(line.slice(5).trim())
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // 按 \n 分割，逐行处理（空行被 trim 掉不影响 data 行）
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        handleLine(line)
      }
    }

    // 处理缓冲区剩余（未尾换行）
    if (buffer.trim().length > 0) {
      handleLine(buffer)
    }

    // 规范化和过滤无效工具调用
    const toolCalls = toolCallOrder
      .map((idx) => toolCallMap.get(idx)!)
      .filter((tc) => tc.function.name && tc.function.arguments)

    const message: ChatMessage = {
      role: 'assistant',
      content: fullContent || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }

    return { ok: true, message }
  } catch {
    return { ok: false, error: '流式响应解析失败' }
  }
}

/** 获取模型列表（OpenAI 兼容 /v1/models） */
export async function fetchModels(
  baseURL: string,
  apiKey: string,
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const cleanBase = baseURL.trim().replace(/\/+$/, '')
  const url = `${cleanBase}/models`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    })
  } catch {
    return { ok: false, error: '无法连接模型服务，请检查 Endpoint' }
  }

  if (!response.ok) {
    return { ok: false, error: `获取模型失败：HTTP ${response.status}` }
  }

  try {
    const data = (await response.json()) as { data?: Array<{ id?: string }> }
    const models = (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => !!id)
      .sort()
    if (models.length === 0) {
      return { ok: false, error: '服务未返回任何模型' }
    }
    return { ok: true, models }
  } catch {
    return { ok: false, error: '模型列表解析失败' }
  }
}

/** 解析工具调用的 JSON 参数（容错） */
export function parseToolArguments<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    // 尝试提取 JSON 对象
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}