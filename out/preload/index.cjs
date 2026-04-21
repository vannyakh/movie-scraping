"use strict";
const electron = require("electron");
const api = {
  startScraping: (config) => electron.ipcRenderer.invoke("scrape:start", config),
  stopScraping: () => electron.ipcRenderer.invoke("scrape:stop"),
  pauseScraping: () => electron.ipcRenderer.invoke("scrape:pause"),
  resumeScraping: () => electron.ipcRenderer.invoke("scrape:resume"),
  openPath: (p) => electron.ipcRenderer.invoke("open:path", p),
  selectFolder: () => electron.ipcRenderer.invoke("dialog:selectFolder"),
  onProgress: (cb) => {
    const h = (_, v) => cb(v);
    electron.ipcRenderer.on("scrape:progress", h);
    return () => electron.ipcRenderer.off("scrape:progress", h);
  },
  onLog: (cb) => {
    const h = (_, v) => cb(v);
    electron.ipcRenderer.on("scrape:log", h);
    return () => electron.ipcRenderer.off("scrape:log", h);
  },
  onComplete: (cb) => {
    const h = (_, v) => cb(v);
    electron.ipcRenderer.on("scrape:complete", h);
    return () => electron.ipcRenderer.off("scrape:complete", h);
  },
  onError: (cb) => {
    const h = (_, v) => cb(v);
    electron.ipcRenderer.on("scrape:error", h);
    return () => electron.ipcRenderer.off("scrape:error", h);
  },
  onMovieBatch: (cb) => {
    const h = (_, v) => cb(v);
    electron.ipcRenderer.on("scrape:movieBatch", h);
    return () => electron.ipcRenderer.off("scrape:movieBatch", h);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
