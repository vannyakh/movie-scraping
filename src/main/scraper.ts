import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScraperConfig {
  /** Root URL of the movie site to scrape */
  baseUrl: string
  /** Folder where JSON and Excel files are written */
  outputDir: string
  /** Run Chromium headlessly (no visible browser window) */
  headless: boolean
  /** Cap on movies collected per category (undefined = unlimited) */
  maxMoviesPerCategory?: number
}

export interface Category {
  name: string
  url: string
}

export interface MovieItem {
  title: string
  url: string
  category: string
}

export interface MovieDetail extends MovieItem {
  year?: string
  rating?: string
  duration?: string
  director?: string
  cast?: string[]
  description?: string
  poster?: string
}

export interface ScraperProgress {
  step: 1 | 2 | 3
  label: string
  current: number
  total: number
  message: string
}

export interface ScraperResult {
  jsonPath: string
  excelPath: string
  totalMovies: number
}

export type ProgressCallback = (p: ScraperProgress) => void
export type LogCallback = (msg: string) => void

// ─── Step 1 – Categories ──────────────────────────────────────────────────────

async function scrapeCategories(
  page: Page,
  baseUrl: string,
  onLog: LogCallback,
): Promise<Category[]> {
  onLog('Step 1 › Navigating to home page to collect categories…')
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  /*
   * Adapt the selectors below to your target site.
   * The heuristic tries several common patterns for genre / category navigation.
   */
  const categories = await page.evaluate((origin: string) => {
    const selectors = [
      'nav a[href]',
      '.categories a[href]',
      '.genres a[href]',
      '.menu a[href]',
      'ul.nav a[href]',
    ]
    const seen = new Set<string>()
    const results: { name: string; url: string }[] = []

    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(sel))) {
        const name = el.textContent?.trim() ?? ''
        const url = el.href
        if (!name || !url || url.includes('#') || !url.startsWith(origin)) continue
        if (!seen.has(url)) {
          seen.add(url)
          results.push({ name, url })
        }
      }
      if (results.length) break
    }
    return results
  }, new URL(baseUrl).origin)

  onLog(`Step 1 › Found ${categories.length} categories.`)
  return categories
}

// ─── Step 2 – Movie list + pagination ─────────────────────────────────────────

async function scrapeMovieList(
  page: Page,
  category: Category,
  onLog: LogCallback,
  signal: AbortSignal,
  maxItems: number,
): Promise<MovieItem[]> {
  const collected: MovieItem[] = []
  let currentUrl: string | null = category.url
  let pageNum = 1

  while (currentUrl && !signal.aborted && collected.length < maxItems) {
    onLog(`  Step 2 › "${category.name}" — page ${pageNum}…`)
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    /*
     * Common card selectors — adapt to the actual site markup.
     * We look for links that likely point to movie detail pages.
     */
    const items = await page.evaluate((cat: string) => {
      const selectors = [
        '.movie-item a[href]',
        '.film-item a[href]',
        'article.item a[href]',
        '.card a[href]',
        '.movie a[href]',
      ]
      const seen = new Set<string>()
      const out: { title: string; url: string; category: string }[] = []

      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(sel))) {
          const title = (el.textContent?.trim() || el.getAttribute('title') || '').trim()
          const url = el.href
          if (!title || !url || seen.has(url)) continue
          seen.add(url)
          out.push({ title, url, category: cat })
        }
        if (out.length) break
      }
      return out
    }, category.name)

    collected.push(...items)

    // Generic "next page" detection
    const nextUrl = await page.evaluate(() => {
      const candidates = [
        document.querySelector<HTMLAnchorElement>('a.next'),
        document.querySelector<HTMLAnchorElement>('a[rel="next"]'),
        document.querySelector<HTMLAnchorElement>('.pagination .next a'),
        document.querySelector<HTMLAnchorElement>('.pager-next a'),
      ]
      const next = candidates.find(Boolean)
      return next?.href ?? null
    })

    currentUrl = nextUrl
    pageNum++
  }

  return collected
}

// ─── Step 3 – Detail pages ────────────────────────────────────────────────────

