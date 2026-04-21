import { BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RENDERER_DIST, VITE_DEV_SERVER_URL } from '../app/paths'
import { setMainWindow } from '../ipc/context'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
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

  win.on('closed', () => setMainWindow(null))

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  if (VITE_DEV_SERVER_URL) {
    win.webContents.on('before-input-event', (_e, input) => {
      const meta = input.meta || input.control
      if (meta && input.key === 'r') {
        win.webContents.reload()
      }
      if (meta && input.shift && input.key === 'i') {
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools()
        } else {
          win.webContents.openDevTools()
        }
      }
    })
  }

  return win
}
