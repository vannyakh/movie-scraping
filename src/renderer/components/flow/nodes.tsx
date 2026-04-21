import React, { useState, useCallback, useContext, createContext } from 'react'
import {
  Handle, Position, useReactFlow,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
  type NodeProps, type EdgeProps,
} from '@xyflow/react'
import {
  Globe2, Layers, List, FileSearch, Download,
  Trash2, Copy, ChevronDown, ChevronUp, Settings2,
  Plus, X, GripVertical, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Node Detail Context ───────────────────────────────────────────────────────
// Lets nodes call "open config panel" without prop-drilling through ReactFlow

type OpenDetailFn = (nodeId: string) => void

const NodeDetailContext = createContext<OpenDetailFn | null>(null)

export const NodeDetailProvider = NodeDetailContext.Provider

function useOpenDetail() {
  return useContext(NodeDetailContext)
}

// ─── Shared ────────────────────────────────────────────────────────────────────

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

function handleStyle(color: string): React.CSSProperties {
  const map: Record<string, string> = {
    indigo:  '#6366f1',
    violet:  '#8b5cf6',
    emerald: '#10b981',
    amber:   '#f59e0b',
    slate:   '#64748b',
  }
  const hex = map[color] ?? '#6366f1'
  return { background: hex, border: `2px solid ${hex}`, width: 10, height: 10 }
}

const ACCENT_HEX: Record<string, string> = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  slate:   '#64748b',
}

// ─── NodeWrapper ───────────────────────────────────────────────────────────────

interface NodeWrapperProps {
  id: string
  selected?: boolean
  accent: keyof typeof ACCENT_HEX
  accentClass: string
  icon: React.ElementType
  label: string
  children: React.ReactNode
  defaultCollapsed?: boolean
}

