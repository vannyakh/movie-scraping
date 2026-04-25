import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // ─── Generic workflow engine ───────────────────────────────────────────────
  startWorkflow:  (config: unknown) => ipcRenderer.invoke('workflow:start', config),
  stopWorkflow:   ()                => ipcRenderer.invoke('workflow:stop'),
  pauseWorkflow:  ()                => ipcRenderer.invoke('workflow:pause'),
  resumeWorkflow: ()                => ipcRenderer.invoke('workflow:resume'),

  // ─── AI ───────────────────────────────────────────────────────────────────
  generateWorkflow: (prompt: string) => ipcRenderer.invoke('ai:generateWorkflow', prompt),

  // ─── Utilities ────────────────────────────────────────────────────────────
  openPath:     (p: string)                    => ipcRenderer.invoke('open:path', p),
  selectFolder: ()                             => ipcRenderer.invoke('dialog:selectFolder'),
  storeGet:     (key: string)                  => ipcRenderer.invoke('store:get', key)           as Promise<string | null>,
  storeSet:     (key: string, value: string)   => ipcRenderer.invoke('store:set', key, value)    as Promise<void>,
  storeRemove:  (key: string)                  => ipcRenderer.invoke('store:remove', key)         as Promise<void>,

  // ─── Push events: workflow ─────────────────────────────────────────────────
  onProgress:   (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('workflow:progress', h)
    return () => ipcRenderer.off('workflow:progress', h)
  },
  onLog:        (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('workflow:log', h)
    return () => ipcRenderer.off('workflow:log', h)
  },
  onBatch:      (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('workflow:batch', h)
    return () => ipcRenderer.off('workflow:batch', h)
  },
  onComplete:   (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('workflow:complete', h)
    return () => ipcRenderer.off('workflow:complete', h)
  },
  onError:      (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('workflow:error', h)
    return () => ipcRenderer.off('workflow:error', h)
  },
  onNodeStatus: (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('workflow:nodeStatus', h)
    return () => ipcRenderer.off('workflow:nodeStatus', h)
  },

  // ─── Legacy: old scrape events kept for backward compat ───────────────────
  startScraping:  (config: unknown) => ipcRenderer.invoke('scrape:start', config),
  stopScraping:   ()                => ipcRenderer.invoke('scrape:stop'),
  pauseScraping:  ()                => ipcRenderer.invoke('scrape:pause'),
  resumeScraping: ()                => ipcRenderer.invoke('scrape:resume'),
  onMovieBatch: (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('scrape:movieBatch', h)
    return () => ipcRenderer.off('scrape:movieBatch', h)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
