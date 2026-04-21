import { contextBridge, ipcRenderer } from "electron";
const electronAPI = {
  startScraping: (config) => ipcRenderer.invoke("scrape:start", config),
  stopScraping: () => ipcRenderer.invoke("scrape:stop"),
  openPath: (filePath) => ipcRenderer.invoke("open:path", filePath),
  onProgress: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on("scrape:progress", handler);
    return () => ipcRenderer.off("scrape:progress", handler);
  },
  onLog: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on("scrape:log", handler);
    return () => ipcRenderer.off("scrape:log", handler);
  },
  onComplete: (cb) => {
    const handler = (_e, r) => cb(r);
    ipcRenderer.on("scrape:complete", handler);
    return () => ipcRenderer.off("scrape:complete", handler);
  },
  onError: (cb) => {
    const handler = (_e, err) => cb(err);
    ipcRenderer.on("scrape:error", handler);
    return () => ipcRenderer.off("scrape:error", handler);
  }
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
