import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runScraper, ScrapeController } from './scraper'
import type { ScraperConfig } from './scraper'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST       = path.join(process.env.APP_ROOT, 'out/renderer')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win:        BrowserWindow | null  = null
let controller: ScrapeController | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width:     1200,
    height:    760,
    minWidth:  900,
    minHeight: 620,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload:          path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('scrape:start', async (_event, config: ScraperConfig) => {
  controller?.abort()
  controller = new ScrapeController()

  try {
    const result = await runScraper(
      config,
      (progress) => win?.webContents.send('scrape:progress',   progress),
      (log)      => win?.webContents.send('scrape:log',        log),
      (movies)   => win?.webContents.send('scrape:movieBatch', movies),
      controller,
    )
    win?.webContents.send('scrape:complete', result)
    return { success: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    win?.webContents.send('scrape:error', message)
    return { success: false, error: message }
  } finally {
    controller = null
  }
})

ipcMain.handle('scrape:stop',   () => { controller?.abort();  controller = null })
ipcMain.handle('scrape:pause',  () => { controller?.pause()  })
ipcMain.handle('scrape:resume', () => { controller?.resume() })

ipcMain.handle('open:path', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('dialog:selectFolder', async () => {
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  })
  return canceled ? null : filePaths[0]
})

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); win = null }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(createWindow)
