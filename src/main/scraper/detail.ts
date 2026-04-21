import type { Page, Request as PlaywrightRequest } from 'playwright'
import type { LogCallback, MovieData, ScraperConfig } from '@shared/ipc-types'
import { sleep } from './controller'
import { VIDEO_HINT_RE, VIDEO_PATH_RE, VIDEO_URL_RE } from './selectors'

export async function scrapeMovieDetail(
  page:   Page,
  movie:  { title: string; url: string; category: string },
  onLog:  LogCallback,
  config: ScraperConfig,
): Promise<MovieData> {
  try {
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

    await sleep(2000)
    page.off('request', onRequest)

    const videoUrl =
      capturedVideos.find((u) => u.includes('master') || u.includes('index.m3u8')) ||
      capturedVideos.find((u) => VIDEO_URL_RE.test(u)) ||
      capturedVideos[0]

    const customDetailSels = config.selectors?.detail ?? {}
    const data = await page.evaluate((cs) => {
      const text = (...sels: string[]) => {
        for (const sel of sels) {
          const el = document.querySelector(sel) as HTMLElement | null
          const t  = el?.innerText?.trim() || el?.getAttribute('content')?.trim()
          if (t) return t
        }
        return undefined
      }

      const ogTitle  = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim()
      const ogDesc   = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content?.trim()
      const ogImg    = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content?.trim()
      const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim()

      let jld: Record<string, unknown> = {}
      try {
        const script = document.querySelector('script[type="application/ld+json"]')
        if (script?.textContent) {
          const parsed = JSON.parse(script.textContent)
          jld = Array.isArray(parsed) ? parsed[0] : parsed
        }
      } catch { /* ignore */ }

      const title = cs.title
        ? text(cs.title, 'h1.title','h1.movie-title','h1.film-title','h1.entry-title','.detail-title h1','.info h1','#title','h1')
        : text('h1.title','h1.movie-title','h1.film-title','h1.entry-title','.detail-title h1','.info h1','#title','h1')
      const year = cs.year
        ? text(cs.year, '.year','.release-year','.meta-year','[itemprop="dateCreated"]','span.year','.film-info .year','.movie-year')
        : text('.year','.release-year','.meta-year','[itemprop="dateCreated"]','span.year','.film-info .year','.movie-info .year','.movie-year','.film-year','.info-year')
      const rating = cs.rating
        ? text(cs.rating, '.rating','.score','.imdb','.star','[itemprop="ratingValue"]','.rate','.film-rate','.kkrating')
        : text('.rating','.score','.imdb','.star','[itemprop="ratingValue"]','.rate','.film-rate','.kkrating')
      const duration = cs.duration
        ? text(cs.duration, '.duration','.runtime','.time','[itemprop="duration"]','.meta-runtime','.film-duration','span.runtime')
        : text('.duration','.runtime','.time','[itemprop="duration"]','.meta-runtime','.film-duration','span.runtime')
      const director = cs.director
        ? text(cs.director, '.director','[itemprop="director"]','.director a','.movie-director','.film-director','.info-director','[class*="director"]')
        : text('.director','[itemprop="director"]','.director a','.movie-director','.film-director','.info-director','[class*="director"]')
      const description = cs.description
        ? text(cs.description, '[itemprop="description"]','.description','.synopsis','.plot','.movie-description','.film-description','.content','p.desc','.detail-content p')
        : text('[itemprop="description"]','.description','.synopsis','.plot','.movie-description','.film-description','.content','p.desc','.detail-content p')
      const cast = cs.cast
        ? Array.from(document.querySelectorAll(cs.cast)).slice(0, 10).map((el) => (el as HTMLElement).innerText?.trim()).filter(Boolean).join(', ') ||
          Array.from(document.querySelectorAll('[itemprop="actor"], .cast a, .actors a, .actor a, .list-actor a, .movie-cast a, .film-cast a')).slice(0, 10).map((el) => (el as HTMLElement).innerText?.trim()).filter(Boolean).join(', ')
        : Array.from(
            document.querySelectorAll('[itemprop="actor"], .cast a, .actors a, .actor a, .list-actor a, .movie-cast a, .film-cast a'),
          ).slice(0, 10).map((el) => (el as HTMLElement).innerText?.trim()).filter(Boolean).join(', ')
      const poster = cs.poster
        ? document.querySelector<HTMLImageElement>(cs.poster)?.src ||
          document.querySelector<HTMLImageElement>('[itemprop="image"] img, .poster img, .thumb img, .film-poster img, .movie-poster img')?.src ||
          document.querySelector<HTMLImageElement>('img.poster, img.thumb, img[class*="poster"]')?.src
        : document.querySelector<HTMLImageElement>('[itemprop="image"] img, .poster img, .thumb img, .film-poster img, .movie-poster img')?.src ||
          document.querySelector<HTMLImageElement>('img.poster, img.thumb, img[class*="poster"]')?.src

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

          type Source = { file?: string; src?: string }
          const sources: Source[] =
            (config.sources as Source[] | undefined) ||
            ((config.playlist as Record<string,unknown>[] | undefined)?.[0]?.sources as Source[] | undefined) ||
            []
          jwVideoUrl = sources.find((s) => s.file && !s.file.startsWith('blob:'))?.file ||
                       sources.find((s) => s.src  && !s.src.startsWith('blob:'))?.src

          const dur = player.getDuration()
          if (dur > 0) {
            const h = Math.floor(dur / 3600)
            const m = Math.floor((dur % 3600) / 60)
            const s = Math.floor(dur % 60)
            jwDuration = h > 0
              ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
              : `${m}:${String(s).padStart(2, '0')}`
          }

          jwSubtitles = player.getCaptionsList()
            .map((t) => t.label)
            .filter((l) => l && l.toLowerCase() !== 'off')
        }
      } catch { /* player not yet ready or not present */ }

      const playerDuration =
        jwDuration ||
        (document.querySelector('.jw-text-duration') as HTMLElement | null)?.innerText?.trim() ||
        duration

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
    }, customDetailSels)

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
