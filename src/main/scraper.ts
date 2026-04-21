import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

// ─── Controller (pause / resume / abort) ─────────────────────────────────────

export class ScrapeController {
  private _aborted = false
  private _paused  = false

  abort()  { this._aborted = true; this._paused = false }
  pause()  { this._paused  = true }
  resume() { this._paused  = false }

  get aborted() { return this._aborted }
  get paused()  { return this._paused  }

  async checkPause(onLog: LogCallback) {
    if (!this._paused) return
    onLog('⏸ Paused — waiting for resume…')
    while (this._paused && !this._aborted) await sleep(250)
    if (!this._aborted) onLog('▶ Resumed')
  }

  throwIfAborted(msg = 'Scraping stopped by user.') {
    if (this._aborted) throw new Error(msg)
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScraperConfig {
  baseUrl: string
  outputDir: string
  headless: boolean
  maxMoviesPerCategory?: number
  maxPagesPerCategory?: number
  delayMs?: number
  userAgent?: string
  exportJson?: boolean
  exportExcel?: boolean
  exportCsv?: boolean
  selectors?: {
    categories?: string
    movieList?:  string
    nextPage?:   string
  }
}

export interface MovieData {
  title:       string
  url:         string
  category:    string
  year?:       string
  rating?:     string
  duration?:   string
  director?:   string
  cast?:       string
  description?: string
  poster?:     string
}

export interface ScraperProgress {
  step:    1 | 2 | 3
  label:   string
  current: number
  total:   number
  message: string
}

export interface ScraperResult {
  jsonPath?:   string
  excelPath?:  string
  csvPath?:    string
  totalMovies: number
  movies:      MovieData[]
}

export type ProgressCallback   = (p: ScraperProgress) => void
export type LogCallback        = (msg: string) => void
export type MovieBatchCallback = (movies: MovieData[]) => void

// ─── Internal item shape (has array cast before serialisation) ────────────────

interface MovieDetailInternal extends Omit<MovieData, 'cast'> {
  castArr?: string[]
}

// ─── Step 1 – categories ──────────────────────────────────────────────────────

async function scrapeCategories(
  page: Page,
  config: ScraperConfig,
  onLog: LogCallback,
): Promise<{ name: string; url: string }[]> {
  onLog('Step 1 › Navigating to home page…')
  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  const customSel = config.selectors?.categories
  const categories = await page.evaluate(
    ({ origin, sel }: { origin: string; sel?: string }) => {
      const selectors = sel
        ? [sel]
        : ['nav a[href]', '.categories a[href]', '.genres a[href]', '.menu a[href]', 'ul.nav a[href]']
      const seen    = new Set<string>()
      const results: { name: string; url: string }[] = []
      for (const s of selectors) {
        for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(s))) {
          const name = el.textContent?.trim() ?? ''
          const url  = el.href
          if (!name || !url || url.includes('#') || !url.startsWith(origin)) continue
          if (!seen.has(url)) { seen.add(url); results.push({ name, url }) }
        }
        if (results.length) break
      }
      return results
    },
    { origin: new URL(config.baseUrl).origin, sel: customSel },
  )

  onLog(`Step 1 › Found ${categories.length} categories.`)
  return categories
}

// ─── Step 2 – movie list + pagination ─────────────────────────────────────────

