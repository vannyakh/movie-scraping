import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { electronPersistStorage } from '@/lib/electron-persist-storage'

export interface AppSettings {
  // Browser defaults
  headless:   boolean
  userAgent:  string
  delayMs:    number

  // Scraping limits
  maxPages:   number
  maxItems:   number

  // Export defaults
  exportJson:  boolean
  exportExcel: boolean
  exportCsv:   boolean
  outputDir:   string

  // AI
  aiProvider: 'openai' | 'anthropic' | 'none'
  aiApiKey:   string
  aiModel:    string
}

const DEFAULTS: AppSettings = {
  headless:    true,
  userAgent:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  delayMs:     500,
  maxPages:    10,
  maxItems:    100,
  exportJson:  true,
  exportExcel: true,
  exportCsv:   false,
  outputDir:   '',
  aiProvider:  'none',
  aiApiKey:    '',
  aiModel:     'gpt-4o-mini',
}

interface SettingsStore {
  settings: AppSettings
  update:   (patch: Partial<AppSettings>) => void
  reset:    () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      update:   (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      reset:    () => set({ settings: DEFAULTS }),
    }),
    { name: 'dataflow-settings', storage: electronPersistStorage },
  ),
)
