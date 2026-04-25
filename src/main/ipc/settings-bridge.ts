/**
 * Reads settings from the persisted KV store (same source as the renderer's settingsStore).
 * Called from scrape.ts when starting a workflow.
 */
import { kvGet } from '../db'

interface AppSettings {
  aiProvider?:   string
  aiApiKey?:     string
  aiModel?:      string
  proxyEnabled?: boolean
  proxyUrl?:     string
  proxyBypass?:  string
  globalCookies?: string
}

export interface EngineSettings {
  ai?: {
    provider: string
    apiKey:   string
    model:    string
  }
  proxy?: {
    server: string
    bypass: string
  }
  globalCookies: string
}

async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await kvGet('dataflow-settings')
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { state?: { settings?: AppSettings } }
    return parsed.state?.settings ?? {}
  } catch {
    return {}
  }
}

export async function readEngineSettings(): Promise<EngineSettings> {
  const s = await readSettings()

  const ai = (() => {
    if (!s.aiApiKey || s.aiProvider === 'none') return undefined
    const provider     = s.aiProvider ?? 'openai'
    const defaultModel = provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini'
    return { provider, apiKey: s.aiApiKey, model: s.aiModel ?? defaultModel }
  })()

  const proxy = (() => {
    if (!s.proxyEnabled || !s.proxyUrl?.trim()) return undefined
    return { server: s.proxyUrl.trim(), bypass: s.proxyBypass?.trim() ?? 'localhost,127.0.0.1' }
  })()

  return {
    ai,
    proxy,
    globalCookies: s.globalCookies?.trim() ?? '',
  }
}
