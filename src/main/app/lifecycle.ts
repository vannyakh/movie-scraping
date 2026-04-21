import { app, BrowserWindow } from 'electron'
import { createMainWindow } from '../windows/create-main-window'
import { registerAllIpc, setMainWindow } from '../ipc'
import { closeDatabase } from '../db'

export function attachAppLifecycle(): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createMainWindow()
      setMainWindow(win)
    }
  })

  app.on('before-quit', () => {
    void closeDatabase()
  })

  app.whenReady().then(() => {
    registerAllIpc()
    const win = createMainWindow()
    setMainWindow(win)
  })
}
