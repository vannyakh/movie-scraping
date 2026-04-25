import { registerDialogIpc }  from './dialog'
import { registerScrapeIpc }  from './scrape'
import { registerStoreIpc }   from './store'
import { registerAIIpc }      from './ai'
import { registerBrowserIpc } from './browser'

export { setMainWindow } from './context'

export function registerAllIpc(): void {
  registerScrapeIpc()
  registerDialogIpc()
  registerStoreIpc()
  registerAIIpc()
  registerBrowserIpc()
}
