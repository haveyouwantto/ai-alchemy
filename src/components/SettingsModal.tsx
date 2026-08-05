import { useCallback, useState } from 'react'
import type { AIConfig } from '../types'
import { fetchModels } from '../aiClient'

interface SettingsModalProps {
  open: boolean
  config: AIConfig
  onSave: (config: AIConfig) => void
  onClose: () => void
  /** 清除全部游戏数据（危险操作，由外层二次确认后调用） */
  onClearAllData: () => void
}

/** 常见模型列表（作为下拉选项的补充候选） */
const COMMON_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'deepseek-chat',
  'deepseek-reasoner',
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'glm-4-plus',
  'glm-4',
  'claude-3-5-sonnet',
  'claude-3-opus',
  'moonshot-v1-8k',
  'moonshot-v1-32k',
] as const

export function SettingsModal({ open, config, onSave, onClose, onClearAllData }: SettingsModalProps) {
  // 组件常驻（隐藏而非卸载），state 只在挂载时初始化一次，关闭后保留未保存的输入
  const [baseURL, setBaseURL] = useState(config.baseURL)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model || 'gpt-4o-mini')
  const [models, setModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  // 清除数据二次确认弹窗
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // 自动获取模型列表
  const handleFetchModels = useCallback(async () => {
    if (!baseURL.trim() || !apiKey.trim()) {
      setFetchError('请先填写 Endpoint 和 API Key')
      return
    }
    setFetching(true)
    setFetchError('')
    const result = await fetchModels(baseURL, apiKey)
    setFetching(false)
    if (result.ok) {
      setModels(result.models)
      setShowDropdown(true)
      // 若当前模型不在列表中，自动挑选一个
      if (!result.models.includes(model)) {
        setModel(result.models[0])
      }
    } else {
      setFetchError(result.error)
    }
  }, [baseURL, apiKey, model])

  // 合并下拉选项：API 获取的 + 常见模型 + 当前值
  const dropdownOptions = useCallback(() => {
    const apiSet = new Set(models)
    const commonSet = new Set<string>(COMMON_MODELS)
    const apiOnly = Array.from(apiSet).filter((m) => !commonSet.has(m)).sort()
    const common = Array.from(commonSet).sort()
    return { apiOnly, common }
  }, [models])

  if (!open) return null

  const save = () => {
    onSave({ baseURL: baseURL.trim(), apiKey: apiKey.trim(), model: model.trim() || 'gpt-4o-mini' })
    onClose()
  }

  const { apiOnly, common } = dropdownOptions()

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-b from-stone-900 to-stone-950 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-amber-900/40 px-4 py-3">
          <h2 className="font-serif text-lg font-bold text-amber-300">⚙️ AI 设置</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-amber-100 transition-colors hover:bg-stone-700"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="alchemy-scroll max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-100">API Endpoint（Base URL）</label>
              <input
                value={baseURL}
                onChange={(e) => {
                  setBaseURL(e.target.value)
                  setModels([])
                }}
                placeholder="https://api.openai.com/v1"
                className="rounded-lg border border-amber-900/50 bg-stone-950/80 px-3 py-2 text-sm text-amber-100 placeholder-amber-200/40 outline-none focus:border-amber-400"
              />
              <p className="text-xs text-amber-200/60">
                支持 OpenAI 官方或任何 OpenAI 兼容 API（如中转服务）
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-100">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setModels([])
                }}
                placeholder="sk-..."
                className="rounded-lg border border-amber-900/50 bg-stone-950/80 px-3 py-2 text-sm text-amber-100 placeholder-amber-200/40 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-100">模型（Model）</label>
              <div className="relative">
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="gpt-4o-mini"
                  className="w-full rounded-lg border border-amber-900/50 bg-stone-950/80 px-3 py-2 text-sm text-amber-100 placeholder-amber-200/40 outline-none focus:border-amber-400"
                />
                {showDropdown && (
                  <div className="alchemy-scroll absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-amber-900/60 bg-stone-950/95 p-1.5 shadow-2xl backdrop-blur">
                    <button
                      type="button"
                      onMouseDown={handleFetchModels}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-amber-300 transition-colors hover:bg-stone-800/80"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">🔄</span>
                        <span>{fetching ? '正在获取模型列表...' : '自动获取模型列表'}</span>
                      </span>
                      {fetching && (
                        <span className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                      )}
                    </button>
                    {fetchError && <p className="px-3 py-1.5 text-xs text-red-400">{fetchError}</p>}
                    <div className="my-1 border-t border-amber-900/40" />

                    {apiOnly.length > 0 && (
                      <>
                        <p className="px-3 py-1 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-200/60">
                          从 API 获取
                        </p>
                        {apiOnly.map((m) => (
                          <ModelOption key={m} value={m} selected={m === model} onSelect={(v) => { setModel(v); setShowDropdown(false) }} />
                        ))}
                        <div className="my-1 border-t border-amber-900/40" />
                      </>
                    )}

                    <p className="px-3 py-1 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-200/60">
                      常用模型
                    </p>
                    {common.map((m) => (
                      <ModelOption key={m} value={m} selected={m === model} onSelect={(v) => { setModel(v); setShowDropdown(false) }} />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-amber-200/60">
                可手动输入，或点击输入框后「自动获取」从 API 拉取完整模型列表
              </p>
            </div>

            <button
              onClick={save}
              className="mt-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 font-bold text-amber-950 transition-all hover:brightness-110 active:scale-95"
            >
              保存配置
            </button>

            {/* 危险区域 */}
            <div className="mt-4 border-t border-red-500/30 pt-4">
              <p className="mb-2 text-sm font-semibold text-red-400">
                ⚠️ 危险区域
              </p>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full rounded-xl border border-red-500/50 bg-red-950/40 py-2.5 text-sm font-bold text-red-300 transition-all hover:bg-red-900/50 active:scale-95"
              >
                🗑️ 清除全部数据
              </button>
              <p className="mt-1.5 text-xs text-red-400/70">
                仅删除世界数据（元素/配方/类别/图鉴存档）。AI 配置（Endpoint/API Key/模型）会保留，无需重新设置。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 危险操作确认弹窗 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-500/50 bg-gradient-to-b from-red-950 to-stone-950 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-4xl">⚠️</span>
              <div>
                <h3 className="text-lg font-bold text-red-300">确认清除全部数据？</h3>
                <p className="mt-1 text-xs text-red-200/70">
                  此操作将永久删除当前世界内的所有元素、配方、类别与图鉴记录，并重置为初始四基础元素。无法恢复！AI 配置（Endpoint/API Key/模型）不受影响。
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setShowClearConfirm(false)
                  // AI 配置保留，本地输入复位为已保存的 config（组件常驻防残留）
                  setBaseURL(config.baseURL)
                  setApiKey(config.apiKey)
                  setModel(config.model || 'gpt-4o-mini')
                  setModels([])
                  setFetchError('')
                  onClose()
                  onClearAllData()
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-white transition-all hover:bg-red-500 active:scale-95"
              >
                是的，清空一切
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-amber-900/50 bg-stone-800/70 px-4 py-2.5 font-semibold text-amber-100 transition-colors hover:bg-stone-700/80"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 单个模型下拉选项 */
function ModelOption({
  value,
  selected,
  onSelect,
}: {
  value: string
  selected: boolean
  onSelect: (value: string) => void
}) {
  return (
    <button
      type="button"
      onMouseDown={() => onSelect(value)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-stone-800/80 ${
        selected ? 'bg-amber-900/30 font-semibold text-amber-300' : 'text-amber-100'
      }`}
    >
      <span className="truncate">{value}</span>
      {selected && <span>✓</span>}
    </button>
  )
}
