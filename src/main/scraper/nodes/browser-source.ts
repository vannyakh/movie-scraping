import type { Page } from 'playwright'
import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

type ActionType = 'click' | 'type' | 'wait' | 'scroll' | 'hover' | 'select' | 'screenshot'

interface BrowserAction {
  id:        string
  type:      ActionType
  selector?: string
  value?:    string
}

interface BrowserSourceData {
  url:           string
  headless?:     boolean
  userAgent?:    string
  delayMs?:      number
  cookies?:      string
  proxyOverride?: string  // 'global' | 'none' | 'custom'
  proxyUrl?:     string
  actions?:      BrowserAction[]
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

/** Run a pre-scrape action sequence on the page */
async function runActions(page: Page, actions: BrowserAction[], onLog: (msg: string) => void): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await page.click(action.selector, { timeout: 10_000 }).catch(() => {
              onLog(`browser-source: click "${action.selector}" — element not found, skipping`)
            })
          }
          break

        case 'hover':
          if (action.selector) {
            await page.hover(action.selector, { timeout: 10_000 }).catch(() => {
              onLog(`browser-source: hover "${action.selector}" — element not found, skipping`)
            })
          }
          break

        case 'type':
          if (action.selector && action.value !== undefined) {
            await page.fill(action.selector, action.value, { timeout: 10_000 }).catch(() => {
              onLog(`browser-source: fill "${action.selector}" — element not found, skipping`)
            })
          }
          break

        case 'select':
          if (action.selector && action.value !== undefined) {
            await page.selectOption(action.selector, action.value, { timeout: 10_000 }).catch(() => {
              onLog(`browser-source: select "${action.selector}" — element not found, skipping`)
            })
          }
          break

        case 'wait': {
          const ms = parseInt(action.value ?? '1000', 10) || 1000
          onLog(`browser-source: waiting ${ms}ms…`)
          await sleep(ms)
          break
        }

        case 'scroll': {
          if (action.selector) {
            await page.evaluate((sel) => {
              document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, action.selector).catch(() => undefined)
          } else {
            const px = action.value?.toLowerCase() === 'bottom'
              ? 999_999
              : (parseInt(action.value ?? '500', 10) || 500)
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), px)
          }
          break
        }

        case 'screenshot':
          // Useful for debugging — logged but not stored in output
          await page.screenshot({ path: `action-screenshot-${Date.now()}.png` }).catch(() => undefined)
          onLog('browser-source: screenshot saved')
          break
      }

      onLog(`browser-source: action [${action.type}]${action.selector ? ` "${action.selector}"` : ''} done`)
    } catch (err) {
      onLog(`browser-source: action [${action.type}] error — ${err}`)
    }
  }
}

export async function executeBrowserSource(
  config:  Record<string, unknown>,
  _inputs: DataRecord[],
  ctx:     EngineContext,
): Promise<DataRecord[]> {
  const d = config as unknown as BrowserSourceData

  if (!d.url?.trim()) {
    ctx.onLog('browser-source: no URL configured')
    return []
  }

  const { page, onLog, onProgress } = ctx

  if (!page) {
    return [{ _url: d.url, _delayMs: d.delayMs ?? 0, _cookies: d.cookies ?? '' }]
  }

  onLog(`Navigating to ${d.url}…`)
  onProgress(1, 1, 0, 1, `Loading ${d.url}…`)

  // Apply per-node cookies (override global cookies for this node)
  const nodeCookies = d.cookies?.trim()
  if (nodeCookies) {
    try {
      const cookiePairs = nodeCookies.split(';').map((s) => {
        const [name, ...rest] = s.trim().split('=')
        return { name: name.trim(), value: rest.join('=').trim(), url: d.url }
      }).filter((c) => c.name)
      await page.context().addCookies(cookiePairs)
      onLog(`browser-source: ${cookiePairs.length} node cookies applied`)
    } catch {
      onLog('browser-source: warning — could not set node cookies')
    }
  }

  // Log proxy override info
  if (d.proxyOverride === 'none') {
    onLog('browser-source: proxy disabled for this node (note: proxy is set at browser level; this setting is advisory)')
  } else if (d.proxyOverride === 'custom' && d.proxyUrl) {
    onLog(`browser-source: custom proxy requested: ${d.proxyUrl} (note: applies at next browser launch)`)
  }

  try {
    await page.goto(d.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Run pre-scrape action sequence
    const actions = d.actions ?? []
    if (actions.length > 0) {
      onLog(`browser-source: running ${actions.length} page action${actions.length !== 1 ? 's' : ''}…`)
      await runActions(page, actions, onLog)
    }

    const html = await page.content()
    onLog(`browser-source: loaded ${html.length} chars from ${d.url}`)
    onProgress(1, 1, 1, 1, 'Page loaded')

    return [{ _url: d.url, _html: html, _delayMs: d.delayMs ?? 0 }]
  } catch (err) {
    onLog(`browser-source: failed to load ${d.url}: ${err}`)
    throw err
  }
}
