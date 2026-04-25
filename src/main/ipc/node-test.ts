/**
 * Partial-workflow test runner.
 * Runs the DAG from source nodes up to (and including) the target node,
 * streams logs, then returns the target node's output records (max 5).
 */
import { ipcMain }    from 'electron'
import { chromium }   from 'playwright'
import type { Browser } from 'playwright'
import type { DataRecord, WorkflowNodeConfig, WorkflowEdgeConfig } from '@shared/ipc-types'
import type { EngineContext } from '../scraper/engine'
import { EngineController }  from '../scraper/engine'
import { executeBrowserSource }  from '../scraper/nodes/browser-source'
import { executeHttpSource }     from '../scraper/nodes/http-source'
import { executeApiSource }      from '../scraper/nodes/api-source'
import { executeLinkExtractor }  from '../scraper/nodes/link-extractor'
import { executeListScraper }    from '../scraper/nodes/list-scraper'
import { executeFieldExtractor } from '../scraper/nodes/field-extractor'
import { executeAIExtractor }    from '../scraper/nodes/ai-extractor'
import { executeFilter }         from '../scraper/nodes/filter'
import { executeTransform }      from '../scraper/nodes/transform'
import { readEngineSettings }      from './settings-bridge'
import { getMainWindow }         from './context'

// ─── Test caps so runs finish quickly ─────────────────────────────────────────
const MAX_RECORDS = 5
const MAX_PAGES   = 1
const MAX_SCROLLS = 2

type ExecutorFn = (
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx:    EngineContext,
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
}

const BROWSER_NODES = new Set([
  'browser-source', 'link-extractor', 'list-scraper', 'field-extractor',
])

// ─── Graph helpers ────────────────────────────────────────────────────────────
function topoSort(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): string[] {
  const inDegree = new Map<string, number>()
  const adj      = new Map<string, string[]>()
  for (const n of nodes) { inDegree.set(n.id, 0); adj.set(n.id, []) }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }
  const queue  = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const result: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    result.push(id)
    for (const nxt of adj.get(id) ?? []) {
      const d = (inDegree.get(nxt) ?? 1) - 1
      inDegree.set(nxt, d)
      if (d === 0) queue.push(nxt)
    }
  }
  return result
}

/** All node IDs that are ancestors of (or equal to) targetId */
function ancestorsOf(
  targetId: string,
  edges:    Array<{ source: string; target: string }>,
  allIds:   Set<string>,
): Set<string> {
  const visited = new Set<string>([targetId])
  const queue   = [targetId]
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of edges) {
      if (e.target === cur && allIds.has(e.source) && !visited.has(e.source)) {
        visited.add(e.source)
        queue.push(e.source)
      }
    }
  }
  return visited
}

function capData(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    maxItems:   Math.min((data.maxItems   as number | undefined) ?? MAX_RECORDS, MAX_RECORDS),
    maxPages:   Math.min((data.maxPages   as number | undefined) ?? MAX_PAGES,   MAX_PAGES),
    maxScrolls: Math.min((data.maxScrolls as number | undefined) ?? MAX_SCROLLS, MAX_SCROLLS),
  }
}

// ─── Active controller ────────────────────────────────────────────────────────
let activeController: EngineController | null = null

