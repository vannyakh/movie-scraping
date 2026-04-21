import { contextBridge, ipcRenderer } from 'electron'

const api = {
  startScraping:  (config: unknown) => ipcRenderer.invoke('scrape:start', config),
  stopScraping:   ()                 => ipcRenderer.invoke('scrape:stop'),
  pauseScraping:  ()                 => ipcRenderer.invoke('scrape:pause'),
  resumeScraping: ()                 => ipcRenderer.invoke('scrape:resume'),
  openPath:       (p: string)        => ipcRenderer.invoke('open:path', p),
  selectFolder:   ()                 => ipcRenderer.invoke('dialog:selectFolder'),

  onProgress:   (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('scrape:progress',   h)
    return () => ipcRenderer.off('scrape:progress',   h)
  },
  onLog:        (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('scrape:log',        h)
    return () => ipcRenderer.off('scrape:log',        h)
  },
  onComplete:   (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('scrape:complete',   h)
    return () => ipcRenderer.off('scrape:complete',   h)
  },
  onError:      (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('scrape:error',      h)
    return () => ipcRenderer.off('scrape:error',      h)
  },
  onMovieBatch: (cb: (...a: unknown[]) => void) => {
    const h = (_: unknown, v: unknown) => cb(v)
    ipcRenderer.on('scrape:movieBatch', h)
    return () => ipcRenderer.off('scrape:movieBatch', h)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
