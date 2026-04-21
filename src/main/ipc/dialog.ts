import { ipcMain, shell, dialog } from 'electron'
import { getMainWindow } from './context'

export function registerDialogIpc(): void {
  ipcMain.handle('open:path', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('dialog:selectFolder', async () => {
    const win = getMainWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    return canceled ? null : filePaths[0]
  })
}
