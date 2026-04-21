import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runScraper } from './scraper'
import type { ScraperConfig } from './scraper'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'out/main')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'out/renderer')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null
let abortController: AbortController | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

ipcMain.handle('scrape:start', async (_event, config: ScraperConfig) => {
  abortController?.abort()
  abortController = new AbortController()

  try {
    const result = await runScraper(
      config,
      (progress) => win?.webContents.send('scrape:progress', progress),
      (log) => win?.webContents.send('scrape:log', log),
      abortController.signal,
    )
    win?.webContents.send('scrape:complete', result)
    return { success: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    win?.webContents.send('scrape:error', message)
    return { success: false, error: message }
  } finally {
    abortController = null
  }
})

ipcMain.handle('scrape:stop', () => {
  abortController?.abort()
  abortController = null
})

ipcMain.handle('open:path', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(createWindow)
