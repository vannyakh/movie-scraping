import { ipcMain }   from 'electron'
import { spawn }      from 'child_process'
import { existsSync } from 'fs'
import { resolve }    from 'path'
import { app }        from 'electron'
import { getMainWindow } from './context'

// ─── Locate the playwright binary ─────────────────────────────────────────────

function playwrightBin(): string {
  const isWin = process.platform === 'win32'
  const ext   = isWin ? '.cmd' : ''

  // In development: workspace root / node_modules / .bin
  // In production (electron-builder): resourcesPath / app / node_modules / .bin
  const candidates = [
    resolve(app.getAppPath(), 'node_modules', '.bin', `playwright${ext}`),
    resolve(process.resourcesPath ?? '', 'app', 'node_modules', '.bin', `playwright${ext}`),
    resolve(process.resourcesPath ?? '', 'node_modules', '.bin', `playwright${ext}`),
  ]

  return candidates.find((p) => existsSync(p)) ?? `playwright${ext}`
}

// ─── Check if the Chromium binary exists ──────────────────────────────────────

function chromiumInstalled(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require('playwright') as typeof import('playwright')
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
}

// ─── Register IPC handlers ───────────────────────────────────────────────────

export function registerBrowserIpc(): void {

  ipcMain.handle('browser:checkInstalled', () => chromiumInstalled())

  ipcMain.handle('browser:install', async () => {
    const win = getMainWindow()
    const bin = playwrightBin()

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      let proc: ReturnType<typeof spawn>

      try {
        proc = spawn(bin, ['install', 'chromium'], {
          shell: process.platform === 'win32',
          cwd:   app.getAppPath(),
          env:   { ...process.env },
        })
      } catch (e) {
        const msg = (e as Error).message
        win?.webContents.send('browser:installLog', { text: `Launch error: ${msg}`, done: true, success: false })
        resolve({ success: false, error: msg })
        return
      }

      const push = (text: string) =>
        win?.webContents.send('browser:installLog', { text, done: false })

      proc.stdout?.on('data', (d: Buffer) => push(d.toString()))
      proc.stderr?.on('data', (d: Buffer) => push(d.toString()))

      proc.on('error', (err: Error) => {
        win?.webContents.send('browser:installLog', { text: `Error: ${err.message}`, done: true, success: false })
        resolve({ success: false, error: err.message })
      })

      proc.on('close', (code: number | null) => {
        const success = code === 0
        win?.webContents.send('browser:installLog', {
          text:    success ? 'Chromium installed successfully.' : `Install exited with code ${code}.`,
          done:    true,
          success,
        })
        resolve({ success })
      })
    })
  })
}
