import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play, RotateCcw, HelpCircle, X, Plus, Trash2,
  Globe2, Layers, List, FileSearch, Download, Settings2,
  GripVertical, AlertCircle, Eye, Code2, Copy, Check,
} from 'lucide-react'
import {
  nodeTypes, edgeTypes, defaultNodeData, PALETTE_NODES,
  NodeDetailProvider, inputCls, Field, Toggle,
  DEFAULT_DETAIL_FIELDS, getSampleData,
  type SourceData, type CategoryData, type MovieListData,
  type DetailData, type DetailField, type ExportData,
} from '@/components/flow/nodes'
import { useScrapingStore } from '@/store/scrapingStore'
import type { ScraperConfig } from '../../lib/ipc'
import { cn } from '@/lib/utils'

// ─── Default pipeline ──────────────────────────────────────────────────────────

const INITIAL_NODES: Node[] = [
  { id: 'source-1',    type: 'source',    position: { x: 40,   y: 120 }, data: { ...defaultNodeData.source }    },
  { id: 'category-1',  type: 'category',  position: { x: 400,  y: 60  }, data: { ...defaultNodeData.category }  },
  { id: 'movieList-1', type: 'movieList', position: { x: 760,  y: 20  }, data: { ...defaultNodeData.movieList } },
  { id: 'detail-1',    type: 'detail',    position: { x: 1120, y: 0   }, data: { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) } },
  { id: 'export-1',    type: 'export',    position: { x: 1480, y: 80  }, data: { ...defaultNodeData.export }    },
]

const INITIAL_EDGES: Edge[] = [
  { id: 'e-src-cat',  source: 'source-1',    target: 'category-1',  type: 'custom', animated: true },
  { id: 'e-cat-list', source: 'category-1',  target: 'movieList-1', type: 'custom', animated: true },
  { id: 'e-list-det', source: 'movieList-1', target: 'detail-1',    type: 'custom', animated: true },
  { id: 'e-det-exp',  source: 'detail-1',    target: 'export-1',    type: 'custom', animated: true },
]

// ─── Flow → Config ─────────────────────────────────────────────────────────────

function flowToConfig(nodes: Node[]): ScraperConfig | null {
  const src = nodes.find(n => n.type === 'source')
  const exp = nodes.find(n => n.type === 'export')
  if (!src || !exp) return null

  const sd = src.data as unknown as SourceData
  const ed = exp.data as unknown as ExportData
  if (!sd.baseUrl?.trim())   return null
  if (!ed.outputDir?.trim()) return null

  const cat = nodes.find(n => n.type === 'category')
  const lst = nodes.find(n => n.type === 'movieList')
  const det = nodes.find(n => n.type === 'detail')

  const sels: ScraperConfig['selectors'] = {}
  let hasSel = false

  if (cat) {
    const c = cat.data as unknown as CategoryData
    if (c.selector.trim()) { sels.categories = c.selector.trim(); hasSel = true }
  }

  if (lst) {
    const l = lst.data as unknown as MovieListData
    if (l.movieSelector.trim())    { sels.movieList = l.movieSelector.trim();    hasSel = true }
    if (l.nextPageSelector.trim()) { sels.nextPage  = l.nextPageSelector.trim(); hasSel = true }
  }

  if (det) {
    const d = det.data as unknown as DetailData
    const fields = d.fields ?? DEFAULT_DETAIL_FIELDS
    const detSels: NonNullable<ScraperConfig['selectors']>['detail'] = {}
    let hasDet = false
    const KNOWN = ['title','year','rating','duration','director','description','cast','poster'] as const
    for (const f of fields) {
      if (f.selector.trim() && (KNOWN as readonly string[]).includes(f.id)) {
        (detSels as Record<string, string>)[f.id] = f.selector.trim()
        hasDet = true
      }
    }
    if (hasDet) { sels.detail = detSels; hasSel = true }
  }

  const ld = lst?.data as unknown as MovieListData | undefined

  return {
    baseUrl:              sd.baseUrl.trim(),
    outputDir:            ed.outputDir.trim(),
    headless:             sd.headless,
    delayMs:              sd.delayMs ?? 500,
    userAgent:            sd.userAgent?.trim() || undefined,
    maxMoviesPerCategory: ld?.maxMovies  || undefined,
    maxPagesPerCategory:  ld?.maxPages   || undefined,
    exportJson:           ed.exportJson,
    exportExcel:          ed.exportExcel,
    exportCsv:            ed.exportCsv,
    selectors:            hasSel ? sels : undefined,
  }
}

