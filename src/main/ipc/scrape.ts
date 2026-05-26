import { ipcMain } from 'electron'
import { runWorkflow, EngineController } from '../scraper/engine'
import { runScraper, ScrapeController } from '../scraper'
import type { WorkflowConfig, ScraperConfig } from '@shared/ipc-types'
import { getMainWindow } from './context'
import { readEngineSettings } from './settings-bridge'

let workflowController: EngineController | null = null
let legacyController: ScrapeController | null = null

export function registerScrapeIpc(): void {

  // ── Generic workflow engine ────────────────────────────────────────────────
  ipcMain.handle('workflow:start', async (_event, config: WorkflowConfig) => {
    const win = getMainWindow()
    workflowController?.abort()
    workflowController = new EngineController()

    const engineSettings = await readEngineSettings()

    try {
      const result = await runWorkflow(
        config,
        (progress) => win?.webContents.send('workflow:progress', progress),
        (log)      => win?.webContents.send('workflow:log', log),
        (records)  => win?.webContents.send('workflow:batch', records),
        (status)   => win?.webContents.send('workflow:nodeStatus', status),
        workflowController,
        engineSettings,
      )
      win?.webContents.send('workflow:complete', result)
      return { success: true, result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message !== 'ABORTED') win?.webContents.send('workflow:error', message)
      return { success: false, error: message }
    } finally {
      workflowController = null
    }
  })

  ipcMain.handle('workflow:stop',   () => { workflowController?.abort();  workflowController = null })
  ipcMain.handle('workflow:pause',  () => { workflowController?.pause()  })
  ipcMain.handle('workflow:resume', () => { workflowController?.resume() })

  // ── Legacy movie scraper (kept for backward compat) ────────────────────────
  ipcMain.handle('scrape:start', async (_event, config: ScraperConfig) => {
    const win = getMainWindow()
    legacyController?.abort()
    legacyController = new ScrapeController()

    try {
      const result = await runScraper(
        config,
        (progress) => win?.webContents.send('scrape:progress', progress),
        (log)      => win?.webContents.send('scrape:log', log),
        (movies)   => win?.webContents.send('scrape:movieBatch', movies),
        legacyController,
      )
      win?.webContents.send('scrape:complete', result)
      return { success: true, ...result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      win?.webContents.send('scrape:error', message)
      return { success: false, error: message }
    } finally {
      legacyController = null
    }
  })

  ipcMain.handle('scrape:stop',   () => { legacyController?.abort();  legacyController = null })
  ipcMain.handle('scrape:pause',  () => { legacyController?.pause()  })
  ipcMain.handle('scrape:resume', () => { legacyController?.resume() })
}
