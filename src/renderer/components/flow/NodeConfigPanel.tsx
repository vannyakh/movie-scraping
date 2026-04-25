import { useState, useEffect, useCallback } from 'react'
import { type Node } from '@xyflow/react'
import { Settings2, Eye, Code2, Copy, Check, Trash2, ChevronLeft } from 'lucide-react'
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

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface NodeConfigPanelProps {
  nodeId:           string | null
  nodes:            Node[]
  defaultTab?:      'config' | 'preview'
  onClose:          () => void
  onUpdateNodeData: (id: string, patch: Partial<object>) => void
  onDeleteNode:     (id: string) => void
}

export function NodeConfigPanel({
  nodeId, nodes, defaultTab = 'config', onClose, onUpdateNodeData, onDeleteNode,
}: NodeConfigPanelProps) {
  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null
  const [tab, setTab] = useState<'config' | 'preview'>(defaultTab)

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
            className="flex items-center gap-2.5 px-4 py-3 shrink-0"
            style={{ background: `${hex}15`, borderBottom: `1px solid ${hex}30` }}
          >
            {/* Back / Close */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

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
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 bg-[#0d0f1a] border-b border-[#1e2235]">
            {([
              ['config',  Settings2, 'Config'  ],
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tab === 'config' && renderPanel()}
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