// ─── JSON Viewer ───────────────────────────────────────────────────────────────

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const pad = depth * 14

  if (value === null)
    return <span className="text-slate-500 italic">null</span>
  if (typeof value === 'boolean')
    return <span className="text-violet-400">{String(value)}</span>
  if (typeof value === 'number')
    return <span className="text-emerald-400">{value}</span>
  if (typeof value === 'string')
    return <span className="text-amber-300">"{value}"</span>

  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-slate-400">[]</span>
    return (
      <>
        <span className="text-slate-400">{'['}</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: pad + 14 }}>
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-slate-600">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: pad }}>
          <span className="text-slate-400">{']'}</span>
        </div>
      </>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0)
      return <span className="text-slate-400">{'{}'}</span>
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
        <div style={{ paddingLeft: pad }}>
          <span className="text-slate-400">{'}'}</span>
        </div>
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

  const NODE_DESC: Record<string, string> = {
    source:    'Configuration passed to the scraper engine',
    category:  'Array of discovered category links',
    movieList: 'Array of movie items found per category page',
    detail:    'Extracted data for a single movie detail page',
    export:    'Export summary written alongside output files',
  }

  return (
    <div className="space-y-3">
      {/* Description */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-600/10 border border-emerald-500/20">
        <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-emerald-300 leading-relaxed">
          {NODE_DESC[nodeType] ?? 'Sample output for this node type.'}
        </p>
      </div>

      {/* JSON block */}
      <div className="relative rounded-lg bg-[#0a0c14] border border-[#2e3350] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2e3350] bg-[#0f1117]">
          <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">sample output</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            {copied
              ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
              : <><Copy className="w-3 h-3" /><span>Copy</span></>
            }
          </button>
        </div>
        <div className="p-3 overflow-x-auto max-h-[420px] overflow-y-auto">
          <pre className="text-[11px] font-mono leading-[1.7] whitespace-pre-wrap">
            <JsonValue value={data} />
          </pre>
        </div>
      </div>

      <p className="text-[9px] text-slate-600 text-center leading-relaxed">
        Sample data — actual values depend on the scraped site.
      </p>
    </div>
  )
}

// ─── Node Config Panel ─────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  source:    { bg: 'bg-indigo-600',  text: 'text-indigo-300',  border: 'border-indigo-500/40',  icon: Globe2     },
  category:  { bg: 'bg-violet-600',  text: 'text-violet-300',  border: 'border-violet-500/40',  icon: Layers     },
  movieList: { bg: 'bg-emerald-600', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: List       },
  detail:    { bg: 'bg-amber-600',   text: 'text-amber-300',   border: 'border-amber-500/40',   icon: FileSearch },
  export:    { bg: 'bg-slate-600',   text: 'text-slate-300',   border: 'border-slate-500/40',   icon: Download   },
}

interface NodeConfigPanelProps {
  nodeId:    string | null
  nodes:     Node[]
  defaultTab?: 'config' | 'preview'
  onClose:   () => void
  onUpdateNodeData: (id: string, data: Partial<object>) => void
  onDeleteNode:     (id: string) => void
}

