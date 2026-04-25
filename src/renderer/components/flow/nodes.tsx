import React, { useState, useCallback, useContext, createContext } from 'react'
import type { NodeExecStatus } from '../../../lib/ipc'
import {
  Handle, Position, useReactFlow,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
  type NodeProps, type EdgeProps, type Node, type Edge,
} from '@xyflow/react'
import {
  Globe2, Zap, Cpu, Link2, List, FileSearch, Bot,
  Filter, Shuffle, Download, Webhook,
  Trash2, Copy, ChevronDown, ChevronUp, Settings2,
  X, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Node Detail Context ───────────────────────────────────────────────────────

type OpenDetailFn = (nodeId: string, tab?: 'config' | 'preview') => void

const NodeDetailContext = createContext<OpenDetailFn | null>(null)

// ─── Node Status Context ───────────────────────────────────────────────────────

const NodeStatusContext = createContext<Record<string, NodeExecStatus>>({})
export const NodeStatusProvider = NodeStatusContext.Provider

function useNodeStatus(nodeId: string): NodeExecStatus | null {
  const map = useContext(NodeStatusContext)
  return map[nodeId] ?? null
}
export const NodeDetailProvider = NodeDetailContext.Provider

export function useOpenDetail() {
  return useContext(NodeDetailContext)
}

// ─── Shared primitives ────────────────────────────────────────────────────────

export const inputCls =
  'nodrag nopan w-full bg-[#0f1117] border border-[#2e3350] rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors'

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      {children}
      {hint && <p className="text-[9px] text-slate-600 leading-tight">{hint}</p>}
    </div>
  )
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={cn(
        'nodrag nopan relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        value ? 'bg-indigo-600' : 'bg-[#2e3350]',
      )}
      onClick={() => onChange(!value)}
    >
      <span className={cn(
        'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
        value ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

const ACCENT_HEX: Record<string, string> = {
  indigo:  '#6366f1',
  blue:    '#3b82f6',
  cyan:    '#06b6d4',
  violet:  '#8b5cf6',
  purple:  '#a855f7',
  amber:   '#f59e0b',
  pink:    '#ec4899',
  orange:  '#f97316',
  yellow:  '#eab308',
  emerald: '#10b981',
  teal:    '#14b8a6',
  slate:   '#64748b',
}

function handleStyle(color: string): React.CSSProperties {
  const hex = ACCENT_HEX[color] ?? '#6366f1'
  return { background: hex, border: `2px solid ${hex}`, width: 10, height: 10 }
}

// ─── NodeWrapper ───────────────────────────────────────────────────────────────

interface NodeWrapperProps {
  id: string
  selected?: boolean
  accent: keyof typeof ACCENT_HEX
  accentClass: string
  icon: React.ElementType
  label: string
  category: 'input' | 'process' | 'output'
  children: React.ReactNode
  defaultCollapsed?: boolean
  statusBadge?: React.ReactNode
}

const STATUS_RING: Record<NodeExecStatus, string> = {
  running: 'ring-2 ring-yellow-400/70',
  success: 'ring-2 ring-emerald-500/70',
  failed:  'ring-2 ring-red-500/70',
  pending: '',
  skipped: 'ring-1 ring-slate-500/30',
}

const STATUS_BADGE: Record<NodeExecStatus, React.ReactNode> = {
  running: <span className="flex items-center gap-1 text-[9px] font-semibold text-yellow-300 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-1.5 py-0.5 animate-pulse">▶ Running</span>,
  success: <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-1.5 py-0.5">✓ Done</span>,
  failed:  <span className="flex items-center gap-1 text-[9px] font-semibold text-red-300 bg-red-400/10 border border-red-400/30 rounded-full px-1.5 py-0.5">✗ Error</span>,
  pending: <span className="text-[9px] font-semibold text-slate-500 px-1">…</span>,
  skipped: <span className="text-[9px] font-semibold text-slate-500 px-1">skip</span>,
}

export function NodeWrapper({
  id, selected, accent, accentClass, icon: Icon, label, children, defaultCollapsed = false, statusBadge,
}: NodeWrapperProps) {
  const { deleteElements, getNodes, addNodes } = useReactFlow()
  const openDetail  = useOpenDetail()
  const execStatus  = useNodeStatus(id)
  const [hovered,   setHovered]   = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const node = getNodes().find((n) => n.id === id)
    if (!node) return
    addNodes({
      ...node,
      id:       `${node.type}-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
    })
  }, [getNodes, addNodes, id])

  const hex = ACCENT_HEX[accent]
  const showActions = hovered || selected

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Floating action toolbar */}
      <div className={cn(
        'absolute -top-9 right-0 flex items-center gap-1 z-50 transition-all duration-150',
        showActions ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); openDetail?.(id, 'config') }}
          className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-indigo-300 bg-[#1a1d27] border border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-950/40 transition-colors"
        >
          <Settings2 className="w-3 h-3" /> Setup
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); openDetail?.(id, 'preview') }}
          className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-emerald-300 bg-[#1a1d27] border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/40 transition-colors"
        >
          <Eye className="w-3 h-3" /> Preview
        </button>
        <button
          onClick={handleDuplicate}
          className="nodrag nopan flex items-center justify-center w-6 h-6 rounded-md text-slate-400 bg-[#1a1d27] border border-[#2e3350] hover:border-slate-400 hover:text-slate-200 transition-colors"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-red-400 bg-[#1a1d27] border border-[#2e3350] hover:border-red-500 hover:bg-red-950/40 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>

      {/* Node card */}
      <div
        className={cn(
          'w-64 bg-[#13151f] rounded-xl shadow-xl overflow-hidden transition-all duration-150',
          selected ? 'border-2' : hovered ? 'border border-[#3d4470]' : 'border border-[#2e3350]',
          execStatus ? STATUS_RING[execStatus] : '',
        )}
        style={selected ? { borderColor: hex, boxShadow: `0 6px 24px ${hex}40` } : undefined}
      >
        <div className={cn('flex items-center gap-2 px-3 py-2.5', accentClass)}>
          <Icon className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="text-[11px] font-bold text-white tracking-widest uppercase flex-1 truncate">{label}</span>
          {execStatus ? STATUS_BADGE[execStatus] : statusBadge}
          <span className="text-[9px] text-white/50 font-mono shrink-0">#{id.split('-').slice(-1)[0]}</span>
          <button
            className="nodrag nopan ml-0.5 text-white/60 hover:text-white transition-colors shrink-0"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
        {!collapsed && children}
      </div>
    </div>
  )
}

// ─── Data interfaces ───────────────────────────────────────────────────────────

export interface BrowserSourceData {
  url:        string
  headless:   boolean
  userAgent:  string
  delayMs:    number
  cookies?:   string
}

export interface HttpSourceData {
  url:     string
  method:  'GET' | 'POST'
  headers: string
  body:    string
}

export interface ApiSourceData {
  url:       string
  method:    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers:   string
  body:      string
  authType:  'none' | 'bearer' | 'api-key'
  authValue: string
  dataPath:  string
  maxPages:  number
  pageParam: string
}

export interface LinkExtractorData {
  selector:      string
  filterPattern: string
  limit:         number
  textSelector:  string
}

export interface ListScraperData {
  itemSelector:     string
  nextPageSelector: string
  maxPages:         number
  maxItems:         number
}

export interface FieldExtractorData {
  fields:   DetailField[]
  urlField: string
  headless: boolean
  delayMs:  number
}

export interface DetailField {
  id:       string
  label:    string
  selector: string
  attrName: string
  type:     'text' | 'attr' | 'html'
}

export interface AIExtractorData {
  instruction: string
  fields:      Array<{ id: string; label: string }>
  inputField:  string
  model:       string
}

export interface FilterData {
  conditions: Array<{ id: string; field: string; operator: string; value: string }>
  logic:      'AND' | 'OR'
}

export interface TransformData {
  renames:  Array<{ from: string; to: string }>
  omit:     string
  computed: Array<{ id: string; label: string; expression: string }>
}

export interface FileExportData {
  outputDir:   string
  exportJson:  boolean
  exportExcel: boolean
  exportCsv:   boolean
  filename:    string
}

export interface WebhookData {
  url:       string
  method:    'POST' | 'PUT' | 'PATCH'
  headers:   string
  batchSize: number
}

// ─── Default field list for field-extractor ───────────────────────────────────

export const DEFAULT_DETAIL_FIELDS: DetailField[] = [
  { id: 'title',       label: 'Title',       selector: '', attrName: '', type: 'text' },
  { id: 'description', label: 'Description', selector: '', attrName: '', type: 'text' },
  { id: 'url',         label: 'URL',         selector: '', attrName: 'href', type: 'attr' },
  { id: 'image',       label: 'Image',       selector: '', attrName: 'src',  type: 'attr' },
  { id: 'date',        label: 'Date',        selector: '', attrName: '', type: 'text' },
  { id: 'author',      label: 'Author',      selector: '', attrName: '', type: 'text' },
]

// ─── Default node data ────────────────────────────────────────────────────────

export const defaultNodeData: Record<string, object> = {
  'browser-source': {
    url: '', headless: true, userAgent: '', delayMs: 500, cookies: '',
  } satisfies BrowserSourceData,
  'http-source': {
    url: '', method: 'GET', headers: '{}', body: '',
  } satisfies HttpSourceData,
  'api-source': {
    url: '', method: 'GET', headers: '{}', body: '', authType: 'none', authValue: '',
    dataPath: '', maxPages: 1, pageParam: 'page',
  } satisfies ApiSourceData,
  'link-extractor': {
    selector: 'a[href]', filterPattern: '', limit: 200, textSelector: '',
  } satisfies LinkExtractorData,
  'list-scraper': {
    itemSelector: '', nextPageSelector: '', maxPages: 5, maxItems: 100,
  } satisfies ListScraperData,
  'field-extractor': {
    fields: DEFAULT_DETAIL_FIELDS.map((f) => ({ ...f })),
    urlField: '_url', headless: true, delayMs: 300,
  } satisfies FieldExtractorData,
  'ai-extractor': {
    instruction: 'Extract the main content from this page', fields: [], inputField: '_html', model: 'gpt-4o-mini',
  } satisfies AIExtractorData,
  'filter': {
    conditions: [{ id: 'c1', field: '', operator: 'exists', value: '' }], logic: 'AND',
  } satisfies FilterData,
  'transform': {
    renames: [], omit: '', computed: [],
  } satisfies TransformData,
  'file-export': {
    outputDir: '', exportJson: true, exportExcel: false, exportCsv: true, filename: 'output',
  } satisfies FileExportData,
  'webhook': {
    url: '', method: 'POST', headers: '{}', batchSize: 100,
  } satisfies WebhookData,
}

// ─── Browser Source Node ──────────────────────────────────────────────────────

export function BrowserSourceNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as BrowserSourceData

  return (
    <NodeWrapper id={id} selected={selected} accent="indigo" accentClass="bg-indigo-600" icon={Globe2} label="Browser Source" category="input">
      <div className="p-3 space-y-2.5">
        <Field label="URL" hint="Page to open in Chromium">
          <input className={inputCls} placeholder="https://example.com" value={d.url}
            onChange={e => updateNodeData(id, { url: e.target.value })} />
        </Field>
        <div className="flex items-center justify-between">
          <Field label="Headless">
            <Toggle value={d.headless} onChange={v => updateNodeData(id, { headless: v })} />
          </Field>
          <Field label="Delay (ms)">
            <input type="number" className={cn(inputCls, 'w-20')} value={d.delayMs} min={0} step={100}
              onChange={e => updateNodeData(id, { delayMs: +e.target.value })} />
          </Field>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('indigo')} />
    </NodeWrapper>
  )
}

// ─── HTTP Source Node ─────────────────────────────────────────────────────────

export function HttpSourceNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as HttpSourceData

  return (
    <NodeWrapper id={id} selected={selected} accent="blue" accentClass="bg-blue-600" icon={Zap} label="HTTP Source" category="input">
      <div className="p-3 space-y-2.5">
        <Field label="URL">
          <input className={inputCls} placeholder="https://api.example.com/data" value={d.url}
            onChange={e => updateNodeData(id, { url: e.target.value })} />
        </Field>
        <Field label="Method">
          <select className={inputCls} value={d.method}
            onChange={e => updateNodeData(id, { method: e.target.value })}>
            {['GET', 'POST'].map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('blue')} />
    </NodeWrapper>
  )
}

// ─── API Source Node ──────────────────────────────────────────────────────────

export function ApiSourceNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as ApiSourceData

  return (
    <NodeWrapper id={id} selected={selected} accent="cyan" accentClass="bg-cyan-600" icon={Cpu} label="API Source" category="input">
      <div className="p-3 space-y-2.5">
        <Field label="Endpoint URL">
          <input className={inputCls} placeholder="https://api.example.com/v1/items" value={d.url}
            onChange={e => updateNodeData(id, { url: e.target.value })} />
        </Field>
        <div className="flex gap-2">
          <Field label="Method">
            <select className={inputCls} value={d.method}
              onChange={e => updateNodeData(id, { method: e.target.value })}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Auth">
            <select className={inputCls} value={d.authType}
              onChange={e => updateNodeData(id, { authType: e.target.value })}>
              {['none', 'bearer', 'api-key'].map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>
        </div>
        {d.authType !== 'none' && (
          <Field label={d.authType === 'bearer' ? 'Bearer token' : 'API key'}>
            <input className={inputCls} type="password" placeholder="sk-…" value={d.authValue}
              onChange={e => updateNodeData(id, { authValue: e.target.value })} />
          </Field>
        )}
        <Field label="Data path" hint="e.g. data.items or results">
          <input className={inputCls} placeholder="data" value={d.dataPath}
            onChange={e => updateNodeData(id, { dataPath: e.target.value })} />
        </Field>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('cyan')} />
    </NodeWrapper>
  )
}

// ─── Link Extractor Node ──────────────────────────────────────────────────────

export function LinkExtractorNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as LinkExtractorData

  return (
    <NodeWrapper id={id} selected={selected} accent="violet" accentClass="bg-violet-600" icon={Link2} label="Link Extractor" category="process">
      <Handle type="target" position={Position.Left} style={handleStyle('violet')} />
      <div className="p-3 space-y-2.5">
        <Field label="CSS Selector" hint="Selects which links to extract">
          <input className={inputCls} placeholder="a[href], nav a" value={d.selector}
            onChange={e => updateNodeData(id, { selector: e.target.value })} />
        </Field>
        <Field label="Filter pattern" hint="Regex to filter URLs (optional)">
          <input className={inputCls} placeholder="/products/" value={d.filterPattern}
            onChange={e => updateNodeData(id, { filterPattern: e.target.value })} />
        </Field>
        <Field label="Max links">
          <input type="number" className={inputCls} value={d.limit} min={1}
            onChange={e => updateNodeData(id, { limit: +e.target.value })} />
        </Field>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('violet')} />
    </NodeWrapper>
  )
}

// ─── List Scraper Node ────────────────────────────────────────────────────────

export function ListScraperNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as ListScraperData

  return (
    <NodeWrapper id={id} selected={selected} accent="purple" accentClass="bg-purple-600" icon={List} label="List Scraper" category="process">
      <Handle type="target" position={Position.Left} style={handleStyle('purple')} />
      <div className="p-3 space-y-2.5">
        <Field label="Item selector" hint="CSS selector for each list item">
          <input className={inputCls} placeholder=".product-card a, li.item" value={d.itemSelector}
            onChange={e => updateNodeData(id, { itemSelector: e.target.value })} />
        </Field>
        <Field label="Next page selector">
          <input className={inputCls} placeholder="a.next, .pagination-next" value={d.nextPageSelector}
            onChange={e => updateNodeData(id, { nextPageSelector: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max pages">
            <input type="number" className={inputCls} value={d.maxPages} min={1}
              onChange={e => updateNodeData(id, { maxPages: +e.target.value })} />
          </Field>
          <Field label="Max items">
            <input type="number" className={inputCls} value={d.maxItems} min={1}
              onChange={e => updateNodeData(id, { maxItems: +e.target.value })} />
          </Field>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('purple')} />
    </NodeWrapper>
  )
}

// ─── Field Extractor Node ─────────────────────────────────────────────────────

export function FieldExtractorNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d  = data as unknown as FieldExtractorData
  const fields = d.fields ?? DEFAULT_DETAIL_FIELDS
  const configured = fields.filter((f) => f.selector.trim()).length

  return (
    <NodeWrapper id={id} selected={selected} accent="amber" accentClass="bg-amber-600" icon={FileSearch} label="Field Extractor" category="process">
      <Handle type="target" position={Position.Left} style={handleStyle('amber')} />
      <div className="p-3 space-y-2 nodrag nopan">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-slate-500">CSS selectors per field</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
            configured > 0 ? 'bg-amber-600/20 text-amber-300' : 'bg-[#1a1d27] text-slate-500',
          )}>
            {configured}/{fields.length}
          </span>
        </div>
        {fields.slice(0, 4).map((field) => (
          <div key={field.id} className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-500 w-14 shrink-0 truncate uppercase tracking-wide">{field.label}</span>
            <input
              className={cn(inputCls, 'flex-1')}
              placeholder={`selector…`}
              value={field.selector}
              onChange={e => updateNodeData(id, {
                fields: fields.map((f) => f.id === field.id ? { ...f, selector: e.target.value } : f),
              })}
            />
          </div>
        ))}
        {fields.length > 4 && (
          <p className="text-[9px] text-slate-600 text-center">+{fields.length - 4} more — open Setup panel</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('amber')} />
    </NodeWrapper>
  )
}

// ─── AI Extractor Node ────────────────────────────────────────────────────────

export function AIExtractorNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as AIExtractorData

  return (
    <NodeWrapper id={id} selected={selected} accent="pink" accentClass="bg-pink-600" icon={Bot} label="AI Extractor" category="process">
      <Handle type="target" position={Position.Left} style={handleStyle('pink')} />
      <div className="p-3 space-y-2.5">
        <Field label="Instruction" hint="Tell AI what to extract">
          <textarea
            className={cn(inputCls, 'resize-none h-16')}
            placeholder="Extract the product name, price, and description from each page…"
            value={d.instruction}
            onChange={e => updateNodeData(id, { instruction: e.target.value })}
          />
        </Field>
        <Field label="Model">
          <select className={inputCls} value={d.model}
            onChange={e => updateNodeData(id, { model: e.target.value })}>
            {['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'].map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <div className="rounded-lg bg-pink-600/10 border border-pink-500/20 px-3 py-2">
          <p className="text-[10px] text-pink-300">Requires AI API key in Settings</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('pink')} />
    </NodeWrapper>
  )
}

// ─── Filter Node ──────────────────────────────────────────────────────────────

export function FilterNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as FilterData
  const conditions = d.conditions ?? []

  const OPERATORS = ['exists', 'notExists', 'equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'gt', 'lt']

  return (
    <NodeWrapper id={id} selected={selected} accent="orange" accentClass="bg-orange-600" icon={Filter} label="Filter" category="process">
      <Handle type="target" position={Position.Left} style={handleStyle('orange')} />
      <div className="p-3 space-y-2 nodrag nopan">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-slate-500">Match</span>
          <select
            className={cn(inputCls, 'w-16')}
            value={d.logic}
            onChange={e => updateNodeData(id, { logic: e.target.value })}
          >
            <option>AND</option>
            <option>OR</option>
          </select>
          <span className="text-[10px] text-slate-500">conditions</span>
        </div>
        {conditions.slice(0, 3).map((cond, i) => (
          <div key={cond.id} className="grid grid-cols-3 gap-1">
            <input className={inputCls} placeholder="field" value={cond.field}
              onChange={e => updateNodeData(id, { conditions: conditions.map((c, ci) => ci === i ? { ...c, field: e.target.value } : c) })} />
            <select className={inputCls} value={cond.operator}
              onChange={e => updateNodeData(id, { conditions: conditions.map((c, ci) => ci === i ? { ...c, operator: e.target.value } : c) })}>
              {OPERATORS.map(o => <option key={o}>{o}</option>)}
            </select>
            <input className={inputCls} placeholder="value" value={cond.value}
              onChange={e => updateNodeData(id, { conditions: conditions.map((c, ci) => ci === i ? { ...c, value: e.target.value } : c) })} />
          </div>
        ))}
        {conditions.length > 3 && (
          <p className="text-[9px] text-slate-600 text-center">+{conditions.length - 3} more in Setup panel</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('orange')} />
    </NodeWrapper>
  )
}

// ─── Transform Node ───────────────────────────────────────────────────────────

export function TransformNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as TransformData
  const renames  = d.renames  ?? []
  const computed = d.computed ?? []

  return (
    <NodeWrapper id={id} selected={selected} accent="yellow" accentClass="bg-yellow-600" icon={Shuffle} label="Transform" category="process">
      <Handle type="target" position={Position.Left} style={handleStyle('yellow')} />
      <div className="p-3 space-y-2.5">
        <Field label="Rename fields" hint="from → to, one per line">
          <textarea
            className={cn(inputCls, 'resize-none h-14 font-mono')}
            placeholder={'title → name\nprice → cost'}
            value={renames.map(r => `${r.from} → ${r.to}`).join('\n')}
            onChange={e => {
              const parsed = e.target.value.split('\n').map(line => {
                const [from, to] = line.split('→').map(s => s.trim())
                return { from: from ?? '', to: to ?? '' }
              }).filter(r => r.from && r.to)
              updateNodeData(id, { renames: parsed })
            }}
          />
        </Field>
        <Field label="Omit fields" hint="Comma-separated field names to remove">
          <input className={inputCls} placeholder="_html, _raw" value={d.omit ?? ''}
            onChange={e => updateNodeData(id, { omit: e.target.value })} />
        </Field>
        {computed.length > 0 && (
          <p className="text-[9px] text-slate-600">{computed.length} computed field{computed.length !== 1 ? 's' : ''}</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('yellow')} />
    </NodeWrapper>
  )
}

// ─── File Export Node ─────────────────────────────────────────────────────────

export function FileExportNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as FileExportData

  const browse = async () => {
    const dir = await window.electronAPI.selectFolder()
    if (dir) updateNodeData(id, { outputDir: dir })
  }

  const formats = [
    { key: 'exportJson'  as const, label: 'JSON'  },
    { key: 'exportExcel' as const, label: 'Excel' },
    { key: 'exportCsv'   as const, label: 'CSV'   },
  ]
  const active = formats.filter((f) => d[f.key]).map((f) => f.label)

  return (
    <NodeWrapper id={id} selected={selected} accent="emerald" accentClass="bg-emerald-600" icon={Download} label="File Export" category="output">
      <Handle type="target" position={Position.Left} style={handleStyle('emerald')} />
      <div className="p-3 space-y-2.5">
        <Field label="Output folder">
          <div className="flex gap-1.5">
            <input className={cn(inputCls, 'flex-1 min-w-0')} placeholder="/path/to/output" value={d.outputDir}
              onChange={e => updateNodeData(id, { outputDir: e.target.value })} />
            <button className="nodrag nopan shrink-0 px-2 py-1.5 rounded-md bg-[#1a1d27] border border-[#2e3350] text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500 transition-colors"
              onClick={browse}>…</button>
          </div>
        </Field>
        <Field label="Formats">
          <div className="flex gap-2">
            {formats.map(({ key, label }) => (
              <label key={key} className="nodrag nopan flex items-center gap-1.5 cursor-pointer">
                <Toggle value={d[key]} onChange={v => updateNodeData(id, { [key]: v })} />
                <span className="text-xs text-slate-400">{label}</span>
              </label>
            ))}
          </div>
        </Field>
        {active.length === 0 && (
          <p className="text-[10px] text-amber-400">Enable at least one format</p>
        )}
      </div>
    </NodeWrapper>
  )
}

// ─── Webhook Node ─────────────────────────────────────────────────────────────

export function WebhookNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as WebhookData

  return (
    <NodeWrapper id={id} selected={selected} accent="teal" accentClass="bg-teal-600" icon={Webhook} label="Webhook" category="output">
      <Handle type="target" position={Position.Left} style={handleStyle('teal')} />
      <div className="p-3 space-y-2.5">
        <Field label="Endpoint URL">
          <input className={inputCls} placeholder="https://your-server.com/webhook" value={d.url}
            onChange={e => updateNodeData(id, { url: e.target.value })} />
        </Field>
        <div className="flex gap-2">
          <Field label="Method">
            <select className={inputCls} value={d.method}
              onChange={e => updateNodeData(id, { method: e.target.value })}>
              {['POST', 'PUT', 'PATCH'].map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Batch size">
            <input type="number" className={cn(inputCls, 'w-20')} value={d.batchSize} min={1}
              onChange={e => updateNodeData(id, { batchSize: +e.target.value })} />
          </Field>
        </div>
      </div>
    </NodeWrapper>
  )
}

// ─── Custom Edge ──────────────────────────────────────────────────────────────

export function CustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [hovered, setHovered] = useState(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const showDelete = hovered || selected

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke:      selected ? '#818cf8' : hovered ? '#a5b4fc' : '#6366f1',
          strokeWidth: hovered || selected ? 3 : 2,
          transition:  'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      <path
        d={edgePath} fill="none" strokeWidth={16} stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position:  'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity:   showDelete ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            onClick={() => deleteElements({ edges: [{ id }] })}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1a1d27] border border-red-500/60 text-red-400 hover:bg-red-950/60 hover:border-red-400 shadow-lg transition-all"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

// ─── Registry ──────────────────────────────────────────────────────────────────

export const nodeTypes = {
  'browser-source':  BrowserSourceNode,
  'http-source':     HttpSourceNode,
  'api-source':      ApiSourceNode,
  'link-extractor':  LinkExtractorNode,
  'list-scraper':    ListScraperNode,
  'field-extractor': FieldExtractorNode,
  'ai-extractor':    AIExtractorNode,
  'filter':          FilterNode,
  'transform':       TransformNode,
  'file-export':     FileExportNode,
  'webhook':         WebhookNode,
} as const

export const edgeTypes = {
  custom: CustomEdge,
} as const

// ─── Palette config ───────────────────────────────────────────────────────────

export const PALETTE_GROUPS = [
  {
    label: 'Input',
    nodes: [
      { type: 'browser-source', label: 'Browser Source', icon: Globe2, color: 'bg-indigo-600', desc: 'Chromium, JS-rendered pages' },
      { type: 'http-source',    label: 'HTTP Source',    icon: Zap,    color: 'bg-blue-600',   desc: 'Fast static HTML fetch'    },
      { type: 'api-source',     label: 'API Source',     icon: Cpu,    color: 'bg-cyan-600',   desc: 'REST/JSON API endpoint'    },
    ],
  },
  {
    label: 'Process',
    nodes: [
      { type: 'link-extractor',  label: 'Link Extractor',  icon: Link2,     color: 'bg-violet-600', desc: 'Extract links by CSS selector' },
      { type: 'list-scraper',    label: 'List Scraper',    icon: List,      color: 'bg-purple-600', desc: 'Paginate & collect items'      },
      { type: 'field-extractor', label: 'Field Extractor', icon: FileSearch, color: 'bg-amber-600',  desc: 'Extract fields per URL'        },
      { type: 'ai-extractor',    label: 'AI Extractor',    icon: Bot,       color: 'bg-pink-600',   desc: 'AI-powered data extraction'   },
      { type: 'filter',          label: 'Filter',          icon: Filter,    color: 'bg-orange-600', desc: 'Filter records by conditions'  },
      { type: 'transform',       label: 'Transform',       icon: Shuffle,   color: 'bg-yellow-600', desc: 'Rename, omit, compute fields'  },
    ],
  },
  {
    label: 'Output',
    nodes: [
      { type: 'file-export', label: 'File Export', icon: Download, color: 'bg-emerald-600', desc: 'Save JSON, CSV, Excel'   },
      { type: 'webhook',     label: 'Webhook',     icon: Webhook,  color: 'bg-teal-600',    desc: 'POST records to an URL' },
    ],
  },
] as const

// Flat list for backward compat with any code that imports PALETTE_NODES
export interface PaletteNodeMeta {
  type:  string
  label: string
  icon:  React.ComponentType<{ className?: string }>
  color: string
  desc:  string
}

export const PALETTE_NODES: PaletteNodeMeta[] = PALETTE_GROUPS.flatMap(
  (g) => g.nodes as unknown as PaletteNodeMeta[],
)

// ─── Default pipeline (starter workflow) ─────────────────────────────────────

export const INITIAL_NODES: Node[] = [
  { id: 'browser-source-1',  type: 'browser-source',  position: { x: 40,   y: 120 }, data: { ...defaultNodeData['browser-source'] }  },
  { id: 'link-extractor-1',  type: 'link-extractor',  position: { x: 380,  y: 60  }, data: { ...defaultNodeData['link-extractor'] }  },
  { id: 'field-extractor-1', type: 'field-extractor', position: { x: 720,  y: 20  }, data: { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })), urlField: '_url', headless: true, delayMs: 300 } },
  { id: 'file-export-1',     type: 'file-export',     position: { x: 1060, y: 80  }, data: { ...defaultNodeData['file-export'] }     },
]

export const INITIAL_EDGES: Edge[] = [
  { id: 'e-src-ext',  source: 'browser-source-1',  target: 'link-extractor-1',  type: 'custom', animated: true },
  { id: 'e-ext-fld',  source: 'link-extractor-1',  target: 'field-extractor-1', type: 'custom', animated: true },
  { id: 'e-fld-exp',  source: 'field-extractor-1', target: 'file-export-1',     type: 'custom', animated: true },
]

// ─── Sample data for Preview tab ─────────────────────────────────────────────

export function getSampleData(nodeType: string, nodeData: unknown): unknown {
  switch (nodeType) {
    case 'browser-source':
    case 'http-source': {
      const d = nodeData as { url?: string }
      return [{ _url: d.url || 'https://example.com', _html: '<html><body>…page content…</body></html>', _status: 200 }]
    }
    case 'api-source':
      return [{ id: 1, name: 'Item A', price: 29.99 }, { id: 2, name: 'Item B', price: 49.99 }]
    case 'link-extractor':
      return [
        { url: 'https://example.com/product/1', text: 'Widget Pro',   _sourceUrl: 'https://example.com' },
        { url: 'https://example.com/product/2', text: 'Widget Basic', _sourceUrl: 'https://example.com' },
        { url: 'https://example.com/product/3', text: 'Widget Ultra', _sourceUrl: 'https://example.com' },
      ]
    case 'list-scraper':
      return [
        { url: 'https://example.com/product/1', text: 'Widget Pro',   _page: 1 },
        { url: 'https://example.com/product/2', text: 'Widget Basic', _page: 1 },
        { url: 'https://example.com/product/3', text: 'Widget Ultra', _page: 2 },
      ]
    case 'field-extractor': {
      const d = nodeData as FieldExtractorData
      const fields = d?.fields ?? DEFAULT_DETAIL_FIELDS
      const sample: Record<string, unknown> = { _url: 'https://example.com/product/1' }
      const SAMPLES: Record<string, unknown> = {
        title: 'Widget Pro 3000', description: 'The best widget ever made.', url: '/product/widget-pro',
        image: 'https://example.com/images/widget-pro.jpg', date: '2024-01-15', author: 'Jane Smith',
      }
      for (const f of fields) sample[f.id] = SAMPLES[f.id] ?? `<${f.label} value>`
      return [sample]
    }
    case 'ai-extractor':
      return [{ title: 'Product Name', price: '$29.99', description: 'AI-extracted description', _ai: true }]
    case 'filter':
      return [{ title: 'Widget Pro', price: '$29.99' }, { title: 'Widget Basic', price: '$9.99' }]
    case 'transform':
      return [{ name: 'Widget Pro', cost: '$29.99' }]
    case 'file-export': {
      const d = nodeData as FileExportData
      const formats = [d?.exportJson && 'json', d?.exportExcel && 'xlsx', d?.exportCsv && 'csv'].filter(Boolean)
      return { outputDir: d?.outputDir || '/output', files: formats.map(ext => `output_2024-01-15.${ext}`), totalRecords: 42 }
    }
    case 'webhook':
      return { sent: 42, success: true, statusCode: 200, batches: 1 }
    default:
      return {}
  }
}
