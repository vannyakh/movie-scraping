/**
 * Reads AI settings from the persisted KV store (same source as the renderer's settingsStore).
 * Called from scrape.ts when starting a workflow that may use AI.
 */
import { kvGet } from '../db'

interface AIConfig {
  provider: string
  apiKey:   string
  model:    string
}

export async function useSettingsStore(): Promise<AIConfig | undefined> {
  try {
    const raw = await kvGet('dataflow-settings')
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { state?: { settings?: { aiProvider?: string; aiApiKey?: string; aiModel?: string } } }
    const s = parsed.state?.settings
    if (!s?.aiApiKey || s.aiProvider === 'none') return undefined
    const provider = s.aiProvider ?? 'openai'
    const defaultModel = provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini'
    return {
      provider,
      apiKey: s.aiApiKey,
      model:  s.aiModel ?? defaultModel,
    }
  } catch {
    return undefined
  }
}
