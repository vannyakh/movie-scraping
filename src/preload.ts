import { contextBridge, ipcRenderer } from 'electron'

// ─── Shared types (mirrored in src/lib/ipc.ts for the renderer) ──────────────

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

// ─── Exposed API ──────────────────────────────────────────────────────────────

const electronAPI = {
  startScraping: (config: ScraperConfig) =>
    ipcRenderer.invoke('scrape:start', config) as Promise<
      { success: true } & ScraperResult | { success: false; error: string }
    >,

  stopScraping: (): Promise<void> => ipcRenderer.invoke('scrape:stop'),

  openPath: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('open:path', filePath),

  onProgress: (cb: (progress: ScraperProgress) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, p: ScraperProgress) => cb(p)
    ipcRenderer.on('scrape:progress', handler)
    return () => ipcRenderer.off('scrape:progress', handler)
  },

  onLog: (cb: (message: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg)
    ipcRenderer.on('scrape:log', handler)
    return () => ipcRenderer.off('scrape:log', handler)
  },

  onComplete: (cb: (result: ScraperResult) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, r: ScraperResult) => cb(r)
    ipcRenderer.on('scrape:complete', handler)
    return () => ipcRenderer.off('scrape:complete', handler)
  },

  onError: (cb: (error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, err: string) => cb(err)
    ipcRenderer.on('scrape:error', handler)
    return () => ipcRenderer.off('scrape:error', handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
