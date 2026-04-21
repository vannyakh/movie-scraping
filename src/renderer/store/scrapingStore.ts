import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScraperConfig, ScraperProgress, ScraperResult, MovieData } from '../../lib/ipc'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'idle' | 'running' | 'paused' | 'done' | 'error' | 'stopped'

export interface ActiveJob {
  config:    ScraperConfig
  status:    JobStatus
  progress:  ScraperProgress | null
  logs:      string[]
  movies:    MovieData[]
  result:    ScraperResult | null
  error:     string | null
  startedAt: string
}

export interface HistoryEntry {
  id:          string
  url:         string
  status:      'done' | 'error' | 'stopped'
  totalMovies: number
  startedAt:   string
  finishedAt:  string
  config:      ScraperConfig
  jsonPath?:   string
  excelPath?:  string
  csvPath?:    string
  movies:      MovieData[]
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ScrapingStore {
  activeJob: ActiveJob | null
  history:   HistoryEntry[]

  initJob:       (config: ScraperConfig) => void
  updateProgress:(p: ScraperProgress)    => void
  appendLog:     (msg: string)           => void
  appendMovies:  (movies: MovieData[])   => void
  setStatus:     (s: JobStatus)          => void
  completeJob:   (result: ScraperResult) => void
  failJob:       (error: string)         => void
  stopJob:       ()                      => void
  clearActive:   ()                      => void
  deleteHistory: (id: string)            => void
  clearHistory:  ()                      => void
}

export const useScrapingStore = create<ScrapingStore>()(
  persist(
    (set, get) => ({
      activeJob: null,
      history:   [],

      initJob: (config) =>
        set({
          activeJob: {
            config, status: 'running', progress: null,
            logs: [], movies: [], result: null, error: null,
            startedAt: new Date().toISOString(),
          },
        }),

      updateProgress: (progress) =>
        set((s) => ({ activeJob: s.activeJob ? { ...s.activeJob, progress } : null })),

      appendLog: (msg) =>
        set((s) => ({
          activeJob: s.activeJob
            ? { ...s.activeJob, logs: [...s.activeJob.logs.slice(-499), msg] }
            : null,
        })),

      appendMovies: (movies) =>
        set((s) => ({
          activeJob: s.activeJob
            ? { ...s.activeJob, movies: [...s.activeJob.movies, ...movies] }
            : null,
        })),

      setStatus: (status) =>
        set((s) => ({ activeJob: s.activeJob ? { ...s.activeJob, status } : null })),

      completeJob: (result) => {
        const { activeJob } = get()
        if (!activeJob) return
        const entry: HistoryEntry = {
          id:          crypto.randomUUID(),
          url:         activeJob.config.baseUrl,
          status:      'done',
          totalMovies: result.totalMovies,
          startedAt:   activeJob.startedAt,
          finishedAt:  new Date().toISOString(),
          config:      activeJob.config,
          jsonPath:    result.jsonPath,
          excelPath:   result.excelPath,
          csvPath:     result.csvPath,
          movies:      result.movies,
        }
        set((s) => ({
          activeJob: s.activeJob ? { ...s.activeJob, status: 'done', result } : null,
          history:   [entry, ...s.history.slice(0, 49)],
        }))
      },

      failJob: (error) => {
        const { activeJob } = get()
        if (!activeJob) return
        const entry: HistoryEntry = {
          id:          crypto.randomUUID(),
          url:         activeJob.config.baseUrl,
          status:      'error',
          totalMovies: activeJob.movies.length,
          startedAt:   activeJob.startedAt,
          finishedAt:  new Date().toISOString(),
          config:      activeJob.config,
          movies:      activeJob.movies,
        }
        set((s) => ({
          activeJob: s.activeJob ? { ...s.activeJob, status: 'error', error } : null,
          history:   [entry, ...s.history.slice(0, 49)],
        }))
      },

      stopJob: () => {
        const { activeJob } = get()
        if (!activeJob) return
        const entry: HistoryEntry = {
          id:          crypto.randomUUID(),
          url:         activeJob.config.baseUrl,
          status:      'stopped',
          totalMovies: activeJob.movies.length,
          startedAt:   activeJob.startedAt,
          finishedAt:  new Date().toISOString(),
          config:      activeJob.config,
          movies:      activeJob.movies,
        }
        set((s) => ({
          activeJob: s.activeJob ? { ...s.activeJob, status: 'stopped' } : null,
          history:   [entry, ...s.history.slice(0, 49)],
        }))
      },

      clearActive:   () => set({ activeJob: null }),
      deleteHistory: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
      clearHistory:  () => set({ history: [] }),
    }),
    {
      name:       'movie-scraping-jobs',
      partialize: (s) => ({ history: s.history }),
    },
  ),
)
