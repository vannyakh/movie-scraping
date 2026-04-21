import type { Page } from 'playwright'
import type { LogCallback, ScraperConfig } from '@shared/ipc-types'
import { CATEGORY_SELECTORS, SKIP_URL_KEYWORDS } from './selectors'

export async function scrapeCategories(
  page: Page, config: ScraperConfig, onLog: LogCallback,
): Promise<{ name: string; url: string }[]> {
  onLog('Step 1 › Loading homepage…')
  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  const origin    = new URL(config.baseUrl).origin
  const customSel = config.selectors?.categories

  const categories = await page.evaluate(
    ({ origin, selectors, skipKw }: { origin: string; selectors: string[]; skipKw: string[] }) => {
      const seen    = new Set<string>()
      const results: { name: string; url: string }[] = []

      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(sel))) {
          const name = el.textContent?.trim() || el.getAttribute('title') || ''
          const href = el.href || ''
          if (!name || !href) continue
          if (!href.startsWith(origin)) continue
          const lhref = href.toLowerCase()
          if (skipKw.some((k) => lhref.includes(k))) continue
          if (seen.has(href)) continue
          seen.add(href)
          results.push({ name, url: href })
        }
        if (results.length >= 5) break
      }
      return results
    },
    { origin, selectors: customSel ? [customSel] : CATEGORY_SELECTORS, skipKw: SKIP_URL_KEYWORDS },
  )

  if (categories.length === 0) {
    onLog('Step 1 › No category links found — will scrape homepage directly.')
    return [{ name: 'Home', url: config.baseUrl }]
  }

  onLog(`Step 1 › Found ${categories.length} categories.`)
  return categories
}
