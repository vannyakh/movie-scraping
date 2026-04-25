import { ipcMain } from 'electron'
import { useSettingsStore } from './settings-bridge'

const SYSTEM_PROMPT = `You are a workflow builder assistant for DataFlow — a visual web scraping platform.

Available node types and their EXACT config shapes (types are critical — follow them precisely):

- browser-source: { url: string, headless: boolean, userAgent: string, delayMs: number, cookies: string }
- http-source:    { url: string, method: "GET"|"POST", headers: string (JSON-encoded e.g. "{}"), body: string }
- api-source:     { url: string, method: "GET"|"POST", headers: string (JSON-encoded e.g. "{}"), body: string,
                    authType: "none"|"bearer"|"api-key", authValue: string, dataPath: string,
                    maxPages: number, pageParam: string }
- link-extractor: { selector: string (CSS), filterPattern: string, limit: number, textSelector: string }
- list-scraper:   { itemSelector: string (CSS), nextPageSelector: string, maxPages: number, maxItems: number }
- field-extractor:{ fields: [{id: string, label: string, selector: string, attrName: string, type: "text"|"attr"|"html"}],
                    urlField: string, headless: boolean, delayMs: number }
- ai-extractor:   { instruction: string, fields: [{id: string, label: string}], inputField: string, model: string }
- filter:         { conditions: [{id: string, field: string, operator: string, value: string}], logic: "AND"|"OR" }
- transform:      { renames: [{from: string, to: string}],
                    omit: string (COMMA-SEPARATED STRING like "field1,field2" — NOT an array),
                    computed: [{id: string, label: string, expression: string}] }
- file-export:    { outputDir: string, exportJson: boolean, exportExcel: boolean, exportCsv: boolean, filename: string }
- webhook:        { url: string, method: "POST"|"PUT"|"PATCH", headers: string (JSON-encoded e.g. "{}"), batchSize: number }

⚠️ TYPE RULES — violating these will crash the app:
- omit (transform node): MUST be a STRING like "unwanted,extra" — NEVER an array
- headers (http-source, api-source, webhook): MUST be a JSON-encoded STRING like "{}" or '{"Authorization":"Bearer sk-…"}' — NEVER an object
- maxPages, maxItems, limit, delayMs, batchSize: MUST be numbers — NEVER strings
- exportJson, exportExcel, exportCsv, headless: MUST be booleans — NEVER strings
- At least one of exportJson/exportExcel/exportCsv must be true in file-export

Rules:
- Always start with exactly one source node (browser-source, http-source, or api-source)
- Always end with exactly one output node (file-export or webhook)
- Connect nodes logically: source → extractors → transforms → output
- Use browser-source for JS-heavy / SPA sites, http-source for static HTML pages
- Return ONLY a valid JSON object — no markdown, no prose, no explanation:
  {
    "nodes": [{ "id": "string", "type": "string", "position": {"x": number, "y": number}, "data": {} }],
    "edges": [{ "id": "string", "source": "string", "target": "string" }]
  }
- Position nodes left-to-right: source at x=40, then +340 for each step, y=120
- Use unique IDs like "browser-source-1", "link-extractor-1", etc.`

export type AIError = {
  __error: 'rate_limit' | 'auth' | 'model_not_found' | 'unknown'
  message: string
}

// ─── Extract the first JSON object from a possibly fenced response ─────────────
function extractJson(raw: string): string {
  // Strip markdown code fences
  let text = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  // Find outermost {...} boundaries in case the model added extra prose
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }
  return text
}

// ─── Read error body safely ───────────────────────────────────────────────────
async function readErrorBody(res: Response): Promise<string> {
  try { return await res.text() } catch { return '' }
}

// ─── Unified AI call ─────────────────────────────────────────────────────────
async function callAI(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const body = await readErrorBody(res)
      const err  = new Error(`Anthropic API error: ${res.status} – ${body.slice(0, 200)}`) as Error & { code?: string }
      if (res.status === 429) err.code = 'rate_limit'
      else if (res.status === 401) err.code = 'auth'
      else if (res.status === 404) err.code = 'model_not_found'
      throw err
    }

    const json = await res.json() as { content: Array<{ text: string }> }
    return json.content[0]?.text ?? '{}'
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const body = await readErrorBody(res)
    const err  = new Error(`OpenAI API error: ${res.status} – ${body.slice(0, 200)}`) as Error & { code?: string }
    if (res.status === 429) err.code = 'rate_limit'
    else if (res.status === 401) err.code = 'auth'
    else if (res.status === 404) err.code = 'model_not_found'
    throw err
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }> }
  return json.choices[0]?.message?.content ?? '{}'
}

// ─── Fetch available models from provider ─────────────────────────────────────
async function fetchProviderModels(provider: string, apiKey: string): Promise<string[]> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!res.ok) throw new Error(`Anthropic models API error: ${res.status}`)
    const json = await res.json() as { data: Array<{ id: string }> }
    return (json.data ?? [])
      .map((m) => m.id)
      .filter((id) => id.startsWith('claude'))
      .sort()
      .reverse()
  }

  // OpenAI
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenAI models API error: ${res.status}`)
  const json = await res.json() as { data: Array<{ id: string }> }
  return (json.data ?? [])
    .map((m) => m.id)
    .filter((id) =>
      (id.startsWith('gpt-4') || id.startsWith('gpt-3.5')) &&
      !id.includes('instruct') &&
      !id.includes('vision') &&
      !id.includes('preview'),
    )
    .sort()
    .reverse()
}

// ─── IPC handler ─────────────────────────────────────────────────────────────
export function registerAIIpc(): void {
  ipcMain.handle('ai:fetchModels', async (_event, provider: string, apiKey: string) => {
    try {
      return await fetchProviderModels(provider, apiKey)
    } catch (err) {
      console.error('ai:fetchModels error:', err)
      return null
    }
  })

  ipcMain.handle('ai:generateWorkflow', async (_event, prompt: string) => {
    try {
      const ai = await useSettingsStore()
      if (!ai) {
        return {
          __error: 'auth',
          message: 'AI not configured. Open Settings → AI and add an API key.',
        } satisfies AIError
      }

      const rawJson = await callAI(ai.provider, ai.apiKey, ai.model, prompt)

      const clean = extractJson(rawJson)
      const parsed = JSON.parse(clean) as { nodes: unknown[]; edges: unknown[] }

      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error('AI returned invalid workflow structure')
      }

      return parsed
    } catch (err) {
      console.error('ai:generateWorkflow error:', err)
      const code = (err as { code?: string }).code
      if (code === 'rate_limit') {
        return {
          __error: 'rate_limit',
          message: 'Rate limit exceeded. Please wait a moment and try again.',
        } satisfies AIError
      }
      if (code === 'auth') {
        return {
          __error: 'auth',
          message: 'Invalid API key. Check your key in Settings → AI.',
        } satisfies AIError
      }
      if (code === 'model_not_found') {
        return {
          __error: 'model_not_found',
          message: 'Model not found (404). Open Settings → AI and select a different model.',
        } satisfies AIError
      }
      return {
        __error: 'unknown',
        message: 'AI generation failed. Please try again.',
      } satisfies AIError
    }
  })
}
