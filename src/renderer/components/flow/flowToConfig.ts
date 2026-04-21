import type { Node } from '@xyflow/react'
import type { ScraperConfig } from '../../../lib/ipc'
import { DEFAULT_DETAIL_FIELDS } from './nodes'
import type { SourceData, CategoryData, MovieListData, DetailData, ExportData } from './nodes'

export function flowToConfig(nodes: Node[]): ScraperConfig | null {
  const src = nodes.find(n => n.type === 'source')
  const exp = nodes.find(n => n.type === 'export')
  if (!src || !exp) return null

  const sd = src.data as unknown as SourceData
  const ed = exp.data as unknown as ExportData
  if (!sd.baseUrl?.trim())   return null
  if (!ed.outputDir?.trim()) return null

  const cat = nodes.find(n => n.type === 'category')
  const lst = nodes.find(n => n.type === 'movieList')
  const det = nodes.find(n => n.type === 'detail')

  const sels: ScraperConfig['selectors'] = {}
  let hasSel = false

  if (cat) {
    const c = cat.data as unknown as CategoryData
    if (c.selector.trim()) { sels.categories = c.selector.trim(); hasSel = true }
  }

  if (lst) {
    const l = lst.data as unknown as MovieListData
    if (l.movieSelector.trim())    { sels.movieList = l.movieSelector.trim();    hasSel = true }
    if (l.nextPageSelector.trim()) { sels.nextPage  = l.nextPageSelector.trim(); hasSel = true }
  }

  if (det) {
    const d = det.data as unknown as DetailData
    const fields = d.fields ?? DEFAULT_DETAIL_FIELDS
    const detSels: NonNullable<ScraperConfig['selectors']>['detail'] = {}
    let hasDet = false
    const KNOWN = ['title', 'year', 'rating', 'duration', 'director', 'description', 'cast', 'poster'] as const
    for (const f of fields) {
      if (f.selector.trim() && (KNOWN as readonly string[]).includes(f.id)) {
        (detSels as Record<string, string>)[f.id] = f.selector.trim()
        hasDet = true
      }
    }
    if (hasDet) { sels.detail = detSels; hasSel = true }
  }

  const ld = lst?.data as unknown as MovieListData | undefined

  return {
    baseUrl:              sd.baseUrl.trim(),
    outputDir:            ed.outputDir.trim(),
    headless:             sd.headless,
    delayMs:              sd.delayMs ?? 500,
    userAgent:            sd.userAgent?.trim() || undefined,
    maxMoviesPerCategory: ld?.maxMovies  || undefined,
    maxPagesPerCategory:  ld?.maxPages   || undefined,
    exportJson:           ed.exportJson,
    exportExcel:          ed.exportExcel,
    exportCsv:            ed.exportCsv,
    selectors:            hasSel ? sels : undefined,
  }
}

/** Returns true when the node graph has the minimum required configuration to run. */
export function isFlowValid(nodes: Node[]): boolean {
  return flowToConfig(nodes) !== null
}
