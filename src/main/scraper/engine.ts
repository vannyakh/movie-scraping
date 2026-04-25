/**
 * Generic workflow engine.
 * Executes a DAG of node configs by topologically sorting them and running
 * each node's executor in order, passing outputs downstream.
 */

import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import type { DataRecord, WorkflowConfig, JobProgress, NodeStatus } from '@shared/ipc-types'

import { executeBrowserSource } from './nodes/browser-source'
import { executeHttpSource }    from './nodes/http-source'
import { executeApiSource }     from './nodes/api-source'
import { executeLinkExtractor } from './nodes/link-extractor'
import { executeListScraper }   from './nodes/list-scraper'
import { executeFieldExtractor } from './nodes/field-extractor'
import { executeAIExtractor }   from './nodes/ai-extractor'
import { executeFilter }        from './nodes/filter'
import { executeTransform }     from './nodes/transform'
import { executeFileExport }    from './nodes/file-export'
import { executeWebhook }       from './nodes/webhook'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EngineContext {
  browser?:      Browser
  page?:         Page
  onLog:         (msg: string) => void
  onProgress:    (step: number, totalSteps: number, current: number, total: number, message: string, nodeId?: string) => void
  onBatch:       (records: DataRecord[]) => void
  onNodeStatus:  (status: NodeStatus) => void
  controller:    EngineController
  aiApiKey?:     string
  aiProvider?:   string
  aiModel?:      string
  globalCookies: string          // from Settings → Global Cookies
  proxyServer?:  string          // from Settings → Proxy (applied at browser launch)
}

export class EngineController {
  private _aborted = false
  private _paused  = false
  private _pauseResolvers: Array<() => void> = []

  get aborted() { return this._aborted }
  get paused()  { return this._paused  }

  abort()  { this._aborted = true; this._pauseResolvers.forEach((r) => r()) }
  pause()  { this._paused  = true  }
  resume() {
    this._paused = false
    this._pauseResolvers.forEach((r) => r())
    this._pauseResolvers = []
  }

  throwIfAborted() {
    if (this._aborted) throw new Error('ABORTED')
  }

  async checkPause(onLog?: (msg: string) => void) {
    if (!this._paused) return
    onLog?.('⏸ Paused…')
    await new Promise<void>((resolve) => { this._pauseResolvers.push(resolve) })
    onLog?.('▶ Resumed.')
  }
}

// ─── Browser needs ────────────────────────────────────────────────────────────

const BROWSER_TYPES = new Set(['browser-source', 'link-extractor', 'list-scraper', 'field-extractor'])

function needsBrowser(nodeTypes: string[]): boolean {
  return nodeTypes.some((t) => BROWSER_TYPES.has(t))
}

// ─── Topological sort ─────────────────────────────────────────────────────────

function topoSort(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): string[] {
  const inDegree  = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adjacency.set(n.id, [])
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue  = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const result: string[] = []

  while (queue.length) {
    const id = queue.shift()!
    result.push(id)
    for (const next of adjacency.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, d)
      if (d === 0) queue.push(next)
    }
  }

  return result
}

// ─── Node executor map ────────────────────────────────────────────────────────

type ExecutorFn = (
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
) => Promise<DataRecord[]>

