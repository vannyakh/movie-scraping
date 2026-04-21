import { Plus, X, GripVertical, AlertCircle, FolderOpen } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { inputCls, Field, Toggle, DEFAULT_DETAIL_FIELDS } from './nodes'
import type { SourceData, CategoryData, MovieListData, DetailData, DetailField, ExportData } from './nodes'
import { cn } from '@/lib/utils'

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-1">
      {children}
    </p>
  )
}

// ─── Source ───────────────────────────────────────────────────────────────────

export function SourcePanel({
  id, data: d, update,
}: { id: string; data: SourceData; update: (id: string, patch: Partial<SourceData>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Connection</SectionTitle>
      <Field label="Base URL" hint="Homepage URL to start scraping from">
        <input
          className={inputCls}
          placeholder="https://example.com"
          value={d.baseUrl}
          onChange={e => update(id, { baseUrl: e.target.value })}
        />
      </Field>
      <Field label="User Agent" hint="Leave blank for default Chrome UA">
        <input
          className={inputCls}
          placeholder="Mozilla/5.0 …"
          value={d.userAgent}
          onChange={e => update(id, { userAgent: e.target.value })}
        />
      </Field>

      <SectionTitle>Browser</SectionTitle>
      <Field label="Delay Between Requests (ms)" hint="Higher = more polite, slower">
        <input
          type="number"
          className={inputCls}
          value={d.delayMs}
          min={0}
          step={100}
          onChange={e => update(id, { delayMs: +e.target.value })}
        />
      </Field>
      <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1d27] border border-[#2e3350]">
        <div>
          <p className="text-xs font-medium text-slate-300">Headless Mode</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Run without visible window</p>
        </div>
        <Toggle value={d.headless} onChange={v => update(id, { headless: v })} />
      </div>
    </div>
  )
}

// ─── Category ─────────────────────────────────────────────────────────────────

export function CategoryPanel({
  id, data: d, update,
}: { id: string; data: CategoryData; update: (id: string, patch: Partial<CategoryData>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Category Detection</SectionTitle>
      <Field label="Category Link Selector" hint="Leave blank to auto-detect">
        <input
          className={inputCls}
          placeholder="nav a[href], .genre-menu a"
          value={d.selector}
          onChange={e => update(id, { selector: e.target.value })}
        />
      </Field>
      <div className="rounded-lg bg-violet-600/10 border border-violet-500/20 p-3">
        <p className="text-[11px] text-violet-300 leading-relaxed">
          Auto-detection scans the homepage for{' '}
          <code className="text-violet-200 bg-violet-900/30 px-1 rounded">nav</code>,
          sidebar menus, and genre/category links.
        </p>
      </div>
    </div>
  )
}

// ─── Movie List ───────────────────────────────────────────────────────────────

export function MovieListPanel({
  id, data: d, update,
}: { id: string; data: MovieListData; update: (id: string, patch: Partial<MovieListData>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Selectors</SectionTitle>
      <Field label="Movie Item Selector" hint="CSS selector for each movie card/link">
        <input
          className={inputCls}
          placeholder=".movie-item a, article.film a"
          value={d.movieSelector}
          onChange={e => update(id, { movieSelector: e.target.value })}
        />
      </Field>
      <Field label="Next Page Selector" hint="Pagination 'next' button">
        <input
          className={inputCls}
          placeholder="a.next, .pagination .next a"
          value={d.nextPageSelector}
          onChange={e => update(id, { nextPageSelector: e.target.value })}
        />
      </Field>

      <SectionTitle>Limits</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max Pages">
          <input
            type="number"
            className={inputCls}
            value={d.maxPages}
            min={1}
            onChange={e => update(id, { maxPages: +e.target.value })}
          />
        </Field>
        <Field label="Max Movies">
          <input
            type="number"
            className={inputCls}
            value={d.maxMovies}
            min={1}
            onChange={e => update(id, { maxMovies: +e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Detail ───────────────────────────────────────────────────────────────────

// ─── Sortable field row (used inside DetailPanel) ─────────────────────────────

function SortableFieldRow({
  field,
  onUpdate,
  onRemove,
}: {
  field: DetailField
  onUpdate: (patch: Partial<DetailField>) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/row rounded-lg border p-2.5 space-y-1.5 transition-colors',
        isDragging
          ? 'opacity-50 border-indigo-500/60 bg-indigo-600/10 shadow-lg'
          : 'bg-[#1a1d27] border-[#2e3350] hover:border-[#3d4470]',
      )}
    >
      <div className="flex items-center gap-1.5">
        {/* Drag handle — only the grip icon triggers sorting */}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none focus:outline-none"
          tabIndex={-1}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <input
          className="flex-1 min-w-0 bg-transparent text-[10px] font-semibold text-slate-400 uppercase tracking-wider focus:outline-none focus:text-slate-200 transition-colors"
          value={field.label}
          onChange={e => onUpdate({ label: e.target.value })}
          title="Click to rename"
        />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <input
        className={inputCls}
        placeholder={`CSS selector for ${field.label.toLowerCase()}…`}
        value={field.selector}
        onChange={e => onUpdate({ selector: e.target.value })}
      />
      {field.selector.trim() && (
        <p className="text-[9px] text-emerald-500 pl-4">✓ Configured</p>
      )}
    </div>
  )
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export function DetailPanel({
  id, data: d, update,
}: { id: string; data: DetailData; update: (id: string, patch: Partial<DetailData>) => void }) {
  const fields = d.fields ?? DEFAULT_DETAIL_FIELDS

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const updateField = (fieldId: string, patch: Partial<DetailField>) =>
    update(id, { fields: fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) })
  const removeField = (fieldId: string) =>
    update(id, { fields: fields.filter(f => f.id !== fieldId) })
  const addField = () =>
    update(id, { fields: [...fields, { id: `custom-${Date.now()}`, label: 'Custom Field', selector: '' }] })
  const resetToDefaults = () =>
    update(id, { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id)
      const newIndex = fields.findIndex(f => f.id === over.id)
      update(id, { fields: arrayMove(fields, oldIndex, newIndex) })
    }
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
        Define a CSS selector per field. Blank = auto-detect.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map(field => (
              <SortableFieldRow
                key={field.id}
                field={field}
                onUpdate={patch => updateField(field.id, patch)}
                onRemove={() => removeField(field.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

// ─── Export ───────────────────────────────────────────────────────────────────

export function ExportPanel({
  id, data: d, update,
}: { id: string; data: ExportData; update: (id: string, patch: Partial<ExportData>) => void }) {
  const browse = async () => {
    const dir = await window.electronAPI.selectFolder()
    if (dir) update(id, { outputDir: dir })
  }

  const formats = [
    { key: 'exportJson'  as const, label: 'JSON',         desc: 'Machine-readable .json' },
    { key: 'exportExcel' as const, label: 'Excel (.xlsx)', desc: 'Spreadsheet format'     },
    { key: 'exportCsv'   as const, label: 'CSV',           desc: 'Comma-separated text'   },
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>Output</SectionTitle>
      <Field label="Output Folder" hint="Where files will be saved">
        <div className="flex gap-1.5">
          <input
            className={cn(inputCls, 'flex-1 min-w-0')}
            placeholder="/path/to/output"
            value={d.outputDir}
            onChange={e => update(id, { outputDir: e.target.value })}
          />
          <button
            className="nodrag nopan shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#1a1d27] border border-[#2e3350] text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500 transition-colors"
            onClick={browse}
          >
            <FolderOpen className="w-3 h-3" />
          </button>
        </div>
      </Field>

      <SectionTitle>Formats</SectionTitle>
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

      {formats.every(f => !d[f.key]) && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-600/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Enable at least one format
        </div>
      )}
    </div>
  )
}
