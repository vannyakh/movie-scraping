import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface HttpSourceData {
  url:     string
  method?: string
  headers?: string
  body?:   string
}

export async function executeHttpSource(
  config: Record<string, unknown>,
  _inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as unknown as HttpSourceData

  if (!d.url?.trim()) { ctx.onLog('http-source: no URL'); return [] }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }
  if (d.headers?.trim()) {
    try {
      Object.assign(headers, JSON.parse(d.headers))
    } catch { /* ignore */ }
  }

  ctx.onLog(`http-source: fetching ${d.url}`)
  ctx.onProgress(1, 1, 0, 1, `Fetching ${d.url}…`)

  const res = await fetch(d.url, {
    method:  d.method ?? 'GET',
    headers,
    body:    d.method === 'POST' ? d.body : undefined,
  })

  if (!res.ok) {
    const msg = `http-source: HTTP ${res.status} ${res.statusText}`
    ctx.onLog(msg)
    throw new Error(msg)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const html = await res.text()
  const isJson = contentType.includes('application/json')

  ctx.onLog(`http-source: got ${html.length} chars (${res.status})`)
  ctx.onProgress(1, 1, 1, 1, 'Fetched')

  if (isJson) {
    try {
      const data = JSON.parse(html)
      if (Array.isArray(data)) return data as DataRecord[]
      return [{ ...(data as Record<string, unknown>), _url: d.url }]
    } catch { /* fall through to HTML */ }
  }

  return [{ _url: d.url, _html: html, _status: res.status }]
}
