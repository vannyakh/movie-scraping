/**
 * Renderer-side typed IPC wrapper.
 * Types mirror src/main/scraper.ts but are kept separate so the
 * renderer bundle never imports Node / Electron modules.
 */

export interface MovieData {
  title:        string
  url:          string
  category:     string
  year?:        string
  rating?:      string
  duration?:    string
  director?:    string
  cast?:        string
  description?: string
  poster?:      string
  videoUrl?:    string
  subtitles?:   string
}

export interface ScraperConfig {
  baseUrl:               string
  outputDir:             string
  headless:              boolean
  maxMoviesPerCategory?: number
  maxPagesPerCategory?:  number
  delayMs?:              number
  userAgent?:            string
  exportJson?:           boolean
  exportExcel?:          boolean
  exportCsv?:            boolean
  selectors?: {
    categories?: string
    movieList?:  string
    nextPage?:   string
    detail?: {
      title?:       string
      year?:        string
      rating?:      string
      duration?:    string
      director?:    string
      description?: string
      cast?:        string
      poster?:      string
    }
  }
}

export interface ScraperProgress {
  step:    1 | 2 | 3
  label:   string
  current: number
  total:   number
  message: string
}

export interface ScraperResult {
  jsonPath?:   string
  excelPath?:  string
  csvPath?:    string
  totalMovies: number
  movies:      MovieData[]
}

export type StartResult =
  | ({ success: true } & ScraperResult)
  | { success: false; error: string }

// ─── Global augmentation ──────────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: {
      startScraping:  (config: ScraperConfig) => Promise<StartResult>
      stopScraping:   () => Promise<void>
      pauseScraping:  () => Promise<void>
      resumeScraping: () => Promise<void>
      openPath:       (filePath: string) => Promise<void>
      selectFolder:   () => Promise<string | null>
      onProgress:     (cb: (p: ScraperProgress) => void) => () => void
      onLog:          (cb: (msg: string) => void)        => () => void
      onComplete:     (cb: (r: ScraperResult) => void)   => () => void
      onError:        (cb: (err: string) => void)        => () => void
      onMovieBatch:   (cb: (movies: MovieData[]) => void) => () => void
    }
  }
}

export const ipc = window.electronAPI