async function scrapeMovieDetail(
  page: Page,
  movie: MovieItem,
  onLog: LogCallback,
): Promise<MovieDetail> {
  try {
    await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const detail = await page.evaluate(() => {
      const text = (sel: string) =>
        (document.querySelector(sel) as HTMLElement | null)?.innerText?.trim()

      return {
        year: text('.year, .release-year, [itemprop="dateCreated"], .meta-year'),
        rating: text('.rating, .score, [itemprop="ratingValue"], .imdb-rating'),
        duration: text('.duration, .runtime, [itemprop="duration"], .meta-runtime'),
        director: text('.director a, [itemprop="director"] a, .meta-director'),
        description: text(
          '.description, .synopsis, [itemprop="description"], p.overview, .plot',
        ),
        cast: Array.from(
          document.querySelectorAll('.cast a, [itemprop="actor"] a, .actors a'),
        )
          .slice(0, 10)
          .map((el) => (el as HTMLElement).innerText?.trim())
          .filter(Boolean),
        poster: (
          document.querySelector('.poster img, [itemprop="image"]') as HTMLImageElement | null
        )?.src,
      }
    })

    return { ...movie, ...detail }
  } catch {
    onLog(`  Warning: could not load detail for "${movie.title}"`)
    return movie
  }
}

// ─── Save results ─────────────────────────────────────────────────────────────

async function saveResults(movies: MovieDetail[], outputDir: string): Promise<ScraperResult> {
  await fs.mkdir(outputDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const jsonPath = path.join(outputDir, `movies-${stamp}.json`)
  const excelPath = path.join(outputDir, `movies-${stamp}.xlsx`)

  await fs.writeFile(jsonPath, JSON.stringify(movies, null, 2), 'utf-8')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'MovieScraping'
  wb.created = new Date()

  const sheet = wb.addWorksheet('Movies')
  sheet.columns = [
    { header: 'Title', key: 'title', width: 42 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Duration', key: 'duration', width: 12 },
    { header: 'Director', key: 'director', width: 26 },
    { header: 'Cast', key: 'cast', width: 52 },
    { header: 'Description', key: 'description', width: 80 },
    { header: 'URL', key: 'url', width: 60 },
    { header: 'Poster', key: 'poster', width: 60 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1f2937' } }

  for (const movie of movies) {
    sheet.addRow({ ...movie, cast: movie.cast?.join(', ') ?? '' })
  }

  await wb.xlsx.writeFile(excelPath)

  return { jsonPath, excelPath, totalMovies: movies.length }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runScraper(
  config: ScraperConfig,
  onProgress: ProgressCallback,
  onLog: LogCallback,
  signal: AbortSignal,
): Promise<ScraperResult> {
  const maxPerCat = config.maxMoviesPerCategory ?? Infinity

  const browser: Browser = await chromium.launch({ headless: config.headless })
  const page = await browser.newPage()
  page.setDefaultTimeout(30_000)

  try {
    // ── Step 1 ──────────────────────────────────────────────────────────────
    const categories = await scrapeCategories(page, config.baseUrl, onLog)
    onProgress({
      step: 1,
      label: 'Categories',
      current: categories.length,
      total: categories.length,
      message: `Found ${categories.length} categories`,
    })

    if (signal.aborted) throw new Error('Scraping stopped by user.')

    // ── Step 2 ──────────────────────────────────────────────────────────────
    const allItems: MovieItem[] = []
    for (let i = 0; i < categories.length; i++) {
      if (signal.aborted) break
      const cat = categories[i]
      onProgress({
        step: 2,
        label: 'Movie List',
        current: i,
        total: categories.length,
        message: `Scraping "${cat.name}"…`,
      })
      const items = await scrapeMovieList(page, cat, onLog, signal, maxPerCat)
      allItems.push(...items)
      onLog(`  Category "${cat.name}": ${items.length} movies`)
    }
    onProgress({
      step: 2,
      label: 'Movie List',
      current: categories.length,
      total: categories.length,
      message: `${allItems.length} movies collected`,
    })

    if (signal.aborted) throw new Error('Scraping stopped by user.')

    // Deduplicate by URL
    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values())

    // ── Step 3 ──────────────────────────────────────────────────────────────
    const details: MovieDetail[] = []
    for (let i = 0; i < unique.length; i++) {
      if (signal.aborted) break
      const movie = unique[i]
      onProgress({
        step: 3,
        label: 'Detail Pages',
        current: i,
        total: unique.length,
        message: `"${movie.title}"`,
      })
      details.push(await scrapeMovieDetail(page, movie, onLog))
    }
    onProgress({
      step: 3,
      label: 'Detail Pages',
      current: details.length,
      total: unique.length,
      message: 'All details scraped',
    })

    // ── Save ─────────────────────────────────────────────────────────────────
    onLog('Saving results…')
    const result = await saveResults(details, config.outputDir)
    onLog(`✓ JSON  → ${result.jsonPath}`)
    onLog(`✓ Excel → ${result.excelPath}`)
    return result
  } finally {
    await browser.close()
  }
}