async function scrapeMovieList(
  page:       Page,
  category:   { name: string; url: string },
  config:     ScraperConfig,
  controller: ScrapeController,
  onLog:      LogCallback,
): Promise<{ title: string; url: string; category: string }[]> {
  const maxItems  = config.maxMoviesPerCategory ?? Infinity
  const maxPages  = config.maxPagesPerCategory  ?? Infinity
  const delayMs   = config.delayMs             ?? 0
  const movieSel  = config.selectors?.movieList
  const nextSel   = config.selectors?.nextPage

  const collected: { title: string; url: string; category: string }[] = []
  let currentUrl: string | null = category.url
  let pageNum = 1

  while (currentUrl && !controller.aborted && collected.length < maxItems && pageNum <= maxPages) {
    await controller.checkPause(onLog)
    controller.throwIfAborted()

    onLog(`  Step 2 › "${category.name}" — page ${pageNum}`)
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const items = await page.evaluate(
      ({ cat, sel }: { cat: string; sel?: string }) => {
        const sels = sel
          ? [sel]
          : ['.movie-item a[href]', '.film-item a[href]', 'article.item a[href]', '.card a[href]', '.movie a[href]']
        const seen = new Set<string>()
        const out:  { title: string; url: string; category: string }[] = []
        for (const s of sels) {
          for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(s))) {
            const title = (el.textContent?.trim() || el.getAttribute('title') || '').trim()
            const url   = el.href
            if (!title || !url || seen.has(url)) continue
            seen.add(url)
            out.push({ title, url, category: cat })
          }
          if (out.length) break
        }
        return out
      },
      { cat: category.name, sel: movieSel },
    )

    collected.push(...items.slice(0, maxItems - collected.length))

    const nextUrl = await page.evaluate((sel?: string) => {
      const candidates = sel
        ? [document.querySelector<HTMLAnchorElement>(sel)]
        : [
            document.querySelector<HTMLAnchorElement>('a.next'),
            document.querySelector<HTMLAnchorElement>('a[rel="next"]'),
            document.querySelector<HTMLAnchorElement>('.pagination .next a'),
            document.querySelector<HTMLAnchorElement>('.pager-next a'),
          ]
      return candidates.find(Boolean)?.href ?? null
    }, nextSel)

    currentUrl = nextUrl
    pageNum++
    if (delayMs > 0) await sleep(delayMs)
  }

  return collected
}

// ─── Step 3 – detail pages ────────────────────────────────────────────────────