function NodeConfigPanel({ nodeId, nodes, defaultTab = 'config', onClose, onUpdateNodeData, onDeleteNode }: NodeConfigPanelProps) {
  const node = nodeId ? nodes.find(n => n.id === nodeId) : null
  const open = !!node
  const [tab, setTab] = useState<'config' | 'preview'>(defaultTab)

  // Sync tab when panel opens with a specific tab
  useEffect(() => { setTab(defaultTab) }, [nodeId, defaultTab])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const meta = node ? ACCENT_MAP[node.type ?? ''] : null
  const Icon = meta?.icon ?? Settings2

  return (
    <div className={cn(
      'absolute right-0 top-0 h-full w-80 bg-[#13151f] border-l border-[#2e3350] shadow-2xl flex flex-col z-40 transition-transform duration-200',
      open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
    )}>
      {node && meta ? (
        <>
          {/* Panel header */}
          <div className={cn('flex items-center gap-2.5 px-4 py-3 shrink-0', meta.bg)}>
            <Icon className="w-4 h-4 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white uppercase tracking-widest">
                {PALETTE_NODES.find(p => p.type === node.type)?.label ?? node.type}
              </p>
              <p className="text-[10px] text-white/60 font-mono">ID: {node.id}</p>
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
            <button
              onClick={() => setTab('config')}
              className={cn(
                'flex items-center gap-1.5 flex-1 justify-center py-2 text-[11px] font-medium transition-colors border-b-2',
                tab === 'config'
                  ? 'text-indigo-400 border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300',
              )}
            >
              <Settings2 className="w-3 h-3" />
              Config
            </button>
            <button
              onClick={() => setTab('preview')}
              className={cn(
                'flex items-center gap-1.5 flex-1 justify-center py-2 text-[11px] font-medium transition-colors border-b-2',
                tab === 'preview'
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300',
              )}
            >
              <Eye className="w-3 h-3" />
              Preview JSON
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'config' && (
              <>
                {node.type === 'source'    && <SourcePanel    id={node.id} data={node.data as unknown as SourceData}    update={onUpdateNodeData} />}
                {node.type === 'category'  && <CategoryPanel  id={node.id} data={node.data as unknown as CategoryData}  update={onUpdateNodeData} />}
                {node.type === 'movieList' && <MovieListPanel id={node.id} data={node.data as unknown as MovieListData} update={onUpdateNodeData} />}
                {node.type === 'detail'    && <DetailPanel    id={node.id} data={node.data as unknown as DetailData}    update={onUpdateNodeData} />}
                {node.type === 'export'    && <ExportPanel    id={node.id} data={node.data as unknown as ExportData}    update={onUpdateNodeData} />}
              </>
            )}
            {tab === 'preview' && node.type && (
              <JsonViewer nodeType={node.type} nodeData={node.data} />
            )}
          </div>

          {/* Danger zone — only on config tab */}
          {tab === 'config' && (
            <div className="shrink-0 p-4 border-t border-[#2e3350]">
              <button
                onClick={() => { onDeleteNode(node.id); onClose() }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 hover:border-red-500/60 hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Node
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 px-6">
          <Settings2 className="w-10 h-10 opacity-30" />
          <p className="text-sm text-center leading-relaxed">
            Hover a node and click <span className="text-indigo-400 font-medium">Setup</span> to configure,
            or <span className="text-emerald-400 font-medium">Preview</span> to see sample JSON output.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Per-type Config Panels ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-1">{children}</p>
  )
}

function SourcePanel({ id, data: d, update }: { id: string; data: SourceData; update: (id: string, patch: Partial<SourceData>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Connection Settings</SectionTitle>
      <Field label="Base URL" hint="The homepage URL to start scraping from">
        <input className={inputCls} placeholder="https://example.com" value={d.baseUrl}
          onChange={e => update(id, { baseUrl: e.target.value })} />
      </Field>
      <Field label="User Agent" hint="Leave blank to use default Chrome UA">
        <input className={inputCls} placeholder="Mozilla/5.0 …" value={d.userAgent}
          onChange={e => update(id, { userAgent: e.target.value })} />
      </Field>

      <SectionTitle>Browser Options</SectionTitle>
      <Field label="Delay Between Requests (ms)" hint="Higher = more polite, less likely to be blocked">
        <input type="number" className={inputCls} value={d.delayMs} min={0} step={100}
          onChange={e => update(id, { delayMs: +e.target.value })} />
      </Field>
      <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1d27] border border-[#2e3350]">
        <div>
          <p className="text-xs font-medium text-slate-300">Headless Mode</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Run browser without visible window</p>
        </div>
        <Toggle value={d.headless} onChange={v => update(id, { headless: v })} />
      </div>
    </div>
  )
}

function CategoryPanel({ id, data: d, update }: { id: string; data: CategoryData; update: (id: string, patch: Partial<CategoryData>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Category Detection</SectionTitle>
      <Field label="Category Link Selector" hint="CSS selector for navigation/genre links. Leave blank to auto-detect.">
        <input className={inputCls} placeholder="nav a[href], .genre-menu a" value={d.selector}
          onChange={e => update(id, { selector: e.target.value })} />
      </Field>
      <div className="rounded-lg bg-violet-600/10 border border-violet-500/20 p-3">
        <p className="text-[11px] text-violet-300 leading-relaxed">
          Auto-detection scans the homepage for common navigation patterns including <code className="text-violet-200 bg-violet-900/30 px-1 rounded">nav</code>, sidebar menus, and genre/category links.
        </p>
      </div>
    </div>
  )
}

function MovieListPanel({ id, data: d, update }: { id: string; data: MovieListData; update: (id: string, patch: Partial<MovieListData>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Selectors</SectionTitle>
      <Field label="Movie Item Selector" hint="CSS selector targeting each movie card or link">
        <input className={inputCls} placeholder=".movie-item a, article.film a" value={d.movieSelector}
          onChange={e => update(id, { movieSelector: e.target.value })} />
      </Field>
      <Field label="Next Page Selector" hint="CSS selector for the pagination 'next' button">
        <input className={inputCls} placeholder="a.next, .pagination .next a" value={d.nextPageSelector}
          onChange={e => update(id, { nextPageSelector: e.target.value })} />
      </Field>

      <SectionTitle>Limits</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max Pages" hint="Pages per category">
          <input type="number" className={inputCls} value={d.maxPages} min={1}
            onChange={e => update(id, { maxPages: +e.target.value })} />
        </Field>
        <Field label="Max Movies" hint="Total cap">
          <input type="number" className={inputCls} value={d.maxMovies} min={1}
            onChange={e => update(id, { maxMovies: +e.target.value })} />
        </Field>
      </div>
    </div>
  )
}

function DetailPanel({ id, data: d, update }: { id: string; data: DetailData; update: (id: string, patch: Partial<DetailData>) => void }) {
  const fields = d.fields ?? DEFAULT_DETAIL_FIELDS

  const updateField = (fieldId: string, patch: Partial<DetailField>) => {
    update(id, { fields: fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) })
  }

  const removeField = (fieldId: string) => {
    update(id, { fields: fields.filter(f => f.id !== fieldId) })
  }

  const addField = () => {
    const newField: DetailField = { id: `custom-${Date.now()}`, label: 'Custom Field', selector: '' }
    update(id, { fields: [...fields, newField] })
  }

  const resetToDefaults = () => {
    update(id, { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) })
  }

  const configuredCount = fields.filter(f => f.selector.trim()).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Extraction Fields</SectionTitle>
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full',
          configuredCount > 0 ? 'bg-amber-600/20 text-amber-300' : 'bg-[#1a1d27] text-slate-500',
        )}>
          {configuredCount}/{fields.length} set
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed -mt-2">
        Define a CSS selector for each field. Leave blank to use built-in auto-detection.
      </p>

      {/* Fields */}
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id} className="group/row rounded-lg bg-[#1a1d27] border border-[#2e3350] hover:border-[#3d4470] p-2.5 space-y-1.5 transition-colors">
            <div className="flex items-center gap-1.5">
              <GripVertical className="w-3 h-3 text-slate-700 shrink-0" />
              <input
                className="flex-1 min-w-0 bg-transparent text-[10px] font-semibold text-slate-400 uppercase tracking-wider focus:outline-none focus:text-slate-200 transition-colors"
                value={field.label}
                onChange={e => updateField(field.id, { label: e.target.value })}
                title="Click to rename"
              />
              <button
                onClick={() => removeField(field.id)}
                className="opacity-0 group-hover/row:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all shrink-0"
                title="Remove field"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <input
              className={inputCls}
              placeholder={`CSS selector for ${field.label.toLowerCase()}…`}
              value={field.selector}
              onChange={e => updateField(field.id, { selector: e.target.value })}
            />
            {field.selector.trim() && (
              <p className="text-[9px] text-emerald-500 pl-4.5">✓ Selector configured</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={addField}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-400 border border-dashed border-amber-600/30 hover:border-amber-500/60 hover:bg-amber-600/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Custom Field
      </button>
      <button
        onClick={resetToDefaults}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 border border-[#2e3350] hover:border-[#3d4470] hover:text-slate-400 transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  )
}

function ExportPanel({ id, data: d, update }: { id: string; data: ExportData; update: (id: string, patch: Partial<ExportData>) => void }) {
  const browse = async () => {
    const dir = await window.electronAPI.selectFolder()
    if (dir) update(id, { outputDir: dir })
  }

  const formats = [
    { key: 'exportJson'  as const, label: 'JSON',          desc: 'Machine-readable .json file'  },
    { key: 'exportExcel' as const, label: 'Excel (.xlsx)',  desc: 'Spreadsheet with rich format' },
    { key: 'exportCsv'   as const, label: 'CSV',           desc: 'Plain text comma-separated'   },
  ]
  const activeFormats = formats.filter(f => d[f.key])

  return (
    <div className="space-y-4">
      <SectionTitle>Output</SectionTitle>
      <Field label="Output Folder" hint="Where exported files will be saved">
        <div className="flex gap-1.5">
          <input
            className={cn(inputCls, 'flex-1 min-w-0')}
            placeholder="/path/to/output"
            value={d.outputDir}
            onChange={e => update(id, { outputDir: e.target.value })}
          />
          <button
            className="nodrag nopan shrink-0 px-2 py-1.5 rounded-md bg-[#1a1d27] border border-[#2e3350] text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500 transition-colors"
            onClick={browse}
          >
            …
          </button>
        </div>
      </Field>

      <SectionTitle>Export Formats</SectionTitle>
      <div className="space-y-2">
        {formats.map(({ key, label, desc }) => (
          <div
            key={key}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
              d[key]
                ? 'bg-indigo-600/10 border-indigo-500/30'
                : 'bg-[#1a1d27] border-[#2e3350] hover:border-[#3d4470]',
            )}
            onClick={() => update(id, { [key]: !d[key] })}
          >
            <div>
              <p className="text-xs font-medium text-slate-300">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
            </div>
            <Toggle value={d[key]} onChange={v => update(id, { [key]: v })} />
          </div>
        ))}
      </div>

      {activeFormats.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-600/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Enable at least one export format
        </div>
      )}
    </div>
  )
}

// ─── Node Palette ──────────────────────────────────────────────────────────────

function NodePalette() {
  return (
    <aside className="w-52 shrink-0 flex flex-col gap-2 bg-[#13151f] border-r border-[#2e3350] p-3 overflow-y-auto">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 pt-1">Node Types</p>
      <p className="text-[10px] text-slate-600 leading-relaxed px-1">Drag a node onto the canvas to add it to your flow.</p>
      <div className="flex flex-col gap-2 mt-1">
        {PALETTE_NODES.map(({ type, label, icon: Icon, color, desc }) => (
          <div
            key={type}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('application/reactflow/type', type)
              e.dataTransfer.effectAllowed = 'move'
            }}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a1d27] border border-[#2e3350] cursor-grab active:cursor-grabbing hover:border-[#3d4470] transition-colors select-none"
          >
            <div className={`w-7 h-7 rounded-md ${color} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 leading-tight">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-[#2e3350]">
        <div className="rounded-lg bg-indigo-600/10 border border-indigo-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            <p className="text-[10px] font-semibold text-indigo-300">Tips</p>
          </div>
          <ul className="text-[9px] text-indigo-200/70 space-y-1 leading-relaxed">
            <li>• Drag nodes from here to canvas</li>
            <li>• Hover node → Delete / Clone</li>
            <li>• Hover node → Setup Logic panel</li>
            <li>• Hover edge → click × to remove</li>
            <li>• Click node header to collapse</li>
            <li>• Press Delete to remove selected</li>
          </ul>
        </div>
      </div>
    </aside>
  )
}

// ─── Canvas ────────────────────────────────────────────────────────────────────

function FlowCanvas() {
  const navigate = useNavigate()
  const store    = useScrapingStore()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const { screenToFlowPosition, updateNodeData, deleteElements } = useReactFlow()

  const [configNodeId, setConfigNodeId] = useState<string | null>(null)
  const [configTab,    setConfigTab]    = useState<'config' | 'preview'>('config')

  const openPanel = useCallback((nodeId: string, tab: 'config' | 'preview' = 'config') => {
    setConfigNodeId(nodeId)
    setConfigTab(tab)
  }, [])

  const onConnect: OnConnect = useCallback(
    (conn) => setEdges(eds => addEdge({ ...conn, type: 'custom', animated: true }, eds)),
    [setEdges],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow/type')
    if (!type || !(type in defaultNodeData)) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const newData = type === 'detail'
      ? { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) }
      : { ...defaultNodeData[type] }
    setNodes(nds => [...nds, { id: `${type}-${Date.now()}`, type, position, data: newData }])
  }, [screenToFlowPosition, setNodes])

  const handleReset = useCallback(() => {
    setNodes(INITIAL_NODES.map(n => ({
      ...n,
      data: n.type === 'detail'
        ? { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) }
        : { ...defaultNodeData[n.type!] },
    })))
    setEdges(INITIAL_EDGES)
    setConfigNodeId(null)
    toast.info('Flow reset to default pipeline')
  }, [setNodes, setEdges])

  const handleRun = useCallback(async () => {
    const config = flowToConfig(nodes)
    if (!config) {
      toast.error('Flow is incomplete', {
        description: 'Add a Source node (with URL) and an Export node (with output folder).',
      })
      return
    }
    if (!config.exportJson && !config.exportExcel && !config.exportCsv) {
      toast.error('No export format selected', { description: 'Enable at least one format in the Export node.' })
      return
    }
    store.initJob(config)
    window.electronAPI.startScraping(config).catch(() => {})
    toast.success('Scraping started!', { description: config.baseUrl })
    navigate('/progress')
  }, [nodes, store, navigate])

  const handleUpdateNodeData = useCallback((id: string, patch: Partial<object>) => {
    updateNodeData(id, patch)
  }, [updateNodeData])

  const handleDeleteNode = useCallback((id: string) => {
    deleteElements({ nodes: [{ id }] })
    toast.info('Node deleted')
  }, [deleteElements])

  // Keyboard delete for selected nodes/edges
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const selectedNodes = nodes.filter(n => n.selected).map(n => ({ id: n.id }))
      const selectedEdges = edges.filter(ed => ed.selected).map(ed => ({ id: ed.id }))
      if (selectedNodes.length || selectedEdges.length) {
        deleteElements({ nodes: selectedNodes, edges: selectedEdges })
        if (selectedNodes.some(n => n.id === configNodeId)) setConfigNodeId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodes, edges, deleteElements, configNodeId])

  return (
    <NodeDetailProvider value={openPanel}>
      <div className="flex flex-col h-screen bg-[#0f1117] overflow-hidden">

        {/* ── Toolbar ── */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-[#2e3350] bg-[#13151f] shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-100">Flow Builder</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Build your scraping pipeline — hover nodes for actions, click <span className="text-indigo-400">Setup Logic</span> to configure.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-[#2e3350] hover:border-[#3d4470] hover:text-slate-200 bg-[#1a1d27] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/40"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Run Flow
          </button>
        </header>

        {/* ── Main ── */}
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />

          <div ref={reactFlowWrapper} className="flex-1 relative overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={null}
              defaultEdgeOptions={{ type: 'custom', animated: true }}
              style={{ background: '#0f1117' }}
            >
              <Background variant={BackgroundVariant.Dots} color="#2e3350" gap={20} size={1.2} />
              <Controls style={{ background: '#13151f', border: '1px solid #2e3350', borderRadius: 8 }} />
              <MiniMap
                style={{ background: '#13151f', border: '1px solid #2e3350', borderRadius: 8 }}
                nodeColor={(n) => ({
                  source:    '#6366f1',
                  category:  '#8b5cf6',
                  movieList: '#10b981',
                  detail:    '#f59e0b',
                  export:    '#64748b',
                })[n.type ?? ''] ?? '#334155'}
                maskColor="rgba(15,17,23,0.7)"
              />
            </ReactFlow>

            {/* Config Panel overlay */}
            <NodeConfigPanel
              nodeId={configNodeId}
              nodes={nodes}
              defaultTab={configTab}
              onClose={() => { setConfigNodeId(null); setConfigTab('config') }}
              onUpdateNodeData={handleUpdateNodeData}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        </div>
      </div>
    </NodeDetailProvider>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
