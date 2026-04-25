import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface FieldDef {
  id:       string
  label:    string
  selector: string
  attrName?: string
  type?:    'text' | 'attr' | 'html'
}

interface FieldExtractorData {
  fields?:   FieldDef[]
  urlField?: string
  headless?: boolean
  delayMs?:  number
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function executeFieldExtractor(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as FieldExtractorData

  if (!inputs.length) { ctx.onLog('field-extractor: no inputs'); return [] }

  const fields    = (d.fields ?? []).filter((f) => f.selector.trim())
  const urlField  = d.urlField?.trim() || '_url'
  const delayMs   = d.delayMs ?? 0
  const { page, onLog, onProgress } = ctx

  if (!fields.length) {
    onLog('field-extractor: no fields configured — passing through inputs')
    return inputs
  }

  if (!page) {
    onLog('field-extractor: browser not available — returning inputs as-is')
    return inputs
  }

  const results: DataRecord[] = []

  for (let i = 0; i < inputs.length; i++) {
    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(onLog)

    const input  = inputs[i]
    const url    = input[urlField] as string | undefined
    if (!url) { results.push(input); continue }

    onProgress(1, inputs.length, i, inputs.length, `Extracting fields (${i + 1}/${inputs.length}): ${url}`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      const extracted = await page.evaluate((fieldDefs) => {
        const record: Record<string, string | null> = {}
        for (const f of fieldDefs) {
          try {
            const el = document.querySelector(f.selector)
            if (!el) { record[f.id] = null; continue }
            if (f.type === 'attr' && f.attrName) {
              record[f.id] = el.getAttribute(f.attrName)
            } else if (f.type === 'html') {
              record[f.id] = el.innerHTML
            } else {
              record[f.id] = el.textContent?.trim() ?? null
            }
          } catch {
            record[f.id] = null
          }
        }
        return record
      }, fields as FieldDef[])

      results.push({ ...input, ...extracted, _url: url })
    } catch (err) {
      onLog(`field-extractor: error on ${url}: ${err}`)
      results.push({ ...input, _error: String(err) })
    }

    if (delayMs > 0) await sleep(delayMs)
  }

  onLog(`field-extractor: ${results.length} records`)
  return results
}
