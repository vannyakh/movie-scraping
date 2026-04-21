import { chromium } from 'playwright'
import type { Browser, Page, Request as PlaywrightRequest } from 'playwright'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

// ─── Controller ───────────────────────────────────────────────────────────────

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

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScraperConfig {
  baseUrl:               string
  outputDir:             string
  headless:              boolean
  maxMoviesPerCategory?: number
  maxPagesPerCategory?:  number
  delayMs?:              number
  userAgent?:            string
  exportJson?:           boolean
  exportExcel?:          boolean
  exportCsv?:            boolean
  selectors?: {
    categories?: string
    movieList?:  string
    nextPage?:   string
  }
}

export interface MovieData {
  title:        string
  url:          string
  category:     string
  year?:        string
  rating?:      string
  duration?:    string
  director?:    string
  cast?:        string
  description?: string
  poster?:      string
  videoUrl?:    string   // m3u8 / mp4 source captured from network
  subtitles?:   string   // comma-separated caption language list
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

// ─── Step 1 – Categories ──────────────────────────────────────────────────────
// Strategy: try many selectors → fall back to homepage itself.

const CATEGORY_SELECTORS = [
  // User hint first (set in config)
  // Common menu selectors
  'nav a[href]',
  '.main-menu a[href]',
  '.menu-main a[href]',
  '.primary-menu a[href]',
  '.nav-menu a[href]',
  '.navbar a[href]',
  // Genre / category pages
  '.genres a[href]',
  '.categories a[href]',
  '.the-loai a[href]',        // Vietnamese
  '.genre-list a[href]',
  '.cat-list a[href]',
  // Header nav
  'header nav a[href]',
  'header ul a[href]',
  '.header-menu a[href]',
  '#main-nav a[href]',
  '#menu-primary a[href]',
  // Generic lists
  '.menu a[href]',
  'ul.nav a[href]',
]

// URL fragments that indicate a non-category link
const SKIP_URL_KEYWORDS = [
  'login', 'logout', 'register', 'signup', 'search', 'tim-kiem',
  'about', 'contact', 'privacy', 'terms', 'sitemap', 'rss', 'feed',
  'dang-nhap', 'dang-ky', 'lien-he', 'gioi-thieu',
  'javascript:', 'mailto:', 'tel:', '#',
]

async function scrapeCategories(
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
        if (results.length >= 5) break   // found enough from this selector
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

// ─── Step 2 – Movie list + pagination ─────────────────────────────────────────
// 4 strategies tried in order; first one that returns ≥ 3 results wins.

const LIST_SELECTORS = [
  // --- Specific class names ---
  '.movie-item a[href]',
  '.film-item a[href]',
  '.item .thumb a[href]',
  '.item a.thumb[href]',
  '.item h3 a[href]',
  '.item h2 a[href]',
  '.item .name a[href]',
  '.item .title a[href]',
  // article-based
  'article.item a[href]',
  'article a.thumb[href]',
  'article .thumb a[href]',
  'article h3 a[href]',
  // Vietnamese sites
  '.phim-item a[href]',
  '.phim a[href]',
  '.thumb-item a[href]',
  '.box-phim a[href]',
  '.movies-list a.thumb[href]',
  // Generic card patterns
  '.card a[href]',
  '.card-item a[href]',
  '.movie a[href]',
  '.movies a[href]',
  '.film a[href]',
  '.post-item a[href]',
  // WordPress common
  '.entry-title a[href]',
  'h2.entry-title a[href]',
  'h3.entry-title a[href]',
  // Grid wrappers
  '.grid-item a[href]',
  '.list-movie a[href]',
  '.list-film a[href]',
]

const NEXT_PAGE_SELECTORS = [
  'a.next[href]',
  'a[rel="next"][href]',
  '.pagination .next a[href]',
  '.pagination a[aria-label="Next"][href]',
  '.page-numbers.next[href]',
  'a.page-numbers.next[href]',
  '.pager-next a[href]',
  '.next-page a[href]',
  'li.next a[href]',
  'a[title="Next page"][href]',
  'a[title="Trang sau"][href]',
  '.phan-trang .next[href]',
]

// URL segments that strongly suggest this is a movie detail page
const MOVIE_URL_PATTERNS = [
  '/phim/', '/xem-phim/', '/movie/', '/movies/',
  '/film/', '/films/', '/watch/', '/detail/',
  '/truyen-hinh/', '/series/', '/tap-', '/episode',
]

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

    const origin = new URL(config.baseUrl).origin
    const items = await page.evaluate(
      ({
        cat, origin, customSel, listSels, moviePatterns, skipKw,
      }: {
        cat: string; origin: string; customSel?: string
        listSels: string[]; moviePatterns: string[]; skipKw: string[]
      }) => {
        const seen = new Set<string>()
        const out: { title: string; url: string; category: string }[] = []

        function add(el: HTMLAnchorElement) {
          const url   = el.href
          const title = (el.getAttribute('title') || el.textContent?.trim() || el.querySelector('img')?.getAttribute('alt') || '').trim()
          if (!title || !url || seen.has(url)) return
          if (!url.startsWith(origin)) return
          seen.add(url)
          out.push({ title, url, category: cat })
        }

        // ── Strategy 1: user selector or standard list selectors ─────────────
        const sels = customSel ? [customSel] : listSels
        for (const s of sels) {
          for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(s))) add(el)
          if (out.length >= 3) break
        }
        if (out.length >= 3) return out

        // ── Strategy 2: anchor tags that wrap or are near an <img> ───────────
        // Classic movie-card pattern: thumbnail + link
        for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img'))) {
          // Case A: <a href><img></a>
          const parentA = img.closest<HTMLAnchorElement>('a[href]')
          if (parentA) { add(parentA); continue }
          // Case B: sibling or cousin link inside the same card container
          const card = img.closest('li, div, article')
          if (!card) continue
          for (const a of Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'))) add(a)
        }
        if (out.length >= 3) return out

        // ── Strategy 3: any internal link matching movie URL patterns ─────────
        for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
          const url = a.href
          if (!url.startsWith(origin)) continue
          const path = new URL(url).pathname.toLowerCase()
          if (moviePatterns.some((p) => path.includes(p))) add(a)
        }
        if (out.length >= 3) return out

