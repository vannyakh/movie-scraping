import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface ApiSourceData {
  url:       string
  method?:   string
  headers?:  string
  body?:     string
  authType?: string
  authValue?: string
  dataPath?: string
  maxPages?: number
  pageParam?: string
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path.trim()) return obj
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export async function executeApiSource(
  config: Record<string, unknown>,
  _inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as unknown as ApiSourceData

  if (!d.url?.trim()) { ctx.onLog('api-source: no URL'); return [] }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (d.headers?.trim()) {
    try { Object.assign(headers, JSON.parse(d.headers)) } catch { /* ignore */ }
  }

  if (d.authType === 'bearer' && d.authValue) {
    headers['Authorization'] = `Bearer ${d.authValue}`
  } else if (d.authType === 'api-key' && d.authValue) {
    headers['X-API-Key'] = d.authValue
  }

  const maxPages = Math.max(1, d.maxPages ?? 1)
  const pageParam = d.pageParam ?? 'page'
  const allRecords: DataRecord[] = []

  for (let page = 1; page <= maxPages; page++) {
    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(ctx.onLog)

    const url = new URL(d.url)
    if (maxPages > 1) url.searchParams.set(pageParam, String(page))

    ctx.onLog(`api-source: GET ${url.toString()} (page ${page}/${maxPages})`)
    ctx.onProgress(1, maxPages, page - 1, maxPages, `Fetching page ${page}…`)

    const method = d.method ?? 'GET'
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? d.body : undefined,
    })

    if (!res.ok) {
      ctx.onLog(`api-source: HTTP ${res.status}`)
      break
    }

    const json: unknown = await res.json()
    const items = getNestedValue(json, d.dataPath ?? '')

    if (Array.isArray(items)) {
      allRecords.push(...(items as DataRecord[]))
      if (items.length === 0) break  // no more pages
    } else if (items && typeof items === 'object') {
      allRecords.push(items as DataRecord)
      break
    } else {
      allRecords.push({ _raw: json, _url: url.toString() })
      break
    }
  }

  ctx.onLog(`api-source: ${allRecords.length} records`)
  return allRecords
}
