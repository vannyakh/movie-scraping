import { useState, useEffect } from 'react'
import { type Node } from '@xyflow/react'
import { X, Settings2, Eye, Code2, Copy, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PALETTE_NODES, getSampleData, type PaletteNodeMeta } from './nodes'
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
  const pad = depth * 14
  if (value === null)             return <span className="text-slate-500 italic">null</span>
  if (typeof value === 'boolean') return <span className="text-violet-400">{String(value)}</span>
  if (typeof value === 'number')  return <span className="text-emerald-400">{value}</span>
  if (typeof value === 'string')  return <span className="text-amber-300">"{value}"</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-slate-400">[]</span>
    return (
      <>
        <span className="text-slate-400">{'['}</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: pad + 14 }}>
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-slate-600">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: pad }}><span className="text-slate-400">{']'}</span></div>
      </>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) return <span className="text-slate-400">{'{}'}</span>
    return (
      <>
        <span className="text-slate-400">{'{'}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: pad + 14 }}>
            <span className="text-blue-300">"{key}"</span>
            <span className="text-slate-500">: </span>
            <JsonValue value={val} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-slate-600">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: pad }}><span className="text-slate-400">{'}'}</span></div>
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
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-600/10 border border-emerald-500/20">
        <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-emerald-300 leading-relaxed">
          Sample output for the <span className="font-semibold">{nodeType}</span> node. Actual data depends on the target site.
        </p>
      </div>
      <div className="relative rounded-lg bg-[#0a0c14] border border-[#2e3350] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2e3350] bg-[#0f1117]">
          <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">sample output</span>
          <button onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            {copied
              ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
              : <><Copy className="w-3 h-3" /><span>Copy</span></>}
          </button>
        </div>
        <div className="p-3 overflow-x-auto max-h-96 overflow-y-auto">
          <pre className="text-[11px] font-mono leading-[1.7] whitespace-pre-wrap">
            <JsonValue value={data} />
          </pre>
        </div>
      </div>
    </div>
  )
}

// ─── Accent map for header colors ─────────────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
  'browser-source':  'bg-indigo-600',
  'http-source':     'bg-blue-600',
  'api-source':      'bg-cyan-600',
  'link-extractor':  'bg-violet-600',
  'list-scraper':    'bg-purple-600',
  'field-extractor': 'bg-amber-600',
  'ai-extractor':    'bg-pink-600',
  'filter':          'bg-orange-600',
  'transform':       'bg-yellow-600',
  'file-export':     'bg-emerald-600',
  'webhook':         'bg-teal-600',
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
  const open = !!node
  const [tab, setTab] = useState<'config' | 'preview'>(defaultTab)

  useEffect(() => { setTab(defaultTab) }, [nodeId, defaultTab])
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const accentBg = node ? (ACCENT_MAP[node.type ?? ''] ?? 'bg-slate-600') : 'bg-slate-600'
  const paletteMeta: PaletteNodeMeta | undefined = node
    ? PALETTE_NODES.find((p) => p.type === node.type)
    : undefined

  return (
    <div className={cn(
      'absolute right-0 top-0 h-full w-80 bg-[#13151f] border-l border-[#2e3350] shadow-2xl flex flex-col z-40 transition-transform duration-200',
      open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
    )}>
      {node ? (
        <>
          {/* Header */}
          <div className={cn('flex items-center gap-2.5 px-4 py-3 shrink-0', accentBg)}>
            {paletteMeta && <paletteMeta.icon className="w-4 h-4 text-white shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white uppercase tracking-widest">
                {paletteMeta?.label ?? node.type}
              </p>
              <p className="text-[10px] text-white/50 font-mono">{node.id}</p>
            </div>
            <button
              onClick={onClose}
              className="nodrag nopan w-6 h-6 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-[#2e3350] bg-[#0f1117]">
            {([
              ['config',  Settings2, 'Config',  'text-indigo-400 border-indigo-500' ],
              ['preview', Eye,       'Preview', 'text-emerald-400 border-emerald-500'],
            ] as const).map(([t, TIcon, label, activeCls]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 flex-1 justify-center py-2 text-[11px] font-medium transition-colors border-b-2',
                  tab === t ? activeCls : 'text-slate-500 border-transparent hover:text-slate-300',
                )}
              >
                <TIcon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'config' && (() => {
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
              return <p className="text-slate-500 text-sm">No config panel for type: {t}</p>
            })()}
            {tab === 'preview' && node.type && (
              <JsonViewer nodeType={node.type} nodeData={node.data} />
            )}
          </div>

          {/* Footer */}
          {tab === 'config' && (
            <div className="shrink-0 p-4 border-t border-[#2e3350]">
              <button
                onClick={() => { onDeleteNode(node.id); onClose() }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 hover:border-red-500/60 hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Node
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 px-6">
          <Settings2 className="w-10 h-10 opacity-20" />
          <p className="text-sm text-center leading-relaxed">
            Hover a node and click{' '}
            <span className="text-indigo-400 font-medium">Setup</span> to configure, or{' '}
            <span className="text-emerald-400 font-medium">Preview</span> for sample data.
          </p>
        </div>
      )}
    </div>
  )
}
