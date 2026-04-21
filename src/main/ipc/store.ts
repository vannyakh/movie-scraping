import { ipcMain } from 'electron'
import { kvGet, kvRemove, kvSet } from '../db'

export function registerStoreIpc(): void {
  ipcMain.handle('store:get', async (_e, key: string) => {
    if (typeof key !== 'string' || !key) return null
    return kvGet(key)
  })
  ipcMain.handle('store:set', async (_e, key: string, value: string) => {
    if (typeof key !== 'string' || !key) return
    if (typeof value !== 'string') return
    await kvSet(key, value)
  })
  ipcMain.handle('store:remove', async (_e, key: string) => {
    if (typeof key !== 'string' || !key) return
    await kvRemove(key)
  })
}
