import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import type {
  LogCallback,
  MovieBatchCallback,
  MovieData,
  ScraperConfig,
  ScraperProgress,
  ScraperResult,
} from '@shared/ipc-types'
import type { ScrapeController } from './controller'
import { sleep } from './controller'
import { scrapeCategories } from './categories'
import { scrapeMovieList } from './list'
import { scrapeMovieDetail } from './detail'
import { saveResults } from './export'

export async function runScraper(
  config:       ScraperConfig,
  onProgress:   (p: ScraperProgress) => void,
  onLog:        LogCallback,
  onMovieBatch: MovieBatchCallback,
  controller:   ScrapeController,
): Promise<ScraperResult> {
  const delayMs = config.delayMs ?? 0

  const browser: Browser = await chromium.launch({ headless: config.headless })
  const ctx = await browser.newContext({
    userAgent: config.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport:  { width: 1280, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  })
  const page: Page = await ctx.newPage()
  page.setDefaultTimeout(30_000)

  try {
    const categories = await scrapeCategories(page, config, onLog)
    onProgress({ step: 1, label: 'Categories', current: categories.length, total: categories.length, message: `Found ${categories.length} categories` })
    controller.throwIfAborted()

    const allItems: { title: string; url: string; category: string }[] = []
    for (let i = 0; i < categories.length; i++) {
      controller.throwIfAborted()
      await controller.checkPause(onLog)
      const cat = categories[i]
      onProgress({ step: 2, label: 'Movie List', current: i, total: categories.length, message: `Scraping "${cat.name}"…` })
      const items = await scrapeMovieList(page, cat, config, controller, onLog)
      allItems.push(...items)
      onLog(`  "${cat.name}": ${items.length} movies`)
      if (delayMs > 0) await sleep(delayMs)
    }
    onProgress({ step: 2, label: 'Movie List', current: categories.length, total: categories.length, message: `${allItems.length} movies collected` })
    controller.throwIfAborted()

    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values())
    onLog(`Step 2 › ${unique.length} unique movie URLs collected.`)

    const details: MovieData[] = []
    for (let i = 0; i < unique.length; i++) {
      controller.throwIfAborted()
      await controller.checkPause(onLog)
      const movie = unique[i]
      onProgress({ step: 3, label: 'Detail Pages', current: i, total: unique.length, message: `"${movie.title}"` })
      const detail = await scrapeMovieDetail(page, movie, onLog, config)
      details.push(detail)
      onMovieBatch([detail])
      if (delayMs > 0) await sleep(delayMs)
    }
    onProgress({ step: 3, label: 'Detail Pages', current: details.length, total: unique.length, message: 'All details scraped' })

    onLog(`Saving ${details.length} movies…`)
    return await saveResults(details, config, onLog)
  } finally {
    await browser.close()
  }
}
