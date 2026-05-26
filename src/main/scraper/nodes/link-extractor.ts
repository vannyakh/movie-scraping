import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface LinkExtractorData {
  selector?:      string
  filterPattern?: string
  limit?:         number
  textSelector?:  string
}

export async function executeLinkExtractor(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as LinkExtractorData

  if (!inputs.length) { ctx.onLog('link-extractor: no inputs'); return [] }

  const selector     = d.selector?.trim()     || 'a[href]'
  const limit        = Math.max(1, d.limit ?? 200)
  const filterRegex  = d.filterPattern?.trim() ? new RegExp(d.filterPattern, 'i') : null
  const { page, onLog, onProgress } = ctx

  const allLinks: DataRecord[] = []

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const sourceUrl = input._url as string | undefined

    if (!sourceUrl) continue

    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(onLog)

    onProgress(1, inputs.length, i, inputs.length, `Extracting links from ${sourceUrl}…`)

    if (page) {
      // Navigate if the page isn't already at this URL
      try {
        const curUrl = page.url()
        if (!curUrl || curUrl === 'about:blank' || curUrl !== sourceUrl) {
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        }

        const delayMs = (input._delayMs as number | undefined) ?? 0
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))

        const links = await page.$$eval(
          selector,
          (els, { sourceUrl: src, textSel }) => {
            const results: Array<{ url: string; text: string }> = []
            for (const el of els) {
              const href = (el as HTMLAnchorElement).href
              const text = textSel
                ? el.querySelector(textSel)?.textContent?.trim() ?? el.textContent?.trim() ?? ''
                : el.textContent?.trim() ?? ''
              if (href && !href.startsWith('javascript:')) {
                results.push({ url: new URL(href, src).href, text })
              }
            }
            return results
          },
          { sourceUrl, textSel: d.textSelector || '' } as { sourceUrl: string; textSel: string },
        )

        for (const link of links) {
          if (filterRegex && !filterRegex.test(link.url)) continue
          allLinks.push({ ...link, _sourceUrl: sourceUrl })
          if (allLinks.length >= limit) break
        }
      } catch (err) {
        onLog(`link-extractor: error on ${sourceUrl}: ${err}`)
      }
    } else {
      // Fallback: try basic regex for <a href="..."> in _html
      const html = input._html as string | undefined
      if (!html) continue
      const RE = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
      let match: RegExpExecArray | null
      while ((match = RE.exec(html)) !== null) {
        const href = match[1]
        const text = match[2].replace(/<[^>]*>/g, '').trim()
        let url = href
        try { url = new URL(href, sourceUrl).href } catch { /* relative url */ }
        if (filterRegex && !filterRegex.test(url)) continue
        allLinks.push({ url, text, _sourceUrl: sourceUrl })
        if (allLinks.length >= limit) break
      }
    }

    if (allLinks.length >= limit) break
  }

  onLog(`link-extractor: ${allLinks.length} links found`)
  onProgress(1, 1, 1, 1, `${allLinks.length} links extracted`)
  return allLinks
}