async function runPartialWorkflow(
  targetNodeId: string,
  allNodes:     WorkflowNodeConfig[],
  allEdges:     WorkflowEdgeConfig[],
  send:         (msg: string) => void,
  controller:   EngineController,
): Promise<DataRecord[]> {
  // Build ancestor subgraph
  const allIds   = new Set(allNodes.map((n) => n.id))
  const subIds   = ancestorsOf(targetNodeId, allEdges, allIds)
  const subNodes = allNodes.filter((n) => subIds.has(n.id))
  const subEdges = allEdges.filter((e) => subIds.has(e.source) && subIds.has(e.target))
  const order    = topoSort(subNodes, subEdges)

  const targetNode = allNodes.find((n) => n.id === targetNodeId)
  if (!targetNode) throw new Error(`Target node "${targetNodeId}" not found in workflow`)

  const totalSteps = order.length
  send(`Chain: ${totalSteps} node${totalSteps !== 1 ? 's' : ''} → ${targetNode.type}`)
  send('─'.repeat(38))

  const settings = await readEngineSettings()

  // Launch browser once if any subgraph node needs it
  let browser: Browser | undefined
  let page: import('playwright').Page | undefined

  if (subNodes.some((n) => BROWSER_NODES.has(n.type))) {
    send('Launching browser…')
    const bsNode    = subNodes.find((n) => n.type === 'browser-source')
    const headless  = !!(bsNode?.data.headless ?? true)
    const userAgent = bsNode?.data.userAgent as string | undefined

    const launchOpts: Parameters<typeof chromium.launch>[0] = { headless }
    if (settings.proxy) launchOpts.proxy = { server: settings.proxy.server, bypass: settings.proxy.bypass }

    browser = await chromium.launch(launchOpts)
    const browserCtx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      ...(userAgent ? { userAgent } : {}),
    })

    const gc = settings.globalCookies?.trim()
    if (gc) {
      const seedUrl = (bsNode?.data.url as string | undefined) ?? 'http://localhost'
      const pairs = gc.split(';').map((s) => {
        const [name, ...rest] = s.trim().split('=')
        return { name: name.trim(), value: rest.join('=').trim(), url: seedUrl }
      }).filter((c) => c.name)
      if (pairs.length) await browserCtx.addCookies(pairs)
    }

    page = await browserCtx.newPage()
    page.setDefaultTimeout(30_000)
    send('Browser ready.')
  }

  const nodeOutputs = new Map<string, DataRecord[]>()

  const ctx: EngineContext = {
    browser,
    page,
    controller,
    globalCookies: settings.globalCookies ?? '',
    proxyServer:   settings.proxy?.server,
    aiApiKey:      settings.ai?.apiKey,
    aiProvider:    settings.ai?.provider,
    aiModel:       settings.ai?.model,
    onLog:         (msg) => send(msg),
    onProgress:    (_step, _total, current, total, message) => {
      if (total > 1) send(`  [${current}/${total}] ${message}`)
    },
    onBatch:       () => undefined,
    onNodeStatus:  () => undefined,
  }

  try {
    for (let i = 0; i < order.length; i++) {
      controller.throwIfAborted()

      const nodeId  = order[i]
      const nodeDef = subNodes.find((n) => n.id === nodeId)
      if (!nodeDef) continue

      const executor = EXECUTORS[nodeDef.type]
      if (!executor) {
        send(`⚠ Unknown node type "${nodeDef.type}" — skipping`)
        nodeOutputs.set(nodeId, [])
        continue
      }

      const inputs: DataRecord[] = subEdges
        .filter((e) => e.target === nodeId)
        .flatMap((e) => nodeOutputs.get(e.source) ?? [])

      send(`\n▶ [${i + 1}/${totalSteps}] ${nodeDef.type}`)

      try {
        const output = await executor(capData(nodeDef.data), inputs, ctx)
        nodeOutputs.set(nodeId, output)
        send(`✓ ${output.length} record${output.length !== 1 ? 's' : ''}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'ABORTED') throw err
        send(`✕ failed: ${msg}`)
        nodeOutputs.set(nodeId, [])
      }
    }
  } finally {
    await browser?.close()
  }

  return (nodeOutputs.get(targetNodeId) ?? []).slice(0, MAX_RECORDS)
}

// ─── IPC registration ─────────────────────────────────────────────────────────
export function registerNodeTestIpc(): void {

  ipcMain.handle('node:test', async (
    _event,
    targetNodeId: string,
    allNodes:     WorkflowNodeConfig[],
    allEdges:     WorkflowEdgeConfig[],
  ) => {
    const win = getMainWindow()
    activeController?.abort()
    activeController = new EngineController()
    const controller = activeController

    const send = (text: string) => win?.webContents.send('node:testLog', text)

    try {
      const records = await runPartialWorkflow(targetNodeId, allNodes, allEdges, send, controller)
      send(`\n${'─'.repeat(38)}`)
      send(`✓ Done — ${records.length} record${records.length !== 1 ? 's' : ''}`)
      win?.webContents.send('node:testComplete', { success: true, records })
      return { success: true, records }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message !== 'ABORTED') {
        send(`\n✕ ${message}`)
        win?.webContents.send('node:testComplete', { success: false, error: message, records: [] })
        return { success: false, error: message, records: [] }
      }
      win?.webContents.send('node:testComplete', { success: false, error: 'Stopped', records: [] })
      return { success: false, error: 'Stopped', records: [] }
    } finally {
      activeController = null
    }
  })

  ipcMain.handle('node:testStop', () => {
    activeController?.abort()
    activeController = null
  })
}
