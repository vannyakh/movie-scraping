import { ipcMain } from 'electron'
import { useSettingsStore } from './settings-bridge'

const SYSTEM_PROMPT = `You are a workflow builder assistant for DataFlow — a visual web scraping platform.

Available node types:
- browser-source: Launch Chromium, navigate to URL. Config: { url, headless, userAgent, delayMs }
- http-source: Fetch a URL via HTTP. Config: { url, method, headers }
- api-source: Call a REST API with pagination. Config: { url, method, headers, authType, authValue, dataPath, maxPages, pageParam }
- link-extractor: Extract links from a page using CSS selector. Config: { selector, filterPattern, limit }
- list-scraper: Navigate and paginate through a list page. Config: { itemSelector, nextPageSelector, maxPages, maxItems }
- field-extractor: Navigate to each URL and extract fields by CSS selector. Config: { fields: [{id, label, selector, type}], urlField, headless, delayMs }
- ai-extractor: Use AI to extract structured data. Config: { instruction, fields: [{id, label}], inputField, model }
- filter: Filter records by conditions. Config: { conditions: [{id, field, operator, value}], logic }
- transform: Rename, omit, or compute fields. Config: { renames: [{from, to}], omit, computed: [{id, label, expression}] }
- file-export: Save to JSON/CSV/Excel. Config: { outputDir, exportJson, exportExcel, exportCsv, filename }
- webhook: POST records to a URL. Config: { url, method, headers, batchSize }

Rules:
- Always start with a source node (browser-source, http-source, or api-source)
- Always end with an output node (file-export or webhook)
- Connect nodes logically (source → extractors → transforms → output)
- Use browser-source for JS-heavy sites, http-source for static HTML
- Return ONLY a valid JSON object with this exact structure:
  {
    "nodes": [{ "id": "string", "type": "string", "position": {"x": number, "y": number}, "data": {} }],
    "edges": [{ "id": "string", "source": "string", "target": "string" }]
  }
- Position nodes left-to-right: source at x=40, then +340 for each step, y=120
- Use unique IDs like "browser-source-1", "link-extractor-1", etc.`

async function callAI(provider: string, apiKey: string, model: string, prompt: string): Promise<string> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
    const json = await res.json() as { content: Array<{ text: string }> }
    return json.content[0]?.text ?? '{}'
  }

  // Default: OpenAI
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const json = await res.json() as { choices: Array<{ message: { content: string } }> }
  return json.choices[0]?.message?.content ?? '{}'
}

export function registerAIIpc(): void {
  ipcMain.handle('ai:generateWorkflow', async (_event, prompt: string) => {
    try {
      const ai = await useSettingsStore()
      if (!ai) return null

      const rawJson = await callAI(ai.provider, ai.apiKey, ai.model, prompt)

      // Extract JSON from possible markdown fences
      const clean = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      return JSON.parse(clean) as { nodes: unknown[]; edges: unknown[] }
    } catch (err) {
      console.error('ai:generateWorkflow error:', err)
      return null
    }
  })
}
