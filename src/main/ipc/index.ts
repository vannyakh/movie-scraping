import { registerDialogIpc }   from './dialog'
import { registerScrapeIpc }   from './scrape'
import { registerStoreIpc }    from './store'
import { registerAIIpc }       from './ai'
import { registerBrowserIpc }  from './browser'
import { registerNodeTestIpc } from './node-test'

export { setMainWindow } from './context'

export function registerAllIpc(): void {
  registerScrapeIpc()
  registerDialogIpc()
  registerStoreIpc()
  registerAIIpc()
  registerBrowserIpc()
  registerNodeTestIpc()
}
