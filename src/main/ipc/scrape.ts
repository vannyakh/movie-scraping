import { ipcMain } from 'electron'
import { runScraper, ScrapeController } from '../scraper'
import type { ScraperConfig } from '@shared/ipc-types'
import { getMainWindow } from './context'

let controller: ScrapeController | null = null

export function registerScrapeIpc(): void {
  ipcMain.handle('scrape:start', async (_event, config: ScraperConfig) => {
    const win = getMainWindow()
    controller?.abort()
    controller = new ScrapeController()

    try {
      const result = await runScraper(
        config,
        (progress) => win?.webContents.send('scrape:progress', progress),
        (log) => win?.webContents.send('scrape:log', log),
        (movies) => win?.webContents.send('scrape:movieBatch', movies),
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

  ipcMain.handle('scrape:stop', () => {
    controller?.abort()
    controller = null
  })
  ipcMain.handle('scrape:pause', () => {
    controller?.pause()
  })
  ipcMain.handle('scrape:resume', () => {
    controller?.resume()
  })
}
