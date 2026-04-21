import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Globe2, Layers, List, FileSearch, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Shared ───────────────────────────────────────────────────────────────────

const inputCls =
  'nodrag nopan w-full bg-[#0f1117] border border-[#2e3350] rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      {children}
      {hint && <p className="text-[9px] text-slate-600 leading-tight">{hint}</p>}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={cn(
        'nodrag nopan relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        value ? 'bg-indigo-600' : 'bg-[#2e3350]',
      )}
      onClick={() => onChange(!value)}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-4' : 'translate-x-0',
        )}
      />
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

// ─── Source Node ──────────────────────────────────────────────────────────────

export interface SourceData {
  baseUrl:   string
  headless:  boolean
  delayMs:   number
  userAgent: string
}

export function SourceNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as SourceData

  return (
    <div className="w-72 bg-[#13151f] border border-[#2e3350] rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600">
        <Globe2 className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">Source</span>
      </div>
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
    </div>
  )
}

// ─── Category Node ────────────────────────────────────────────────────────────

export interface CategoryData {
  selector: string
}

export function CategoryNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as CategoryData

  return (
    <div className="w-72 bg-[#13151f] border border-[#2e3350] rounded-xl shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} style={handleStyle('violet')} />
      <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-600">
        <Layers className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">Categories</span>
      </div>
      <div className="p-3 space-y-2.5">
        <Field
          label="Category Link Selector"
          hint="CSS selector for nav/menu links. Leave blank to auto-detect."
        >
          <input
            className={inputCls}
            placeholder="nav a[href], .genre-menu a"
            value={d.selector}
            onChange={e => updateNodeData(id, { selector: e.target.value })}
          />
        </Field>
        <div className="rounded-lg bg-violet-600/10 border border-violet-500/20 px-3 py-2">
          <p className="text-[10px] text-violet-300 leading-relaxed">
            Scrapes category / genre links from the homepage. Auto-detection finds common nav patterns when left blank.
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('violet')} />
    </div>
  )
}

// ─── Movie List Node ──────────────────────────────────────────────────────────

export interface MovieListData {
  movieSelector:    string
  nextPageSelector: string
  maxPages:         number
  maxMovies:        number
}

export function MovieListNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as MovieListData

  return (
    <div className="w-72 bg-[#13151f] border border-[#2e3350] rounded-xl shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} style={handleStyle('emerald')} />
      <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-600">
        <List className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">Movie List</span>
      </div>
      <div className="p-3 space-y-2.5">
        <Field label="Movie Item Selector" hint="CSS selector for each movie card/link">
          <input
            className={inputCls}
            placeholder=".movie-item a, article.film a"
            value={d.movieSelector}
            onChange={e => updateNodeData(id, { movieSelector: e.target.value })}
          />
        </Field>
        <Field label="Next Page Selector" hint="CSS selector for the pagination next button">
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
    </div>
  )
}

// ─── Detail Node ──────────────────────────────────────────────────────────────

export interface DetailData {
  titleSelector:       string
  yearSelector:        string
  ratingSelector:      string
  durationSelector:    string
  directorSelector:    string
  descriptionSelector: string
  castSelector:        string
  posterSelector:      string
}

const DETAIL_FIELDS: { key: keyof DetailData; label: string; placeholder: string }[] = [
  { key: 'titleSelector',       label: 'Title',       placeholder: 'h1.title, .movie-title' },
  { key: 'yearSelector',        label: 'Year',        placeholder: '.year, .release-year' },
  { key: 'ratingSelector',      label: 'Rating',      placeholder: '.rating, .score, .imdb' },
  { key: 'durationSelector',    label: 'Duration',    placeholder: '.duration, .runtime' },
  { key: 'directorSelector',    label: 'Director',    placeholder: '.director, [itemprop="director"]' },
  { key: 'descriptionSelector', label: 'Description', placeholder: '.synopsis, .plot, p.desc' },
  { key: 'castSelector',        label: 'Cast',        placeholder: '.cast a, [itemprop="actor"]' },
  { key: 'posterSelector',      label: 'Poster',      placeholder: '.poster img, img.thumb' },
]

export function DetailNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as DetailData

  return (
    <div className="w-72 bg-[#13151f] border border-[#2e3350] rounded-xl shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} style={handleStyle('amber')} />
      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-600">
        <FileSearch className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">Detail Extractor</span>
      </div>
      <div className="p-3 space-y-2 nodrag nopan">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Custom CSS selectors for each field. Leave blank to use built-in auto-detection.
        </p>
        {DETAIL_FIELDS.map(({ key, label, placeholder }) => (
          <Field key={key} label={label}>
            <input
              className={inputCls}
              placeholder={placeholder}
              value={d[key]}
              onChange={e => updateNodeData(id, { [key]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('amber')} />
    </div>
  )
}

// ─── Export Node ──────────────────────────────────────────────────────────────

export interface ExportData {
  outputDir:   string
  exportJson:  boolean
  exportExcel: boolean
  exportCsv:   boolean
}

export function ExportNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const d = data as unknown as ExportData

  const browse = async () => {
    const dir = await window.electronAPI.selectFolder()
    if (dir) updateNodeData(id, { outputDir: dir })
  }

  return (
    <div className="w-72 bg-[#13151f] border border-[#2e3350] rounded-xl shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} style={handleStyle('slate')} />
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-600">
        <Download className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">Export</span>
      </div>
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
            {([
              { key: 'exportJson',  label: 'JSON' },
              { key: 'exportExcel', label: 'Excel (.xlsx)' },
              { key: 'exportCsv',   label: 'CSV' },
            ] as { key: keyof ExportData; label: string }[]).map(({ key, label }) => (
              <label key={key} className="nodrag nopan flex items-center gap-2 cursor-pointer">
                <Toggle
                  value={d[key] as boolean}
                  onChange={v => updateNodeData(id, { [key]: v })}
                />
                <span className="text-xs text-slate-400">{label}</span>
              </label>
            ))}
          </div>
        </Field>
      </div>
    </div>
  )
}

// ─── Node types registry ──────────────────────────────────────────────────────

export const nodeTypes = {
  source:    SourceNode,
  category:  CategoryNode,
  movieList: MovieListNode,
  detail:    DetailNode,
  export:    ExportNode,
} as const

// ─── Default data per node type ───────────────────────────────────────────────

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
    titleSelector:       '',
    yearSelector:        '',
    ratingSelector:      '',
    durationSelector:    '',
    directorSelector:    '',
    descriptionSelector: '',
    castSelector:        '',
    posterSelector:      '',
  } satisfies DetailData,
  export: {
    outputDir:   '',
    exportJson:  true,
    exportExcel: true,
    exportCsv:   false,
  } satisfies ExportData,
}

// ─── Palette definition (used by NodePalette) ─────────────────────────────────

export const PALETTE_NODES = [
  { type: 'source',    label: 'Source',           icon: Globe2,      color: 'bg-indigo-600',  desc: 'Base URL & browser config' },
  { type: 'category',  label: 'Categories',       icon: Layers,      color: 'bg-violet-600',  desc: 'Category link selector'   },
  { type: 'movieList', label: 'Movie List',        icon: List,        color: 'bg-emerald-600', desc: 'Movie items & pagination'  },
  { type: 'detail',    label: 'Detail Extractor',  icon: FileSearch,  color: 'bg-amber-600',   desc: 'Per-field CSS selectors'  },
  { type: 'export',    label: 'Export',            icon: Download,    color: 'bg-slate-600',   desc: 'Output folder & formats'  },
] as const
