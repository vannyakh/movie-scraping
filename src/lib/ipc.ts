/**
 * Renderer-side typed IPC wrapper.
 * Types come from `src/shared/ipc-types.ts` so they stay aligned with the main process.
 */

import type {
  MovieData,
  ScraperConfig,
  ScraperProgress,
  ScraperResult,
  StartResult,
} from '@shared/ipc-types'

export type {
  MovieData,
  ScraperConfig,
  ScraperProgress,
  ScraperResult,
  StartResult,
} from '@shared/ipc-types'

declare global {
  interface Window {
    electronAPI: {
      startScraping:  (config: ScraperConfig) => Promise<StartResult>
      stopScraping:   () => Promise<void>
      pauseScraping:  () => Promise<void>
      resumeScraping: () => Promise<void>
      openPath:       (filePath: string) => Promise<void>
      selectFolder:   () => Promise<string | null>
      storeGet:       (key: string) => Promise<string | null>
      storeSet:       (key: string, value: string) => Promise<void>
      storeRemove:    (key: string) => Promise<void>
      onProgress:     (cb: (p: ScraperProgress) => void) => () => void
      onLog:          (cb: (msg: string) => void)        => () => void
      onComplete:     (cb: (r: ScraperResult) => void)   => () => void
      onError:        (cb: (err: string) => void)        => () => void
      onMovieBatch:   (cb: (movies: MovieData[]) => void) => () => void
    }
  }
}

export const ipc = window.electronAPI