async function scrapeMovieDetail(
  page:    Page,
  movie:   { title: string; url: string; category: string },
  onLog:   LogCallback,
): Promise<MovieDetailInternal> {
  try {
    await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const detail = await page.evaluate(() => {
      const text = (sel: string) =>
        (document.querySelector(sel) as HTMLElement | null)?.innerText?.trim()
      return {
        year:        text('.year, .release-year, [itemprop="dateCreated"], .meta-year'),
        rating:      text('.rating, .score, [itemprop="ratingValue"], .imdb-rating'),
        duration:    text('.duration, .runtime, [itemprop="duration"], .meta-runtime'),
        director:    text('.director a, [itemprop="director"] a, .meta-director'),
        description: text('.description, .synopsis, [itemprop="description"], p.overview, .plot'),
        castArr: Array.from(
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
    onLog(`  Warning: could not load "${movie.title}"`)
    return movie
  }
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function toCsv(movies: MovieData[]): string {
  const headers = ['Title', 'Category', 'Year', 'Rating', 'Duration', 'Director', 'Cast', 'Description', 'URL']
  const escape  = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows    = movies.map((m) =>
    [m.title, m.category, m.year ?? '', m.rating ?? '', m.duration ?? '',
     m.director ?? '', m.cast ?? '', m.description ?? '', m.url]
      .map((v) => escape(String(v)))
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

// ─── Save results ─────────────────────────────────────────────────────────────

async function saveResults(
  movies:  MovieData[],
  config:  ScraperConfig,
  onLog:   LogCallback,
): Promise<ScraperResult> {
  const { outputDir, exportJson = true, exportExcel = true, exportCsv = true } = config
  await fs.mkdir(outputDir, { recursive: true })

  const stamp    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const result: ScraperResult = { totalMovies: movies.length, movies }

  if (exportJson) {
    result.jsonPath = path.join(outputDir, `movies-${stamp}.json`)
    await fs.writeFile(result.jsonPath, JSON.stringify(movies, null, 2), 'utf-8')
    onLog(`✓ JSON  → ${result.jsonPath}`)
  }

  if (exportCsv) {
    result.csvPath = path.join(outputDir, `movies-${stamp}.csv`)
    await fs.writeFile(result.csvPath, toCsv(movies), 'utf-8')
    onLog(`✓ CSV   → ${result.csvPath}`)
  }

  if (exportExcel) {
    result.excelPath = path.join(outputDir, `movies-${stamp}.xlsx`)
    const wb    = new ExcelJS.Workbook()
    wb.creator  = 'MovieScraping'
    wb.created  = new Date()
    const sheet = wb.addWorksheet('Movies')
    sheet.columns = [
      { header: 'Title',       key: 'title',       width: 42 },
      { header: 'Category',    key: 'category',    width: 20 },
      { header: 'Year',        key: 'year',        width: 8  },
      { header: 'Rating',      key: 'rating',      width: 10 },
      { header: 'Duration',    key: 'duration',    width: 12 },
      { header: 'Director',    key: 'director',    width: 26 },
      { header: 'Cast',        key: 'cast',        width: 52 },
      { header: 'Description', key: 'description', width: 80 },
      { header: 'URL',         key: 'url',         width: 60 },
    ]
    const hRow = sheet.getRow(1)
    hRow.font  = { bold: true, color: { argb: 'FFFFFFFF' } }
    hRow.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1f2937' } }
    for (const m of movies) sheet.addRow(m)
    await wb.xlsx.writeFile(result.excelPath)
    onLog(`✓ Excel → ${result.excelPath}`)
  }

  return result
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runScraper(
  config:       ScraperConfig,
  onProgress:   ProgressCallback,
  onLog:        LogCallback,
  onMovieBatch: MovieBatchCallback,
  controller:   ScrapeController,
): Promise<ScraperResult> {
  const delayMs = config.delayMs ?? 0

  const launchOpts: Parameters<typeof chromium.launch>[0] = { headless: config.headless }
  if (config.userAgent) {
    // userAgent is applied per-context below
  }
  const browser: Browser = await chromium.launch(launchOpts)
  const ctx = await browser.newContext({
    userAgent: config.userAgent,
    viewport:  { width: 1280, height: 720 },
  })
  const page: Page = await ctx.newPage()
  page.setDefaultTimeout(30_000)

  try {
    // ── Step 1 ───────────────────────────────────────────────────────────────
    const categories = await scrapeCategories(page, config, onLog)
    onProgress({ step: 1, label: 'Categories', current: categories.length, total: categories.length, message: `Found ${categories.length} categories` })

    controller.throwIfAborted()

    // ── Step 2 ───────────────────────────────────────────────────────────────
    const allItems: { title: string; url: string; category: string }[] = []
    for (let i = 0; i < categories.length; i++) {
      controller.throwIfAborted()
      await controller.checkPause(onLog)
      const cat = categories[i]
      onProgress({ step: 2, label: 'Movie List', current: i, total: categories.length, message: `Scraping "${cat.name}"…` })
      const items = await scrapeMovieList(page, cat, config, controller, onLog)
      allItems.push(...items)
      onLog(`  "${cat.name}": ${items.length} movies found`)
      if (delayMs > 0) await sleep(delayMs)
    }
    onProgress({ step: 2, label: 'Movie List', current: categories.length, total: categories.length, message: `${allItems.length} movies collected` })

    controller.throwIfAborted()

    // Deduplicate
    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values())

    // ── Step 3 ───────────────────────────────────────────────────────────────
    const details: MovieData[] = []
    for (let i = 0; i < unique.length; i++) {
      controller.throwIfAborted()
      await controller.checkPause(onLog)
      const movie = unique[i]
      onProgress({ step: 3, label: 'Detail Pages', current: i, total: unique.length, message: `"${movie.title}"` })

      const raw    = await scrapeMovieDetail(page, movie, onLog)
      const detail: MovieData = {
        title:       raw.title,
        url:         raw.url,
        category:    raw.category,
        year:        raw.year,
        rating:      raw.rating,
        duration:    raw.duration,
        director:    raw.director,
        cast:        raw.castArr?.join(', '),
        description: raw.description,
        poster:      raw.poster,
      }
      details.push(detail)
      onMovieBatch([detail])

      if (delayMs > 0) await sleep(delayMs)
    }
    onProgress({ step: 3, label: 'Detail Pages', current: details.length, total: unique.length, message: 'All details scraped' })

    // ── Save ─────────────────────────────────────────────────────────────────
    onLog('Saving results…')
    const result = await saveResults(details, config, onLog)
    return result
  } finally {
    await browser.close()
  }
}