        // ── Strategy 4: largest repeating group of same-parent links ─────────
        // Exclude obvious nav/footer links
        const skipKwLower = skipKw.map((k) => k.toLowerCase())
        const allInternal = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .filter((a) => {
            const url = a.href
            if (!url.startsWith(origin)) return false
            const low = url.toLowerCase()
            return !skipKwLower.some((k) => low.includes(k))
          })

        // group by parent class → pick largest group
        const groups = new Map<string, HTMLAnchorElement[]>()
        for (const a of allInternal) {
          const key = a.parentElement?.className ?? '__none__'
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(a)
        }
        let best: HTMLAnchorElement[] = []
        for (const [, grp] of groups) {
          if (grp.length > best.length) best = grp
        }
        for (const a of best) add(a)
        return out
      },
      { cat: category.name, origin, customSel: movieSel, listSels: LIST_SELECTORS, moviePatterns: MOVIE_URL_PATTERNS, skipKw: SKIP_URL_KEYWORDS },
    )

    if (items.length === 0) {
      onLog(`  ⚠ No movies found on page ${pageNum} of "${category.name}"`)
    }

    collected.push(...items.slice(0, maxItems - collected.length))

    // ── Pagination ─────────────────────────────────────────────────────────
    const nextUrl = await page.evaluate(
      ({ customSel, nextSels }: { customSel?: string; nextSels: string[] }) => {
        const sels = customSel ? [customSel] : nextSels
        for (const s of sels) {
          const el = document.querySelector<HTMLAnchorElement>(s)
          if (el?.href) return el.href
        }
        return null
      },
      { customSel: nextSel, nextSels: NEXT_PAGE_SELECTORS },
    )

    currentUrl = nextUrl
    pageNum++
    if (delayMs > 0) await sleep(delayMs)
  }

  return collected
}

// ─── Step 3 – Detail pages ────────────────────────────────────────────────────
// Combines: network interception (m3u8/mp4) + JWPlayer JS API + OG/JSON-LD/CSS

/** URL patterns that indicate a raw video manifest or stream file. */
const VIDEO_URL_RE = /\.(m3u8|mp4|mkv|webm|mpd)(\?.*)?$/i
const VIDEO_PATH_RE = /\/(manifest|playlist|index)\.(m3u8|mpd)/i
const VIDEO_HINT_RE = /\/(hls|dash|stream|video)\//i

