import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface BrowserSourceData {
  url:       string
  headless?: boolean
  userAgent?: string
  delayMs?:  number
  cookies?:  string
}

export async function executeBrowserSource(
  config: Record<string, unknown>,
  _inputs: DataRecord[],
  ctx: EngineContext,
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

  if (d.cookies?.trim()) {
    try {
      const cookiePairs = d.cookies.split(';').map((s) => {
        const [name, ...rest] = s.trim().split('=')
        return { name: name.trim(), value: rest.join('=').trim(), url: d.url }
      })
      await page.context().addCookies(cookiePairs)
    } catch {
      onLog('Warning: could not set cookies')
    }
  }

  try {
    await page.goto(d.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const html = await page.content()
    onLog(`browser-source: loaded ${html.length} chars from ${d.url}`)
    onProgress(1, 1, 1, 1, 'Page loaded')

    return [{ _url: d.url, _html: html, _delayMs: d.delayMs ?? 0 }]
  } catch (err) {
    onLog(`browser-source: failed to load ${d.url}: ${err}`)
    throw err
  }
}
