import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface WebhookData {
  url?:       string
  method?:    string
  headers?:   string
  batchSize?: number
}

export async function executeWebhook(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as WebhookData

  if (!d.url?.trim()) { ctx.onLog('webhook: no URL — skipping'); return [] }
  if (!inputs.length)  { ctx.onLog('webhook: no records');        return [] }

  const batchSize = Math.max(1, d.batchSize ?? 100)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (d.headers?.trim()) {
    try { Object.assign(headers, JSON.parse(d.headers)) } catch { /* ignore */ }
  }

  const batches = Math.ceil(inputs.length / batchSize)
  let sent = 0

  for (let b = 0; b < batches; b++) {
    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(ctx.onLog)

    const batch = inputs.slice(b * batchSize, (b + 1) * batchSize)
    ctx.onLog(`webhook: sending batch ${b + 1}/${batches} (${batch.length} records)`)
    ctx.onProgress(1, batches, b, batches, `Sending batch ${b + 1}/${batches}…`)

    try {
      const res = await fetch(d.url, {
        method:  d.method ?? 'POST',
        headers,
        body:    JSON.stringify(batch),
      })
      if (!res.ok) ctx.onLog(`webhook: batch ${b + 1} returned HTTP ${res.status}`)
      else sent += batch.length
    } catch (err) {
      ctx.onLog(`webhook: batch ${b + 1} failed: ${err}`)
    }
  }

  ctx.onLog(`webhook: sent ${sent}/${inputs.length} records`)
  return [{ _sent: sent, _total: inputs.length, _url: d.url }]
}
