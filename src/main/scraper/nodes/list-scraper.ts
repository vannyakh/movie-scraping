import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface ListScraperData {
  itemSelector?:     string
  nextPageSelector?: string
  maxPages?:         number
  maxItems?:         number
}

export async function executeListScraper(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as ListScraperData

  if (!inputs.length) { ctx.onLog('list-scraper: no inputs'); return [] }

  const itemSelector    = d.itemSelector?.trim()     || 'a[href]'
  const nextPageSel     = d.nextPageSelector?.trim()  || ''
  const maxPages        = Math.max(1, d.maxPages ?? 5)
  const maxItems        = Math.max(1, d.maxItems ?? 100)
  const { page, onLog, onProgress } = ctx

  const allItems: DataRecord[] = []

  for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
    const input = inputs[inputIdx]
    const startUrl = (input.url as string | undefined) ?? (input._url as string | undefined)
    if (!startUrl) continue

    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(onLog)

    if (!page) {
      onLog('list-scraper: browser not available')
      allItems.push(input)
      continue
    }

    let currentUrl: string | null = startUrl
    let pageNum = 0

    while (currentUrl && pageNum < maxPages && allItems.length < maxItems) {
      ctx.controller.throwIfAborted()
      await ctx.controller.checkPause(onLog)

      pageNum++
      onLog(`list-scraper: ${currentUrl} (page ${pageNum}/${maxPages})`)
      onProgress(1, inputs.length * maxPages, inputIdx * maxPages + pageNum - 1, inputs.length * maxPages, `Scraping page ${pageNum}…`)

      try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

        const items = await page.$$eval(
          itemSelector,
          (els) => els.map((el) => {
            const a = el.tagName === 'A' ? el as HTMLAnchorElement : el.querySelector('a') as HTMLAnchorElement | null
            return {
              url:  a?.href ?? '',
              text: el.textContent?.trim() ?? '',
            }
          }),
        )

        for (const item of items) {
          if (!item.url) continue
          allItems.push({ url: item.url, text: item.text, _page: pageNum, _sourceUrl: startUrl })
          if (allItems.length >= maxItems) break
        }

        if (allItems.length >= maxItems) break

        // Follow pagination
        if (nextPageSel) {
          const nextHref = await page.$eval(nextPageSel, (el) => (el as HTMLAnchorElement).href).catch(() => null)
          currentUrl = nextHref ?? null
        } else {
          currentUrl = null
        }
      } catch (err) {
        onLog(`list-scraper: error on page ${pageNum}: ${err}`)
        break
      }
    }
  }

  onLog(`list-scraper: ${allItems.length} items`)
  return allItems
}