async function scrapeMovieDetail(
  page:  Page,
  movie: { title: string; url: string; category: string },
  onLog: LogCallback,
): Promise<MovieData> {
  try {
    // ── Network interception: capture video manifests before they become blob ──
    const capturedVideos: string[] = []
    const onRequest = (req: PlaywrightRequest) => {
      const u = req.url()
      if (u.startsWith('blob:')) return
      if (VIDEO_URL_RE.test(u) || VIDEO_PATH_RE.test(u) || VIDEO_HINT_RE.test(u)) {
        capturedVideos.push(u)
      }
    }
    page.on('request', onRequest)

    await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Give JWPlayer ~2 s to initialise and fire its first manifest request
    await sleep(2000)
    page.off('request', onRequest)

    // Prefer m3u8 master playlist; fall back to first match
    const videoUrl =
      capturedVideos.find((u) => u.includes('master') || u.includes('index.m3u8')) ||
      capturedVideos.find((u) => VIDEO_URL_RE.test(u)) ||
      capturedVideos[0]

    // ── DOM extraction (OG / JSON-LD / CSS / JWPlayer API) ────────────────────
    const data = await page.evaluate(() => {
      // Helper: first non-empty text from a list of selectors
      const text = (...sels: string[]) => {
        for (const sel of sels) {
          const el = document.querySelector(sel) as HTMLElement | null
          const t  = el?.innerText?.trim() || el?.getAttribute('content')?.trim()
          if (t) return t
        }
        return undefined
      }

      // ── A: Open Graph + meta ─────────────────────────────────────────────
      const ogTitle  = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim()
      const ogDesc   = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content?.trim()
      const ogImg    = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content?.trim()
      const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim()

      // ── B: JSON-LD ───────────────────────────────────────────────────────
      let jld: Record<string, unknown> = {}
      try {
        const script = document.querySelector('script[type="application/ld+json"]')
        if (script?.textContent) {
          const parsed = JSON.parse(script.textContent)
          jld = Array.isArray(parsed) ? parsed[0] : parsed
        }
      } catch { /* ignore */ }

      // ── C: CSS selectors ─────────────────────────────────────────────────
      const title = text('h1.title','h1.movie-title','h1.film-title','h1.entry-title','.detail-title h1','.info h1','#title','h1')
      const year = text('.year','.release-year','.meta-year','[itemprop="dateCreated"]','span.year','.film-info .year','.movie-info .year','.movie-year','.film-year','.info-year')
      const rating = text('.rating','.score','.imdb','.star','[itemprop="ratingValue"]','.rate','.film-rate','.kkrating')
      const duration = text('.duration','.runtime','.time','[itemprop="duration"]','.meta-runtime','.film-duration','span.runtime')
      const director = text('.director','[itemprop="director"]','.director a','.movie-director','.film-director','.info-director','[class*="director"]')
      const description = text('[itemprop="description"]','.description','.synopsis','.plot','.movie-description','.film-description','.content','p.desc','.detail-content p')
      const cast = Array.from(
        document.querySelectorAll('[itemprop="actor"], .cast a, .actors a, .actor a, .list-actor a, .movie-cast a, .film-cast a'),
      ).slice(0, 10).map((el) => (el as HTMLElement).innerText?.trim()).filter(Boolean).join(', ')
      const poster =
        document.querySelector<HTMLImageElement>('[itemprop="image"] img, .poster img, .thumb img, .film-poster img, .movie-poster img')?.src ||
        document.querySelector<HTMLImageElement>('img.poster, img.thumb, img[class*="poster"]')?.src

      // ── D: JWPlayer JS API ────────────────────────────────────────────────
      interface JWPlayer {
        getConfig(): Record<string, unknown>
        getDuration(): number
        getCaptionsList(): { label: string; id: number }[]
      }
      interface WindowWithJW extends Window {
        jwplayer?: (id?: string) => JWPlayer
      }
      let jwVideoUrl: string | undefined
      let jwDuration: string | undefined
      let jwSubtitles: string[] = []
      try {
        const jw = (window as WindowWithJW).jwplayer
        if (typeof jw === 'function') {
          const player = jw()
          const config  = player.getConfig()

          // Source URL — could be nested in sources[] or playlist[0].sources[]
          type Source = { file?: string; src?: string }
          const sources: Source[] =
            (config.sources as Source[] | undefined) ||
            ((config.playlist as Record<string,unknown>[] | undefined)?.[0]?.sources as Source[] | undefined) ||
            []
          jwVideoUrl = sources.find((s) => s.file && !s.file.startsWith('blob:'))?.file ||
                       sources.find((s) => s.src  && !s.src.startsWith('blob:'))?.src

          // Duration via API
          const dur = player.getDuration()
          if (dur > 0) {
            const h = Math.floor(dur / 3600)
            const m = Math.floor((dur % 3600) / 60)
            const s = Math.floor(dur % 60)
            jwDuration = h > 0
              ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
              : `${m}:${String(s).padStart(2, '0')}`
          }

          // Caption / subtitle tracks
          jwSubtitles = player.getCaptionsList()
            .map((t) => t.label)
            .filter((l) => l && l.toLowerCase() !== 'off')
        }
      } catch { /* player not yet ready or not present */ }

      // Duration fallback: JWPlayer's visible timer (e.g. "1:10:56")
      const playerDuration =
        jwDuration ||
        (document.querySelector('.jw-text-duration') as HTMLElement | null)?.innerText?.trim() ||
        duration

      // Subtitle fallback: caption button labels in the settings panel
      if (!jwSubtitles.length) {
        jwSubtitles = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[id*="submenu-captions"] button[aria-label]'),
        )
          .map((el) => el.getAttribute('aria-label') || '')
          .filter((l) => l && l !== 'Off' && l !== 'Subtitle Settings')
      }

      return {
        title:       String(jld['name'] ?? title ?? ogTitle ?? ''),
        year:        String(jld['dateCreated'] ?? year ?? ''),
        rating:      String((jld['aggregateRating'] as Record<string,unknown> | undefined)?.['ratingValue'] ?? rating ?? ''),
        duration:    playerDuration || '',
        director:    String((jld['director'] as Record<string,unknown> | undefined)?.['name'] ?? director ?? ''),
        description: String(jld['description'] ?? description ?? ogDesc ?? metaDesc ?? ''),
        cast,
        poster:      String((jld['image'] as Record<string,unknown> | undefined)?.['url'] ?? poster ?? ogImg ?? ''),
        jwVideoUrl,
        subtitles:   jwSubtitles.join(', ') || '',
      }
    })

    return {
      title:       data.title       || movie.title,
      url:         movie.url,
      category:    movie.category,
      year:        data.year        || undefined,
      rating:      data.rating      || undefined,
      duration:    data.duration    || undefined,
      director:    data.director    || undefined,
      description: data.description || undefined,
      cast:        data.cast        || undefined,
      poster:      data.poster      || undefined,
      videoUrl:    data.jwVideoUrl  || videoUrl || undefined,
      subtitles:   data.subtitles   || undefined,
    }
  } catch (err) {
    onLog(`  ⚠ Detail failed for "${movie.title}": ${err instanceof Error ? err.message : err}`)
    return movie
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function toCsv(movies: MovieData[]): string {
  const headers = ['Title','Category','Year','Rating','Duration','Director','Cast','Description','URL','Poster','VideoURL','Subtitles']
  const esc     = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows    = movies.map((m) =>
    [m.title,m.category,m.year,m.rating,m.duration,m.director,m.cast,m.description,m.url,m.poster,m.videoUrl,m.subtitles].map(esc).join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveResults(
  movies: MovieData[], config: ScraperConfig, onLog: LogCallback,
): Promise<ScraperResult> {
  const { outputDir, exportJson = true, exportExcel = true, exportCsv = true } = config
  await fs.mkdir(outputDir, { recursive: true })
  const stamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
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
    wb.creator  = 'MovieScraping'; wb.created = new Date()
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
      { header: 'Poster',      key: 'poster',      width: 60 },
      { header: 'Video URL',   key: 'videoUrl',    width: 80 },
      { header: 'Subtitles',   key: 'subtitles',   width: 40 },
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runScraper(
  config:       ScraperConfig,
  onProgress:   ProgressCallback,
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
      onLog(`  "${cat.name}": ${items.length} movies`)
      if (delayMs > 0) await sleep(delayMs)
    }
    onProgress({ step: 2, label: 'Movie List', current: categories.length, total: categories.length, message: `${allItems.length} movies collected` })
    controller.throwIfAborted()

    // Deduplicate by URL
    const unique = Array.from(new Map(allItems.map((m) => [m.url, m])).values())
    onLog(`Step 2 › ${unique.length} unique movie URLs collected.`)

    // ── Step 3 ───────────────────────────────────────────────────────────────
    const details: MovieData[] = []
    for (let i = 0; i < unique.length; i++) {
      controller.throwIfAborted()
      await controller.checkPause(onLog)
      const movie = unique[i]
      onProgress({ step: 3, label: 'Detail Pages', current: i, total: unique.length, message: `"${movie.title}"` })
      const detail = await scrapeMovieDetail(page, movie, onLog)
      details.push(detail)
      onMovieBatch([detail])
      if (delayMs > 0) await sleep(delayMs)
    }
    onProgress({ step: 3, label: 'Detail Pages', current: details.length, total: unique.length, message: 'All details scraped' })

    // ── Save ─────────────────────────────────────────────────────────────────
    onLog(`Saving ${details.length} movies…`)
    return await saveResults(details, config, onLog)
  } finally {
    await browser.close()
  }
}