export function NodeWrapper({
  id, selected, accent, accentClass, icon: Icon, label, children, defaultCollapsed = false,
}: NodeWrapperProps) {
  const { deleteElements, getNodes, addNodes } = useReactFlow()
  const openDetail = useOpenDetail()
  const [hovered, setHovered] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const node = getNodes().find(n => n.id === id)
    if (!node) return
    addNodes({
      ...node,
      id: `${node.type}-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
    })
  }, [getNodes, addNodes, id])

  const handleConfigure = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openDetail?.(id)
  }, [openDetail, id])

  const hex = ACCENT_HEX[accent]
  const showActions = hovered || selected

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Floating action toolbar ── */}
      <div className={cn(
        'absolute -top-9 right-0 flex items-center gap-1 z-50 transition-all duration-150',
        showActions ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}>
        <button
          onClick={handleConfigure}
          className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-indigo-300 bg-[#1a1d27] border border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-950/40 transition-colors whitespace-nowrap"
        >
          <Settings2 className="w-3 h-3" />
          Setup Logic
        </button>
        <button
          onClick={handleDuplicate}
          title="Clone node"
          className="nodrag nopan flex items-center justify-center w-6 h-6 rounded-md text-slate-400 bg-[#1a1d27] border border-[#2e3350] hover:border-slate-400 hover:text-slate-200 transition-colors"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          title="Delete node"
          className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-red-400 bg-[#1a1d27] border border-[#2e3350] hover:border-red-500 hover:bg-red-950/40 transition-colors whitespace-nowrap"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>

      {/* ── Node card ── */}
      <div
        className={cn(
          'w-72 bg-[#13151f] rounded-xl shadow-xl overflow-hidden transition-all duration-150',
          selected ? 'border-2' : hovered ? 'border border-[#3d4470]' : 'border border-[#2e3350]',
        )}
        style={selected ? { borderColor: hex, boxShadow: `0 6px 24px ${hex}40` } : undefined}
      >
        {/* Header */}
        <div className={cn('flex items-center gap-2 px-3 py-2.5', accentClass)}>
          <Icon className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="text-[11px] font-bold text-white tracking-widest uppercase flex-1">{label}</span>
          <span className="text-[9px] text-white/50 font-mono">#{id.split('-').slice(-1)[0]}</span>
          <button
            className="nodrag nopan ml-1 text-white/60 hover:text-white transition-colors"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronUp className="w-3.5 h-3.5" />
            }
          </button>
        </div>

        {/* Body */}
        {!collapsed && children}
      </div>
    </div>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SourceData {
  baseUrl:   string
  headless:  boolean
  delayMs:   number
  userAgent: string
}

export interface CategoryData {
  selector: string
}

export interface MovieListData {
  movieSelector:    string
  nextPageSelector: string
  maxPages:         number
  maxMovies:        number
}

export interface DetailField {
  id:       string
  label:    string
  selector: string
}

export interface DetailData {
  fields: DetailField[]
}

export interface ExportData {
  outputDir:   string
  exportJson:  boolean
  exportExcel: boolean
  exportCsv:   boolean
}

// ─── Source Node ───────────────────────────────────────────────────────────────

export function SourceNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as SourceData

  return (
    <NodeWrapper id={id} selected={selected} accent="indigo" accentClass="bg-indigo-600" icon={Globe2} label="Source">
      <div className="p-3 space-y-2.5">
        <Field label="Base URL" hint="The site homepage to start from">
          <input
            className={inputCls}
            placeholder="https://example.com"
            value={d.baseUrl}
            onChange={e => updateNodeData(id, { baseUrl: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Delay (ms)">
            <input
              type="number"
              className={inputCls}
              value={d.delayMs}
              min={0}
              step={100}
              onChange={e => updateNodeData(id, { delayMs: +e.target.value })}
            />
          </Field>
          <Field label="Headless">
            <div className="flex items-center gap-2 pt-1">
              <Toggle value={d.headless} onChange={v => updateNodeData(id, { headless: v })} />
              <span className="text-xs text-slate-400">{d.headless ? 'Yes' : 'No'}</span>
            </div>
          </Field>
        </div>
        <Field label="User Agent" hint="Leave blank for default Chrome UA">
          <input
            className={inputCls}
            placeholder="Mozilla/5.0 …"
            value={d.userAgent}
            onChange={e => updateNodeData(id, { userAgent: e.target.value })}
          />
        </Field>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('indigo')} />
    </NodeWrapper>
  )
}

// ─── Category Node ─────────────────────────────────────────────────────────────

export function CategoryNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as CategoryData

  return (
    <NodeWrapper id={id} selected={selected} accent="violet" accentClass="bg-violet-600" icon={Layers} label="Categories">
      <Handle type="target" position={Position.Left} style={handleStyle('violet')} />
      <div className="p-3 space-y-2.5">
        <Field label="Category Link Selector" hint="Leave blank to auto-detect nav patterns">
          <input
            className={inputCls}
            placeholder="nav a[href], .genre-menu a"
            value={d.selector}
            onChange={e => updateNodeData(id, { selector: e.target.value })}
          />
        </Field>
        <div className="rounded-lg bg-violet-600/10 border border-violet-500/20 px-3 py-2">
          <p className="text-[10px] text-violet-300 leading-relaxed">
            Scrapes category links from the homepage. Auto-detection finds common nav patterns when left blank.
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('violet')} />
    </NodeWrapper>
  )
}

// ─── Movie List Node ───────────────────────────────────────────────────────────

export function MovieListNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as MovieListData

  return (
    <NodeWrapper id={id} selected={selected} accent="emerald" accentClass="bg-emerald-600" icon={List} label="Movie List">
      <Handle type="target" position={Position.Left} style={handleStyle('emerald')} />
      <div className="p-3 space-y-2.5">
        <Field label="Movie Item Selector" hint="CSS selector for each movie card/link">
          <input
            className={inputCls}
            placeholder=".movie-item a, article.film a"
            value={d.movieSelector}
            onChange={e => updateNodeData(id, { movieSelector: e.target.value })}
          />
        </Field>
        <Field label="Next Page Selector" hint="CSS selector for pagination next button">
          <input
            className={inputCls}
            placeholder="a.next, .pagination .next a"
            value={d.nextPageSelector}
            onChange={e => updateNodeData(id, { nextPageSelector: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max Pages">
            <input
              type="number"
              className={inputCls}
              value={d.maxPages}
              min={1}
              onChange={e => updateNodeData(id, { maxPages: +e.target.value })}
            />
          </Field>
          <Field label="Max Movies">
            <input
              type="number"
              className={inputCls}
              value={d.maxMovies}
              min={1}
              onChange={e => updateNodeData(id, { maxMovies: +e.target.value })}
            />
          </Field>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('emerald')} />
    </NodeWrapper>
  )
}

// ─── Detail Node ───────────────────────────────────────────────────────────────

export const DEFAULT_DETAIL_FIELDS: DetailField[] = [
  { id: 'title',       label: 'Title',       selector: '' },
  { id: 'year',        label: 'Year',        selector: '' },
  { id: 'rating',      label: 'Rating',      selector: '' },
  { id: 'duration',    label: 'Duration',    selector: '' },
  { id: 'director',    label: 'Director',    selector: '' },
  { id: 'description', label: 'Description', selector: '' },
  { id: 'cast',        label: 'Cast',        selector: '' },
  { id: 'poster',      label: 'Poster',      selector: '' },
]

export function DetailNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as DetailData
  const fields = d.fields ?? DEFAULT_DETAIL_FIELDS

  const configuredCount = fields.filter(f => f.selector.trim()).length

  const updateField = (fieldId: string, selector: string) => {
    updateNodeData(id, {
      fields: fields.map(f => f.id === fieldId ? { ...f, selector } : f),
    })
  }

  const removeField = (fieldId: string) => {
    updateNodeData(id, { fields: fields.filter(f => f.id !== fieldId) })
  }

  const addField = () => {
    const newId = `custom-${Date.now()}`
    updateNodeData(id, {
      fields: [...fields, { id: newId, label: 'Custom Field', selector: '' }],
    })
  }

  const updateLabel = (fieldId: string, label: string) => {
    updateNodeData(id, {
      fields: fields.map(f => f.id === fieldId ? { ...f, label } : f),
    })
  }

  return (
    <NodeWrapper id={id} selected={selected} accent="amber" accentClass="bg-amber-600" icon={FileSearch} label="Detail Extractor">
      <Handle type="target" position={Position.Left} style={handleStyle('amber')} />
      <div className="p-3 space-y-2 nodrag nopan">
        {/* Summary badge */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 leading-relaxed flex-1">
            CSS selectors per field. Leave blank for auto-detection.
          </p>
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2',
            configuredCount > 0
              ? 'bg-amber-600/20 text-amber-300'
              : 'bg-[#1a1d27] text-slate-500',
          )}>
            {configuredCount}/{fields.length}
          </span>
        </div>

        {/* Fields list */}
        {fields.map((field) => (
          <div key={field.id} className="group/field flex items-start gap-1.5">
            <GripVertical className="w-3 h-3 text-slate-700 shrink-0 mt-2.5 group-hover/field:text-slate-500 transition-colors" />
            <div className="flex-1 min-w-0 space-y-1">
              <input
                className="nodrag nopan w-full bg-transparent text-[10px] font-semibold text-slate-400 uppercase tracking-wider focus:outline-none focus:text-slate-200 transition-colors"
                value={field.label}
                onChange={e => updateLabel(field.id, e.target.value)}
                title="Click to rename field"
              />
              <input
                className={inputCls}
                placeholder={`CSS selector for ${field.label.toLowerCase()}…`}
                value={field.selector}
                onChange={e => updateField(field.id, e.target.value)}
              />
            </div>
            <button
              onClick={() => removeField(field.id)}
              className="nodrag nopan mt-2.5 p-0.5 text-slate-700 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover/field:opacity-100"
              title="Remove field"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add field */}
        <button
          onClick={addField}
          className="nodrag nopan w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium text-amber-400 border border-dashed border-amber-600/30 hover:border-amber-500/60 hover:bg-amber-600/5 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Field
        </button>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('amber')} />
    </NodeWrapper>
  )
}

// ─── Export Node ───────────────────────────────────────────────────────────────

export function ExportNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as ExportData

  const browse = async () => {
    const dir = await window.electronAPI.selectFolder()
    if (dir) updateNodeData(id, { outputDir: dir })
  }

  const formats = [
    { key: 'exportJson'  as const, label: 'JSON'         },
    { key: 'exportExcel' as const, label: 'Excel (.xlsx)' },
    { key: 'exportCsv'   as const, label: 'CSV'          },
  ]
  const activeFormats = formats.filter(f => d[f.key]).map(f => f.label)

  return (
    <NodeWrapper id={id} selected={selected} accent="slate" accentClass="bg-slate-600" icon={Download} label="Export">
      <Handle type="target" position={Position.Left} style={handleStyle('slate')} />
      <div className="p-3 space-y-2.5">
        <Field label="Output Folder">
          <div className="flex gap-1.5">
            <input
              className={cn(inputCls, 'flex-1 min-w-0')}
              placeholder="/path/to/output"
              value={d.outputDir}
              onChange={e => updateNodeData(id, { outputDir: e.target.value })}
            />
            <button
              className="nodrag nopan shrink-0 px-2 py-1.5 rounded-md bg-[#1a1d27] border border-[#2e3350] text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500 transition-colors"
              onClick={browse}
            >
              …
            </button>
          </div>
        </Field>
        <Field label="Export Formats">
          <div className="flex flex-col gap-1.5 pt-0.5">
            {formats.map(({ key, label }) => (
              <label key={key} className="nodrag nopan flex items-center gap-2 cursor-pointer">
                <Toggle value={d[key]} onChange={v => updateNodeData(id, { [key]: v })} />
                <span className="text-xs text-slate-400">{label}</span>
              </label>
            ))}
          </div>
        </Field>
        {activeFormats.length === 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-600/10 border border-amber-500/20 rounded-md px-2 py-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" />
            Enable at least one format
          </div>
        )}
      </div>
    </NodeWrapper>
  )
}

// ─── Custom Edge ───────────────────────────────────────────────────────────────

export function CustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [hovered, setHovered] = useState(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const showDelete = hovered || selected

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#818cf8' : hovered ? '#a5b4fc' : '#6366f1',
          strokeWidth: hovered || selected ? 3 : 2,
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {/* Wider invisible hit area for easier hover */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={16}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: showDelete ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            onClick={() => deleteElements({ edges: [{ id }] })}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1a1d27] border border-red-500/60 text-red-400 hover:bg-red-950/60 hover:border-red-400 shadow-lg transition-all"
            title="Delete connection"
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
  source:    SourceNode,
  category:  CategoryNode,
  movieList: MovieListNode,
  detail:    DetailNode,
  export:    ExportNode,
} as const

export const edgeTypes = {
  custom: CustomEdge,
} as const

// ─── Default data ──────────────────────────────────────────────────────────────

export const defaultNodeData: Record<string, object> = {
  source: {
    baseUrl:   '',
    headless:  true,
    delayMs:   500,
    userAgent: '',
  } satisfies SourceData,
  category: {
    selector: '',
  } satisfies CategoryData,
  movieList: {
    movieSelector:    '',
    nextPageSelector: '',
    maxPages:         5,
    maxMovies:        100,
  } satisfies MovieListData,
  detail: {
    fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })),
  } satisfies DetailData,
  export: {
    outputDir:   '',
    exportJson:  true,
    exportExcel: true,
    exportCsv:   false,
  } satisfies ExportData,
}

// ─── Palette ───────────────────────────────────────────────────────────────────

export const PALETTE_NODES = [
  { type: 'source',    label: 'Source',          icon: Globe2,     color: 'bg-indigo-600',  desc: 'Base URL & browser config' },
  { type: 'category',  label: 'Categories',      icon: Layers,     color: 'bg-violet-600',  desc: 'Category link selector'   },
  { type: 'movieList', label: 'Movie List',       icon: List,       color: 'bg-emerald-600', desc: 'Movie items & pagination'  },
  { type: 'detail',    label: 'Detail Extractor', icon: FileSearch, color: 'bg-amber-600',   desc: 'Per-field CSS selectors'  },
  { type: 'export',    label: 'Export',           icon: Download,   color: 'bg-slate-600',   desc: 'Output folder & formats'  },
] as const
