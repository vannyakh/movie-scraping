import type { Page } from 'playwright'
import type { LogCallback, ScraperConfig } from '@shared/ipc-types'
import type { ScrapeController } from './controller'
import { sleep } from './controller'
import {
  LIST_SELECTORS,
  MOVIE_URL_PATTERNS,
  NEXT_PAGE_SELECTORS,
  SKIP_URL_KEYWORDS,
} from './selectors'

export async function scrapeMovieList(
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

        const sels = customSel ? [customSel] : listSels
        for (const s of sels) {
          for (const el of Array.from(document.querySelectorAll<HTMLAnchorElement>(s))) add(el)
          if (out.length >= 3) break
        }
        if (out.length >= 3) return out

        for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img'))) {
          const parentA = img.closest<HTMLAnchorElement>('a[href]')
          if (parentA) { add(parentA); continue }
          const card = img.closest('li, div, article')
          if (!card) continue
          for (const a of Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'))) add(a)
        }
        if (out.length >= 3) return out

        for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
          const url = a.href
          if (!url.startsWith(origin)) continue
          const pathname = new URL(url).pathname.toLowerCase()
          if (moviePatterns.some((p) => pathname.includes(p))) add(a)
        }
        if (out.length >= 3) return out

        const skipKwLower = skipKw.map((k) => k.toLowerCase())
        const allInternal = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .filter((a) => {
            const url = a.href
            if (!url.startsWith(origin)) return false
            const low = url.toLowerCase()
            return !skipKwLower.some((k) => low.includes(k))
          })

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
