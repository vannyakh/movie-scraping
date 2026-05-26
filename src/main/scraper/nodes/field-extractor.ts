import type { Page } from 'playwright'
import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

type ActionType = 'click' | 'type' | 'wait' | 'scroll' | 'hover' | 'select' | 'screenshot'

interface BrowserAction {
  id:        string
  type:      ActionType
  selector?: string
  value?:    string
}

interface FieldDef {
  id:        string
  label:     string
  selector:  string
  attrName?: string
  type?:     'text' | 'attr' | 'html'
}

interface FieldExtractorData {
  fields?:        FieldDef[]
  urlField?:      string
  headless?:      boolean
  delayMs?:       number
  cookies?:       string
  proxyOverride?: string
  proxyUrl?:      string
  actions?:       BrowserAction[]
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function runActions(page: Page, actions: BrowserAction[], onLog: (msg: string) => void): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await page.click(action.selector, { timeout: 10_000 }).catch(() => {
              onLog(`field-extractor: click "${action.selector}" — not found, skipping`)
            })
          }
          break

        case 'hover':
          if (action.selector) {
            await page.hover(action.selector, { timeout: 10_000 }).catch(() => undefined)
          }
          break

        case 'type':
          if (action.selector && action.value !== undefined) {
            await page.fill(action.selector, action.value, { timeout: 10_000 }).catch(() => {
              onLog(`field-extractor: fill "${action.selector}" — not found, skipping`)
            })
          }
          break

        case 'select':
          if (action.selector && action.value !== undefined) {
            await page.selectOption(action.selector, action.value, { timeout: 10_000 }).catch(() => undefined)
          }
          break

        case 'wait': {
          const ms = parseInt(action.value ?? '1000', 10) || 1000
          await sleep(ms)
          break
        }

        case 'scroll': {
          if (action.selector) {
            await page.evaluate((sel) => {
              document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, action.selector).catch(() => undefined)
          } else {
            const px = action.value?.toLowerCase() === 'bottom'
              ? 999_999
              : (parseInt(action.value ?? '500', 10) || 500)
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), px)
          }
          break
        }

        case 'screenshot':
          await page.screenshot({ path: `field-extractor-${Date.now()}.png` }).catch(() => undefined)
          break
      }
    } catch (err) {
      onLog(`field-extractor: action [${action.type}] error — ${err}`)
    }
  }
}

export async function executeFieldExtractor(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx:    EngineContext,
): Promise<DataRecord[]> {
  const d = config as FieldExtractorData

  if (!inputs.length) { ctx.onLog('field-extractor: no inputs'); return [] }

  const fields   = (d.fields ?? []).filter((f) => f.selector.trim())
  const urlField = d.urlField?.trim() || '_url'
  const delayMs  = d.delayMs ?? 0
  const actions  = d.actions ?? []
  const { page, onLog, onProgress } = ctx

  if (!fields.length) {
    onLog('field-extractor: no fields configured — passing through inputs')
    return inputs
  }

  if (!page) {
    onLog('field-extractor: browser not available — returning inputs as-is')
    return inputs
  }

  // Apply per-node cookies (override global cookies for this node's pages)
  const nodeCookies = d.cookies?.trim()
  if (nodeCookies) {
    const seedUrl = (inputs[0]?.[urlField] as string | undefined) ?? 'http://localhost'
    try {
      const pairs = nodeCookies.split(';').map((s) => {
        const [name, ...rest] = s.trim().split('=')
        return { name: name.trim(), value: rest.join('=').trim(), url: seedUrl }
      }).filter((c) => c.name)
      if (pairs.length) {
        await page.context().addCookies(pairs)
        onLog(`field-extractor: ${pairs.length} node cookie${pairs.length !== 1 ? 's' : ''} applied`)
      }
    } catch {
      onLog('field-extractor: warning — could not set node cookies')
    }
  }

  const results: DataRecord[] = []

  for (let i = 0; i < inputs.length; i++) {
    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(onLog)

    const input = inputs[i]
    const url   = input[urlField] as string | undefined
    if (!url) { results.push(input); continue }

    onProgress(1, inputs.length, i, inputs.length, `Extracting (${i + 1}/${inputs.length}): ${url}`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // Run per-page actions before extracting fields
      if (actions.length > 0) await runActions(page, actions, onLog)

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