const EXECUTORS: Record<string, ExecutorFn> = {
  'browser-source':  executeBrowserSource,
  'http-source':     executeHttpSource,
  'api-source':      executeApiSource,
  'link-extractor':  executeLinkExtractor,
  'list-scraper':    executeListScraper,
  'field-extractor': executeFieldExtractor,
  'ai-extractor':    executeAIExtractor,
  'filter':          executeFilter,
  'transform':       executeTransform,
  'file-export':     executeFileExport,
  'webhook':         executeWebhook,
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface RunResult {
  records:      DataRecord[]
  totalRecords: number
  outputPaths?: Record<string, string>
}

export async function runWorkflow(
  config:       WorkflowConfig,
  onProgress:   (p: JobProgress) => void,
  onLog:        (msg: string) => void,
  onBatch:      (records: DataRecord[]) => void,
  onNodeStatus: (s: NodeStatus) => void,
  controller:   EngineController,
  settings?:    {
    ai?:          { provider: string; apiKey: string; model: string }
    proxy?:       { server: string; bypass: string }
    globalCookies: string
  },
): Promise<RunResult> {
  const aiConfig     = settings?.ai
  const proxyConfig  = settings?.proxy
  const globalCookies = settings?.globalCookies ?? ''
  const { nodes, edges } = config

  // ── Build execution order ──────────────────────────────────────────────────
  const order       = topoSort(nodes, edges)
  const nodeMap     = new Map(nodes.map((n) => [n.id, n]))
  const nodeOutputs = new Map<string, DataRecord[]>()
  const totalSteps  = order.length

  // ── Figure out if we need Playwright ──────────────────────────────────────
  const nodeTypes = nodes.map((n) => n.type)
  let browser: Browser | undefined
  let ctx_page:  Page | undefined

  const makeProgress = (step: number, current: number, total: number, message: string, nodeId?: string): JobProgress => ({
    step, totalSteps, message, current, total, nodeId,
  })

  onLog('Starting workflow…')

  try {
    if (needsBrowser(nodeTypes)) {
      onLog('Launching browser…')
      // Use config from first browser-source node if present
      const bsNode    = nodes.find((n) => n.type === 'browser-source')
      const headless  = bsNode ? !!(bsNode.data.headless ?? true) : true
      const userAgent = bsNode ? (bsNode.data.userAgent as string | undefined) : undefined

      const launchOpts: Parameters<typeof chromium.launch>[0] = { headless }
      if (proxyConfig) {
        launchOpts.proxy = { server: proxyConfig.server, bypass: proxyConfig.bypass }
        onLog(`Proxy: ${proxyConfig.server}`)
      }
      browser = await chromium.launch(launchOpts)

      const ctxOpts: Parameters<Browser['newContext']>[0] = {
        viewport: { width: 1280, height: 900 },
        ...(userAgent ? { userAgent } : {}),
      }
      const browserCtx: BrowserContext = await browser.newContext(ctxOpts)

      // Apply global cookies if configured
      if (globalCookies.trim()) {
        try {
          // We need at least one URL to set cookies — parse from first browser-source node
          const seedUrl = bsNode?.data.url as string | undefined ?? 'http://localhost'
          const pairs = globalCookies.split(';').map((s) => {
            const [name, ...rest] = s.trim().split('=')
            return { name: name.trim(), value: rest.join('=').trim(), url: seedUrl }
          }).filter((c) => c.name)
          if (pairs.length) {
            await browserCtx.addCookies(pairs)
            onLog(`Global cookies: ${pairs.length} cookie${pairs.length !== 1 ? 's' : ''} applied`)
          }
        } catch {
          onLog('Warning: could not set global cookies')
        }
      }

      ctx_page = await browserCtx.newPage()
      ctx_page.setDefaultTimeout(30_000)
      onLog('Browser ready.')
    }

    const engineCtx: EngineContext = {
      browser,
      page:          ctx_page,
      onLog,
      onProgress:    (step, _totalSteps, current, total, message, nodeId) =>
        onProgress(makeProgress(step, current, total, message, nodeId)),
      onBatch,
      onNodeStatus,
      controller,
      aiApiKey:      aiConfig?.apiKey,
      aiProvider:    aiConfig?.provider,
      aiModel:       aiConfig?.model,
      globalCookies,
      proxyServer:   proxyConfig?.server,
    }

    let outputPaths: Record<string, string> | undefined
    let stepIndex = 0

    for (const nodeId of order) {
      controller.throwIfAborted()
      await controller.checkPause(onLog)

      const node     = nodeMap.get(nodeId)
      if (!node) continue

      const executor = EXECUTORS[node.type]
      if (!executor) {
        onLog(`⚠ Unknown node type "${node.type}" — skipping.`)
        nodeOutputs.set(nodeId, [])
        continue
      }

      stepIndex++

      // Gather inputs from all upstream nodes
      const upstreamEdges = edges.filter((e) => e.target === nodeId)
      const inputs: DataRecord[] = upstreamEdges.flatMap((e) => nodeOutputs.get(e.source) ?? [])

      onLog(`▶ [${stepIndex}/${totalSteps}] ${node.type} (${nodeId})`)
      onNodeStatus({ nodeId, status: 'running', startedAt: new Date().toISOString() })
      onProgress(makeProgress(stepIndex, 0, inputs.length || 1, `Running ${node.type}…`, nodeId))

      try {
        const output = await executor(node.data, inputs, engineCtx)
        nodeOutputs.set(nodeId, output)

        onNodeStatus({
          nodeId, status: 'success',
          recordCount: output.length,
          completedAt: new Date().toISOString(),
        })
        onLog(`✓ ${node.type}: ${output.length} records`)

        // If this is a file-export node, capture outputPaths
        if (node.type === 'file-export' && output.length > 0) {
          const paths = output[0]._outputPaths as Record<string, string> | undefined
          if (paths) outputPaths = paths
        }

        // Stream batches from extractors
        if (['field-extractor', 'list-scraper', 'ai-extractor'].includes(node.type)) {
          onBatch(output)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message === 'ABORTED') throw err
        onLog(`✕ ${node.type} failed: ${message}`)
        onNodeStatus({ nodeId, status: 'failed', error: message, completedAt: new Date().toISOString() })
        nodeOutputs.set(nodeId, [])
      }

      controller.throwIfAborted()
    }

    // Collect all leaf node outputs as final records
    const leafNodeIds = nodes
      .filter((n) => !edges.some((e) => e.source === n.id))
      .map((n) => n.id)

    const allRecords = leafNodeIds.flatMap((id) => nodeOutputs.get(id) ?? [])
    const dataRecords = allRecords.filter((r) => !r._outputPaths)

    onLog(`Workflow complete. ${dataRecords.length} records total.`)

    return {
      records:     dataRecords,
      totalRecords: dataRecords.length,
      outputPaths,
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
