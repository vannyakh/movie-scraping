import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

type PaginationType = 'none' | 'next-button' | 'url-pattern' | 'infinite-scroll'

interface ListScraperData {
  itemSelector?:     string
  paginationType?:   PaginationType
  // next-button
  nextPageSelector?: string
  // url-pattern
  urlPattern?:       string
  startPage?:        number
  // infinite-scroll
  scrollDelay?:      number
  maxScrolls?:       number
  // limits
  maxPages?:         number
  maxItems?:         number
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

/** Extract items from the current page using the configured selector */
async function extractItems(
  page: NonNullable<EngineContext['page']>,
  itemSelector: string,
): Promise<Array<{ url: string; text: string }>> {
  return page.$$eval(
    itemSelector,
    (els) => els.map((el) => {
      const a = el.tagName === 'A'
        ? (el as HTMLAnchorElement)
        : (el.querySelector('a') as HTMLAnchorElement | null)
      return {
        url:  a?.href ?? (el as HTMLAnchorElement).href ?? '',
        text: (el.textContent ?? '').trim(),
      }
    }),
  ).catch(() => [])
}

export async function executeListScraper(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as ListScraperData

  if (!inputs.length) { ctx.onLog('list-scraper: no inputs'); return [] }

  const itemSelector  = d.itemSelector?.trim()      || 'a[href]'
  const paginationType: PaginationType = (d.paginationType as PaginationType) ?? 'next-button'
  const nextPageSel   = d.nextPageSelector?.trim()  || ''
  const urlPattern    = d.urlPattern?.trim()         || ''
  const startPage     = Math.max(0, d.startPage ?? 1)
  const scrollDelay   = Math.max(200, d.scrollDelay ?? 1500)
  const maxScrolls    = Math.max(1,   d.maxScrolls  ?? 10)
  const maxPages      = Math.max(1,   d.maxPages    ?? 5)
  const maxItems      = Math.max(1,   d.maxItems    ?? 100)

  const { page, onLog, onProgress } = ctx

  const allItems: DataRecord[] = []

  for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
    if (allItems.length >= maxItems) break

    const input    = inputs[inputIdx]
    const startUrl = (input.url as string | undefined) ?? (input._url as string | undefined)
    if (!startUrl) continue

    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(onLog)

    if (!page) {
      onLog('list-scraper: browser not available')
      allItems.push(input)
      continue
    }

    // ── Pagination: none ──────────────────────────────────────────────────────
    if (paginationType === 'none') {
      onLog(`list-scraper: ${startUrl} (single page)`)
      onProgress(1, inputs.length, inputIdx, inputs.length, 'Scraping single page…')
      try {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        const items = await extractItems(page, itemSelector)
        for (const item of items) {
          if (!item.url) continue
          allItems.push({ url: item.url, text: item.text, _page: 1, _sourceUrl: startUrl })
          if (allItems.length >= maxItems) break
        }
      } catch (err) { onLog(`list-scraper: error — ${err}`) }
      continue
    }

    // ── Pagination: url-pattern ───────────────────────────────────────────────
    if (paginationType === 'url-pattern' && urlPattern) {
      for (let pageNum = startPage; pageNum < startPage + maxPages && allItems.length < maxItems; pageNum++) {
        ctx.controller.throwIfAborted()
        await ctx.controller.checkPause(onLog)

        const pageUrl = urlPattern.replace('{page}', String(pageNum))
        const relativePageNum = pageNum - startPage + 1
        onLog(`list-scraper: ${pageUrl} (page ${relativePageNum}/${maxPages})`)
        onProgress(1, maxPages, relativePageNum - 1, maxPages, `Page ${relativePageNum}…`)

        try {
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
          const items = await extractItems(page, itemSelector)

          if (items.length === 0) {
            onLog(`list-scraper: no items on page ${relativePageNum} — stopping`)
            break
          }

          for (const item of items) {
            if (!item.url) continue
            allItems.push({ url: item.url, text: item.text, _page: relativePageNum, _sourceUrl: startUrl })
            if (allItems.length >= maxItems) break
          }
        } catch (err) {
          onLog(`list-scraper: error on page ${relativePageNum}: ${err}`)
          break
        }
      }
      continue
    }

    // ── Pagination: infinite-scroll ───────────────────────────────────────────
    if (paginationType === 'infinite-scroll') {
      onLog(`list-scraper: ${startUrl} (infinite scroll, max ${maxScrolls} scrolls)`)
      onProgress(1, inputs.length, inputIdx, inputs.length, 'Loading page…')

      try {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

        let prevCount  = 0
        let scrollsDone = 0

        while (scrollsDone < maxScrolls && allItems.length < maxItems) {
          ctx.controller.throwIfAborted()
          await ctx.controller.checkPause(onLog)

          // Scroll to bottom
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await sleep(scrollDelay)

          const items  = await extractItems(page, itemSelector)
          const newItems = items.slice(prevCount)

          for (const item of newItems) {
            if (!item.url) continue
            allItems.push({ url: item.url, text: item.text, _page: scrollsDone + 1, _sourceUrl: startUrl })
            if (allItems.length >= maxItems) break
          }

          scrollsDone++
          onLog(`list-scraper: scroll ${scrollsDone}/${maxScrolls} — ${items.length} items visible`)
          onProgress(1, maxScrolls, scrollsDone, maxScrolls, `Scroll ${scrollsDone}/${maxScrolls}…`)

          if (items.length === prevCount) {
            onLog('list-scraper: no new items after scroll — end of list')
            break
          }
          prevCount = items.length
        }
      } catch (err) {
        onLog(`list-scraper: scroll error — ${err}`)
      }
      continue
    }

    // ── Pagination: next-button (default) ─────────────────────────────────────
    let currentUrl: string | null = startUrl
    let pageNum = 0

    while (currentUrl && pageNum < maxPages && allItems.length < maxItems) {
      ctx.controller.throwIfAborted()
      await ctx.controller.checkPause(onLog)

      pageNum++
      onLog(`list-scraper: ${currentUrl} (page ${pageNum}/${maxPages})`)
      onProgress(1, inputs.length * maxPages, inputIdx * maxPages + pageNum - 1, inputs.length * maxPages, `Page ${pageNum}…`)

      try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        const items = await extractItems(page, itemSelector)

        for (const item of items) {
          if (!item.url) continue
          allItems.push({ url: item.url, text: item.text, _page: pageNum, _sourceUrl: startUrl })
          if (allItems.length >= maxItems) break
        }

        if (allItems.length >= maxItems) break

        if (nextPageSel) {
          currentUrl = await page.$eval(
            nextPageSel,
            (el) => (el as HTMLAnchorElement).href,
          ).catch(() => null)
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
