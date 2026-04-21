import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { electronPersistStorage } from '@/lib/electron-persist-storage'

export interface AppSettings {
  headless:             boolean
  userAgent:            string
  delayMs:              number
  maxPagesPerCategory:  number
  maxMoviesPerCategory: number
  exportJson:           boolean
  exportExcel:          boolean
  exportCsv:            boolean
  outputDir:            string
  defaultUrl:           string
}

const DEFAULTS: AppSettings = {
  headless:             true,
  userAgent:            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  delayMs:              500,
  maxPagesPerCategory:  10,
  maxMoviesPerCategory: 100,
  exportJson:           true,
  exportExcel:          true,
  exportCsv:            true,
  outputDir:            '',
  defaultUrl:           '',
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
    { name: 'movie-scraping-settings', storage: electronPersistStorage },
  ),
)
