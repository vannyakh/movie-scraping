import { registerDialogIpc } from './dialog'
import { registerScrapeIpc } from './scrape'
import { registerStoreIpc } from './store'

export { setMainWindow } from './context'

export function registerAllIpc(): void {
  registerScrapeIpc()
  registerDialogIpc()
  registerStoreIpc()
}
