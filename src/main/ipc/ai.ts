import { ipcMain } from 'electron'
import { readEngineSettings } from './settings-bridge'

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

// ─── HTML → selector analysis ─────────────────────────────────────────────────

const SELECTOR_SYSTEM_PROMPT = `You are a CSS selector expert. Your job is to analyze HTML snippets and produce the best CSS selectors to extract specific fields.

Rules:
- Prefer class/id selectors over positional/nth-child selectors when possible
- For links: return the <a> element selector (the caller will extract href)
- For images: return the <img> element selector (the caller will extract src)
- Selectors must be valid CSS — no XPath, no custom syntax
- If you cannot find a match, return ""
- For list pages, also identify the repeating "item" selector and pagination

Return ONLY valid JSON (no markdown, no prose):
{
  "selectors": { "fieldId": "cssSelector", ... },
  "itemSelector": "CSS selector for each repeating item card/row (for list pages)",
  "paginationType": "next-button" | "url-pattern" | "none",
  "nextPageSelector": "CSS selector for the next-page link/button",
  "urlPattern": "https://example.com/page/{page}/"
}`

export interface SelectorSuggestions {
  selectors:        Record<string, string>
  itemSelector?:    string
  paginationType?:  string
  nextPageSelector?: string
  urlPattern?:      string
}

async function analyzeHtmlForSelectors(
  provider: string,
  apiKey: string,
  model: string,
  html: string,
  fields: Array<{ id: string; label: string; type?: string }>,
  pageUrl?: string,
): Promise<SelectorSuggestions> {
  const fieldList = fields.map((f) => `- ${f.id}: "${f.label}"${f.type ? ` (type: ${f.type})` : ''}`).join('\n')
  const prompt = [
    pageUrl ? `Page URL: ${pageUrl}` : '',
    'HTML snippet:',
    '```html',
    html.slice(0, 12_000),   // cap to avoid token overflow
    '```',
    '',
    'Fields to extract:',
    fieldList,
    '',
    'Analyze the HTML and return CSS selectors for each field plus list-page metadata.',
  ].filter(Boolean).join('\n')

  // Use a special system prompt just for selector analysis
  let rawResponse: string
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':  apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SELECTOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
    const json = await res.json() as { content: Array<{ text: string }> }
    rawResponse = json.content[0]?.text ?? '{}'
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SELECTOR_SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1024,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
    const json = await res.json() as { choices: Array<{ message: { content: string } }> }
    rawResponse = json.choices[0]?.message?.content ?? '{}'
  }

  const clean  = extractJson(rawResponse)
  const parsed = JSON.parse(clean) as SelectorSuggestions
  return {
    selectors:        parsed.selectors        ?? {},
    itemSelector:     parsed.itemSelector     ?? undefined,
    paginationType:   parsed.paginationType   ?? undefined,
    nextPageSelector: parsed.nextPageSelector ?? undefined,
    urlPattern:       parsed.urlPattern       ?? undefined,
  }
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

  ipcMain.handle('ai:analyzeSelectors', async (
    _event,
    html: string,
    fields: Array<{ id: string; label: string; type?: string }>,
    pageUrl?: string,
  ) => {
    try {
      const cfg = await readEngineSettings()
      if (!cfg?.ai) {
        return { __error: 'auth', message: 'AI not configured. Add an API key in Settings → AI.' }
      }
      const result = await analyzeHtmlForSelectors(cfg.ai.provider, cfg.ai.apiKey, cfg.ai.model, html, fields, pageUrl)
      return result
    } catch (err) {
      console.error('ai:analyzeSelectors error:', err)
      return { __error: 'unknown', message: String(err) }
    }
  })

  ipcMain.handle('ai:generateWorkflow', async (_event, prompt: string) => {
    try {
      const cfg = await readEngineSettings()
      const ai  = cfg.ai
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
