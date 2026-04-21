/**
 * Renderer-side IPC helper.
 *
 * All types here mirror those in src/preload.ts — kept separate so the
 * renderer bundle never imports Node/Electron modules.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ScraperConfig {
  baseUrl: string
  outputDir: string
  headless: boolean
  maxMoviesPerCategory?: number
}

export interface ScraperProgress {
  step: 1 | 2 | 3
  label: string
  current: number
  total: number
  message: string
}

export interface ScraperResult {
  jsonPath: string
  excelPath: string
  totalMovies: number
}

export type StartResult =
  | ({ success: true } & ScraperResult)
  | { success: false; error: string }

// ─── Global window augmentation ───────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: {
      startScraping: (config: ScraperConfig) => Promise<StartResult>
      stopScraping: () => Promise<void>
      openPath: (filePath: string) => Promise<void>
      onProgress: (cb: (progress: ScraperProgress) => void) => () => void
      onLog: (cb: (message: string) => void) => () => void
      onComplete: (cb: (result: ScraperResult) => void) => () => void
      onError: (cb: (error: string) => void) => () => void
    }
  }
}

// ─── Convenience re-export ────────────────────────────────────────────────────

export const ipc = window.electronAPI
