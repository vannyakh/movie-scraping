import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface AIExtractorData {
  instruction?: string
  fields?:      Array<{ id: string; label: string }>
  inputField?:  string
  model?:       string
}

async function callOpenAI(
  apiKey:      string,
  model:       string,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`)
  const json = await res.json() as { choices: Array<{ message: { content: string } }> }
  return json.choices[0]?.message?.content ?? '{}'
}

async function callAnthropic(
  apiKey:      string,
  model:       string,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`)
  const json = await res.json() as { content: Array<{ text: string }> }
  return json.content[0]?.text ?? '{}'
}

export async function executeAIExtractor(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as AIExtractorData

  if (!inputs.length) { ctx.onLog('ai-extractor: no inputs'); return [] }

  if (!ctx.aiApiKey || !ctx.aiProvider || ctx.aiProvider === 'none') {
    ctx.onLog('ai-extractor: no AI API key — skipping')
    return inputs
  }

  const instruction = d.instruction?.trim() || 'Extract the main content from this page'
  const inputField  = d.inputField?.trim()  || '_html'
  const model       = d.model ?? 'gpt-4o-mini'
  const fields      = d.fields ?? []

  const fieldList = fields.length
    ? `Return a JSON object with these fields:\n${fields.map((f) => `- ${f.id}: ${f.label}`).join('\n')}`
    : 'Return a JSON object with the extracted data.'

  const systemPrompt = `You are a data extraction assistant. Extract structured data from web page content.
${fieldList}
Return only valid JSON, no markdown.`

  const results: DataRecord[] = []

  for (let i = 0; i < inputs.length; i++) {
    ctx.controller.throwIfAborted()
    await ctx.controller.checkPause(ctx.onLog)

    const input = inputs[i]
    const content = input[inputField] as string | undefined
    if (!content) { results.push(input); continue }

    ctx.onProgress(1, inputs.length, i, inputs.length, `AI extracting (${i + 1}/${inputs.length})…`)
    ctx.onLog(`ai-extractor: processing item ${i + 1}/${inputs.length}`)

    try {
      const truncated = content.slice(0, 8000)
      const userContent = `${instruction}\n\nContent:\n${truncated}`

      let rawJson: string
      if (ctx.aiProvider === 'anthropic') {
        rawJson = await callAnthropic(ctx.aiApiKey!, model, systemPrompt, userContent)
      } else {
        rawJson = await callOpenAI(ctx.aiApiKey!, model, systemPrompt, userContent)
      }

      const extracted = JSON.parse(rawJson) as Record<string, unknown>
      results.push({ ...input, ...extracted, _ai: true })
    } catch (err) {
      ctx.onLog(`ai-extractor: error: ${err}`)
      results.push({ ...input, _aiError: String(err) })
    }
  }

  ctx.onLog(`ai-extractor: ${results.length} records processed`)
  return results
}
