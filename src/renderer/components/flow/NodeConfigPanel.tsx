import { useState, useEffect, useCallback, useRef } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { Settings2, Eye, Code2, Copy, Check, Trash2, X, Play, Square, Terminal, Table2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PALETTE_NODES, getSampleData, type PaletteNodeMeta, ACCENT_HEX, NODE_ACCENT_KEY } from './nodes'
import type {
  BrowserSourceData, HttpSourceData, ApiSourceData,
  LinkExtractorData, ListScraperData, FieldExtractorData,
  AIExtractorData, FilterData, TransformData, FileExportData, WebhookData,
} from './nodes'
import {
  BrowserSourcePanel, HttpSourcePanel, ApiSourcePanel,
  LinkExtractorPanel, ListScraperPanel, FieldExtractorPanel,
  AIExtractorPanel, FilterPanel, TransformPanel, FileExportPanel, WebhookPanel,
} from './ConfigPanels'

// ─── JSON Viewer ──────────────────────────────────────────────────────────────

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const pad = depth * 12
  if (value === null)             return <span className="text-slate-500 italic">null</span>
  if (typeof value === 'boolean') return <span className="text-violet-400">{String(value)}</span>
  if (typeof value === 'number')  return <span className="text-emerald-400">{value}</span>
  if (typeof value === 'string')  return <span className="text-amber-300">"{value}"</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-slate-400">[]</span>
    return (
      <>
        <span className="text-slate-500">{'['}</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: pad + 12 }}>
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-slate-600">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: pad }}><span className="text-slate-500">{']'}</span></div>
      </>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) return <span className="text-slate-400">{'{}'}</span>
    return (
      <>
        <span className="text-slate-500">{'{'}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: pad + 12 }}>
            <span className="text-sky-400">"{key}"</span>
            <span className="text-slate-600">: </span>
            <JsonValue value={val} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-slate-600">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: pad }}><span className="text-slate-500">{'}'}</span></div>
      </>
    )
  }
  return <span className="text-slate-300">{String(value)}</span>
}

function JsonViewer({ nodeType, nodeData }: { nodeType: string; nodeData: unknown }) {
  const [copied, setCopied] = useState(false)
  const data = getSampleData(nodeType, nodeData)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
        <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-emerald-300/80 leading-relaxed">
          Sample output for <span className="font-semibold text-emerald-300">{nodeType}</span>. Actual data depends on target site.
        </p>
      </div>
      <div className="relative rounded-xl bg-[#0d0f1a] border border-[#2a2e45] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2235]">
          <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">sample output</span>
          <button onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors">
            {copied
              ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
              : <><Copy className="w-3 h-3" /><span>Copy</span></>}
          </button>
        </div>
        <div className="p-3 overflow-x-auto max-h-80 overflow-y-auto">
          <pre className="text-[11px] font-mono leading-[1.7]">
            <JsonValue value={data} />
          </pre>
        </div>
      </div>
    </div>
  )
}

// ─── Test Run Panel ───────────────────────────────────────────────────────────

/** Source nodes — they are the roots of a workflow chain */
const SOURCE_NODES = new Set(['browser-source', 'http-source', 'api-source'])

type TestState = 'idle' | 'running' | 'done' | 'error'

interface RecordTableProps { records: unknown[] }

function RecordTable({ records }: RecordTableProps) {
  if (!records.length) return <p className="text-[10px] text-slate-600 text-center py-4">No records returned.</p>

  const allKeys = Array.from(new Set(records.flatMap((r) => Object.keys(r as Record<string, unknown>))))
  const dataKeys = allKeys.filter((k) => !k.startsWith('_'))
  const metaKeys = allKeys.filter((k) => k.startsWith('_'))
  const keys = [...dataKeys, ...metaKeys].slice(0, 10) // cap columns

  return (
    <div className="overflow-x-auto rounded-xl border border-[#2a2e45] bg-[#0d0f1a]">
      <table className="text-[10px] w-full">
        <thead>
          <tr className="border-b border-[#1e2235]">
            {keys.map((k) => (
              <th key={k} className={cn(
                'px-2.5 py-1.5 text-left font-semibold whitespace-nowrap',
                k.startsWith('_') ? 'text-slate-600' : 'text-slate-400',
              )}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((row, i) => {
            const r = row as Record<string, unknown>
            return (
              <tr key={i} className={cn('border-b border-[#1a1d27] last:border-0', i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]')}>
                {keys.map((k) => {
                  const v = r[k]
                  const str = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v)
                  const isUrl = typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))
                  return (
                    <td key={k} className="px-2.5 py-1.5 max-w-[200px] truncate" title={str}>
                      {isUrl
                        ? <a href={v as string} target="_blank" rel="noreferrer"
                            className="text-sky-400 hover:underline">{str.slice(0, 60)}</a>
                        : <span className={cn(
                            typeof v === 'number' ? 'text-emerald-400' :
                            typeof v === 'boolean' ? 'text-violet-400' :
                            k.startsWith('_') ? 'text-slate-600' : 'text-slate-300',
                          )}>{str || <span className="text-slate-700 italic">—</span>}</span>
                      }
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TestRunPanel({
  node, edges, allNodes, hex,
}: {
  node: Node
  edges: Edge[]
  allNodes: Node[]
  hex: string
}) {
  const [state,     setState]     = useState<TestState>('idle')
  const [logs,      setLogs]      = useState<string[]>([])
  const [records,   setRecords]   = useState<unknown[]>([])
  const [error,     setError]     = useState<string | null>(null)
  const [showTable, setShowTable] = useState(true)
  const logRef = useRef<HTMLDivElement>(null)

  // Reset when switching nodes
  useEffect(() => {
    setLogs([])
    setRecords([])
    setState('idle')
    setError(null)
  }, [node.id])

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // Subscribe to IPC push events
  useEffect(() => {
    const offLog  = window.electronAPI.onNodeTestLog((text) => setLogs((l) => [...l, text]))
    const offDone = window.electronAPI.onNodeTestComplete((res) => {
      setState(res.success ? 'done' : 'error')
      setRecords(res.records)
      if (!res.success && res.error) setError(res.error)
    })
    return () => { offLog(); offDone() }
  }, [])

  // Compute ancestor chain for the badge
  const isSource = SOURCE_NODES.has(node.type ?? '')
  const chainLen = (() => {
    const visited = new Set<string>([node.id])
    const queue   = [node.id]
    while (queue.length) {
      const cur = queue.shift()!
      for (const e of edges) {
        if (e.target === cur && !visited.has(e.source)) {
          visited.add(e.source)
          queue.push(e.source)
        }
      }
    }
    return visited.size
  })()

  const run = async () => {
    setLogs([])
    setRecords([])
    setError(null)
    setState('running')

    // Build serialisable WorkflowNodeConfig / WorkflowEdgeConfig arrays
    const wfNodes = allNodes.map((n) => ({ id: n.id, type: n.type ?? '', data: n.data as Record<string, unknown> }))
    const wfEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
    await window.electronAPI.testNode(node.id, wfNodes, wfEdges)
  }

  const stop = () => {
    window.electronAPI.stopNodeTest()
    setState('idle')
    setLogs((l) => [...l, '⏹ Stopped.'])
  }

  const isRunning = state === 'running'

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Chain info banner */}
      <div className="rounded-xl bg-indigo-600/8 border border-indigo-500/20 px-3 py-2.5">
        <p className="text-[11px] text-indigo-300 font-semibold">
          {isSource
            ? 'This is a source node — runs standalone.'
            : `Runs ${chainLen} upstream node${chainLen !== 1 ? 's' : ''} in sequence, then returns output from this node.`
          }
        </p>
        <p className="text-[10px] text-indigo-400/70 mt-0.5">
          Max 5 records · 1 page · no file export during test
        </p>
      </div>

      {/* Run / Stop */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button onClick={stop}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 transition-colors">
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        ) : (
          <button onClick={run}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: `${hex}22`, border: `1px solid ${hex}55`, color: hex }}>
            <Play className="w-3.5 h-3.5" /> Run Test
          </button>
        )}

        <span className={cn('text-[10px] font-semibold ml-auto', {
          'text-slate-500':   state === 'idle',
          'text-amber-400':   state === 'running',
          'text-emerald-400': state === 'done',
          'text-red-400':     state === 'error',
        })}>
          {state === 'idle'    && 'Ready'}
          {state === 'running' && 'Running…'}
          {state === 'done'    && `✓ ${records.length} record${records.length !== 1 ? 's' : ''}`}
          {state === 'error'   && '✕ Error'}
        </span>
      </div>

      {/* Live log stream */}
      {logs.length > 0 && (
        <div className="flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Terminal className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Logs</span>
          </div>
          <div
            ref={logRef}
            className="bg-[#080a11] border border-[#1e2235] rounded-xl p-2.5 h-40 overflow-y-auto font-mono text-[10px] leading-[1.7]"
          >
            {logs.map((line, i) => (
              <div key={i} className={cn('whitespace-pre-wrap break-all flex items-start gap-1',
                line.startsWith('✓') ? 'text-emerald-400' :
                line.startsWith('✕') ? 'text-red-400'     :
                line.startsWith('▶') ? 'text-indigo-400'  :
                line.startsWith('─') ? 'text-slate-700'   :
                line.startsWith('  [') ? 'text-slate-600' :
                'text-slate-400',
              )}>
                <ChevronRight className="w-2.5 h-2.5 mt-0.5 shrink-0 text-slate-700" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      {(state === 'done' || records.length > 0) && (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex items-center gap-1.5 mb-1">
            <Table2 className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Results ({records.length})
            </span>
            <button onClick={() => setShowTable(v => !v)}
              className="ml-auto text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
              {showTable ? 'Hide' : 'Show'}
            </button>
          </div>
          {showTable && <RecordTable records={records} />}
        </div>
      )}

      {error && state === 'error' && (
        <div className="rounded-xl bg-red-600/10 border border-red-500/20 px-3 py-2">
          <p className="text-[10px] text-red-400 font-mono break-all">{error}</p>
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface NodeConfigPanelProps {
  nodeId:           string | null
  nodes:            Node[]
  edges:            Edge[]
  defaultTab?:      'config' | 'preview'
  onClose:          () => void
  onUpdateNodeData: (id: string, patch: Partial<object>) => void
  onDeleteNode:     (id: string) => void
}

export function NodeConfigPanel({
  nodeId, nodes, edges, defaultTab = 'config', onClose, onUpdateNodeData, onDeleteNode,
}: NodeConfigPanelProps) {
  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null
  const [tab, setTab] = useState<'config' | 'preview' | 'run'>(defaultTab)

  useEffect(() => { setTab(defaultTab) }, [nodeId, defaultTab])
  useEffect(() => {
    if (!node) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [node, onClose])

  const accentKey = node ? (NODE_ACCENT_KEY[node.type ?? ''] ?? 'slate') : 'slate'
  const hex       = ACCENT_HEX[accentKey] ?? '#64748b'
  const paletteMeta: PaletteNodeMeta | undefined = node
    ? PALETTE_NODES.find((p) => p.type === node.type)
    : undefined

  const renderPanel = useCallback(() => {
    if (!node) return null
    const t = node.type
    const u = onUpdateNodeData
    const d = node.data as unknown
    if (t === 'browser-source')  return <BrowserSourcePanel  id={node.id} data={d as BrowserSourceData}  update={u} />
    if (t === 'http-source')     return <HttpSourcePanel     id={node.id} data={d as HttpSourceData}     update={u} />
    if (t === 'api-source')      return <ApiSourcePanel      id={node.id} data={d as ApiSourceData}      update={u} />
    if (t === 'link-extractor')  return <LinkExtractorPanel  id={node.id} data={d as LinkExtractorData}  update={u} />
    if (t === 'list-scraper')    return <ListScraperPanel    id={node.id} data={d as ListScraperData}    update={u} />
    if (t === 'field-extractor') return <FieldExtractorPanel id={node.id} data={d as FieldExtractorData} update={u} />
    if (t === 'ai-extractor')    return <AIExtractorPanel    id={node.id} data={d as AIExtractorData}    update={u} />
    if (t === 'filter')          return <FilterPanel         id={node.id} data={d as FilterData}         update={u} />
    if (t === 'transform')       return <TransformPanel      id={node.id} data={d as TransformData}      update={u} />
    if (t === 'file-export')     return <FileExportPanel     id={node.id} data={d as FileExportData}     update={u} />
    if (t === 'webhook')         return <WebhookPanel        id={node.id} data={d as WebhookData}        update={u} />
    return <p className="text-slate-500 text-sm p-4">Unknown node type: {t}</p>
  }, [node, onUpdateNodeData])

  return (
    <div className="flex flex-col w-full h-full bg-[#12141e] border-l border-[#1e2235] overflow-hidden">
      {node && (
        <>
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-3 py-3 shrink-0"
            style={{ background: `${hex}15`, borderBottom: `1px solid ${hex}30` }}
          >
            {/* Icon */}
            {paletteMeta && (
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${hex}22`, border: `1px solid ${hex}50` }}
              >
                <paletteMeta.icon className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-100 uppercase tracking-[0.08em] truncate">
                {paletteMeta?.label ?? node.type}
              </p>
              <p className="text-[9px] text-slate-600 font-mono truncate">{node.id}</p>
            </div>

            {/* Delete */}
            <button
              onClick={() => { onDeleteNode(node.id); onClose() }}
              className="flex items-center justify-center w-7 h-7 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-950/40 transition-colors shrink-0"
              title="Delete node"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Divider */}
            <div className="w-px h-4 bg-[#2a2e45] shrink-0" />

            {/* Close panel */}
            <button
              onClick={onClose}
              title="Close panel (Esc)"
              className="flex items-center justify-center w-7 h-7 rounded-xl text-slate-500 hover:text-slate-100 hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 bg-[#0d0f1a] border-b border-[#1e2235]">
            {([
              ['config',  Settings2, 'Config'  ],
              ['run',     Play,      'Run'     ],
              ['preview', Eye,       'Preview' ],
            ] as const).map(([t, TIcon, tlabel]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[11px] font-semibold transition-all border-b-2',
                  tab === t
                    ? 'text-slate-100 border-b-2'
                    : 'text-slate-600 border-transparent hover:text-slate-400',
                )}
                style={tab === t ? { borderBottomColor: hex, color: hex } : undefined}
              >
                <TIcon className="w-3.5 h-3.5" />{tlabel}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className={cn('flex-1 p-4 space-y-4', tab === 'run' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto')}>
            {tab === 'config' && renderPanel()}
            {tab === 'run' && <TestRunPanel node={node} edges={edges} allNodes={nodes} hex={hex} />}
            {tab === 'preview' && node.type && (
              <JsonViewer nodeType={node.type} nodeData={node.data} />
            )}
          </div>
        </>
      )}

      {/* Empty state when closed but space still 0 */}
    </div>
  )
}
