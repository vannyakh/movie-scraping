import { useState } from 'react'
import { Plus, X, GripVertical, FolderOpen } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { inputCls, Field, Toggle, DEFAULT_DETAIL_FIELDS } from './nodes'
import type {
  BrowserSourceData, HttpSourceData, ApiSourceData,
  LinkExtractorData, ListScraperData, FieldExtractorData, DetailField,
  AIExtractorData, FilterData, TransformData, FileExportData, WebhookData,
} from './nodes'
import { cn } from '@/lib/utils'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-1">
      {children}
    </p>
  )
}

// ─── Browser Source ───────────────────────────────────────────────────────────

export function BrowserSourcePanel({ id, data: d, update }: {
  id: string; data: BrowserSourceData
  update: (id: string, patch: Partial<BrowserSourceData>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Connection</SectionTitle>
      <Field label="Start URL" hint="Page to open in Chromium">
        <input className={inputCls} placeholder="https://example.com" value={d.url}
          onChange={e => update(id, { url: e.target.value })} />
      </Field>
      <Field label="User Agent" hint="Leave blank for default Chrome UA">
        <input className={inputCls} placeholder="Mozilla/5.0 …" value={d.userAgent}
          onChange={e => update(id, { userAgent: e.target.value })} />
      </Field>
      <SectionTitle>Browser</SectionTitle>
      <Field label="Delay between requests (ms)">
        <input type="number" className={inputCls} value={d.delayMs} min={0} step={100}
          onChange={e => update(id, { delayMs: +e.target.value })} />
      </Field>
      <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1d27] border border-[#2e3350]">
        <div>
          <p className="text-xs font-medium text-slate-300">Headless mode</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Run without a visible window</p>
        </div>
        <Toggle value={d.headless} onChange={v => update(id, { headless: v })} />
      </div>
      <SectionTitle>Cookies (optional)</SectionTitle>
      <Field label="Cookie string" hint="Paste from browser devtools — name=value; name2=value2">
        <textarea className={cn(inputCls, 'resize-none h-16 font-mono text-[10px]')}
          placeholder="session_id=abc123; auth_token=xyz"
          value={d.cookies ?? ''}
          onChange={e => update(id, { cookies: e.target.value })} />
      </Field>
    </div>
  )
}

// ─── HTTP Source ──────────────────────────────────────────────────────────────

export function HttpSourcePanel({ id, data: d, update }: {
  id: string; data: HttpSourceData
  update: (id: string, patch: Partial<HttpSourceData>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Request</SectionTitle>
      <Field label="URL">
        <input className={inputCls} placeholder="https://example.com/page" value={d.url}
          onChange={e => update(id, { url: e.target.value })} />
      </Field>
      <Field label="Method">
        <select className={inputCls} value={d.method} onChange={e => update(id, { method: e.target.value as 'GET' | 'POST' })}>
          {['GET', 'POST'].map(m => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="Headers (JSON)" hint='e.g. {"Accept": "text/html"}'>
        <textarea className={cn(inputCls, 'resize-none h-20 font-mono text-[10px]')}
          value={d.headers} onChange={e => update(id, { headers: e.target.value })} />
      </Field>
      {d.method === 'POST' && (
        <Field label="Body">
          <textarea className={cn(inputCls, 'resize-none h-16 font-mono text-[10px]')}
            value={d.body} onChange={e => update(id, { body: e.target.value })} />
        </Field>
      )}
    </div>
  )
}

// ─── API Source ───────────────────────────────────────────────────────────────

export function ApiSourcePanel({ id, data: d, update }: {
  id: string; data: ApiSourceData
  update: (id: string, patch: Partial<ApiSourceData>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Endpoint</SectionTitle>
      <Field label="URL">
        <input className={inputCls} placeholder="https://api.example.com/v1/items" value={d.url}
          onChange={e => update(id, { url: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Method">
          <select className={inputCls} value={d.method}
            onChange={e => update(id, { method: e.target.value as ApiSourceData['method'] })}>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Auth">
          <select className={inputCls} value={d.authType}
            onChange={e => update(id, { authType: e.target.value as ApiSourceData['authType'] })}>
            {['none', 'bearer', 'api-key'].map(a => <option key={a}>{a}</option>)}
          </select>
        </Field>
      </div>
      {d.authType !== 'none' && (
        <Field label={d.authType === 'bearer' ? 'Bearer token' : 'API key'}>
          <input type="password" className={inputCls} placeholder="sk-…" value={d.authValue}
            onChange={e => update(id, { authValue: e.target.value })} />
        </Field>
      )}
      <Field label="Headers (JSON)" hint='e.g. {"Content-Type": "application/json"}'>
        <textarea className={cn(inputCls, 'resize-none h-16 font-mono text-[10px]')}
          value={d.headers} onChange={e => update(id, { headers: e.target.value })} />
      </Field>
      <SectionTitle>Response</SectionTitle>
      <Field label="Data path" hint="JSON path to array of items (e.g. data.items)">
        <input className={inputCls} placeholder="data" value={d.dataPath}
          onChange={e => update(id, { dataPath: e.target.value })} />
      </Field>
      <SectionTitle>Pagination</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Page param">
          <input className={inputCls} placeholder="page" value={d.pageParam}
            onChange={e => update(id, { pageParam: e.target.value })} />
        </Field>
        <Field label="Max pages">
          <input type="number" className={inputCls} value={d.maxPages} min={1}
            onChange={e => update(id, { maxPages: +e.target.value })} />
        </Field>
      </div>
    </div>
  )
}

// ─── Link Extractor ───────────────────────────────────────────────────────────

export function LinkExtractorPanel({ id, data: d, update }: {
  id: string; data: LinkExtractorData
  update: (id: string, patch: Partial<LinkExtractorData>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Selection</SectionTitle>
      <Field label="CSS Selector" hint="Selects anchor elements to extract">
        <input className={inputCls} placeholder="a[href], nav a, .product-link" value={d.selector}
          onChange={e => update(id, { selector: e.target.value })} />
      </Field>
      <Field label="Text selector" hint="Optional: selector for link label text">
        <input className={inputCls} placeholder=".title, h3" value={d.textSelector}
          onChange={e => update(id, { textSelector: e.target.value })} />
      </Field>
      <SectionTitle>Filtering</SectionTitle>
      <Field label="URL filter pattern" hint="Regex — only keep matching URLs">
        <input className={inputCls} placeholder="/product/, /item/" value={d.filterPattern}
          onChange={e => update(id, { filterPattern: e.target.value })} />
      </Field>
      <Field label="Max links">
        <input type="number" className={inputCls} value={d.limit} min={1}
          onChange={e => update(id, { limit: +e.target.value })} />
      </Field>
    </div>
  )
}

// ─── List Scraper ─────────────────────────────────────────────────────────────

export function ListScraperPanel({ id, data: d, update }: {
  id: string; data: ListScraperData
  update: (id: string, patch: Partial<ListScraperData>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Selectors</SectionTitle>
      <Field label="Item selector" hint="CSS selector for each list item / card">
        <input className={inputCls} placeholder=".product-card a, li.item a" value={d.itemSelector}
          onChange={e => update(id, { itemSelector: e.target.value })} />
      </Field>
      <Field label="Next page selector" hint="'Next' button or page link">
        <input className={inputCls} placeholder="a.next, .pagination-next" value={d.nextPageSelector}
          onChange={e => update(id, { nextPageSelector: e.target.value })} />
      </Field>
      <SectionTitle>Limits</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Max pages">
          <input type="number" className={inputCls} value={d.maxPages} min={1}
            onChange={e => update(id, { maxPages: +e.target.value })} />
        </Field>
        <Field label="Max items">
          <input type="number" className={inputCls} value={d.maxItems} min={1}
            onChange={e => update(id, { maxItems: +e.target.value })} />
        </Field>
      </div>
    </div>
  )
}

// ─── Sortable field row (used in FieldExtractorPanel) ─────────────────────────

function SortableFieldRow({
  field, onUpdate, onRemove,
}: { field: DetailField; onUpdate: (p: Partial<DetailField>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }

  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        'group/row rounded-lg border p-2.5 space-y-1.5 transition-colors',
        isDragging
          ? 'opacity-50 border-indigo-500/60 bg-indigo-600/10 shadow-lg'
          : 'bg-[#1a1d27] border-[#2e3350] hover:border-[#3d4470]',
      )}>
      <div className="flex items-center gap-1.5">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners}
          className="shrink-0 p-0.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none focus:outline-none" tabIndex={-1}>
          <GripVertical className="w-3 h-3" />
        </button>
        <input
          className="flex-1 min-w-0 bg-transparent text-[10px] font-semibold text-slate-400 uppercase tracking-wider focus:outline-none focus:text-slate-200 transition-colors"
          value={field.label} onChange={e => onUpdate({ label: e.target.value })} title="Click to rename" />
        <select className={cn(inputCls, 'w-16 text-[9px]')} value={field.type}
          onChange={e => onUpdate({ type: e.target.value as DetailField['type'] })}>
          <option value="text">text</option>
          <option value="attr">attr</option>
          <option value="html">html</option>
        </select>
        <button onClick={onRemove}
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
      <input className={inputCls} placeholder={`CSS selector for ${field.label.toLowerCase()}…`}
        value={field.selector} onChange={e => onUpdate({ selector: e.target.value })} />
      {field.type === 'attr' && (
        <input className={inputCls} placeholder="attr name (e.g. href, src, data-id)"
          value={field.attrName} onChange={e => onUpdate({ attrName: e.target.value })} />
      )}
      {field.selector.trim() && <p className="text-[9px] text-emerald-500 pl-4">Configured</p>}
    </div>
  )
}

// ─── Field Extractor ──────────────────────────────────────────────────────────

export function FieldExtractorPanel({ id, data: d, update }: {
  id: string; data: FieldExtractorData
  update: (id: string, patch: Partial<FieldExtractorData>) => void
}) {
  const fields = d.fields ?? DEFAULT_DETAIL_FIELDS
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const updateField = (fieldId: string, patch: Partial<DetailField>) =>
    update(id, { fields: fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) })
  const removeField = (fieldId: string) =>
    update(id, { fields: fields.filter(f => f.id !== fieldId) })
  const addField = () =>
    update(id, { fields: [...fields, { id: `custom-${Date.now()}`, label: 'Custom Field', selector: '', attrName: '', type: 'text' as const }] })
  const resetToDefaults = () =>
    update(id, { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = fields.findIndex(f => f.id === active.id)
      const newIdx = fields.findIndex(f => f.id === over.id)
      update(id, { fields: arrayMove(fields, oldIdx, newIdx) })
    }
  }

  const configured = fields.filter(f => f.selector.trim()).length

  return (
    <div className="space-y-3">
      <SectionTitle>Browser</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1a1d27] border border-[#2e3350] col-span-1">
          <p className="text-xs text-slate-300">Headless</p>
          <Toggle value={d.headless} onChange={v => update(id, { headless: v })} />
        </div>
        <Field label="Delay (ms)">
          <input type="number" className={inputCls} value={d.delayMs} min={0} step={100}
            onChange={e => update(id, { delayMs: +e.target.value })} />
        </Field>
      </div>
      <Field label="URL field in input" hint="Which field contains the URL to navigate">
        <input className={inputCls} placeholder="_url" value={d.urlField}
          onChange={e => update(id, { urlField: e.target.value })} />
      </Field>
      <div className="flex items-center justify-between">
        <SectionTitle>Extraction Fields</SectionTitle>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full mb-3',
          configured > 0 ? 'bg-amber-600/20 text-amber-300' : 'bg-[#1a1d27] text-slate-500',
        )}>
          {configured}/{fields.length} set
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map(field => (
              <SortableFieldRow key={field.id} field={field}
                onUpdate={patch => updateField(field.id, patch)}
                onRemove={() => removeField(field.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button onClick={addField}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-400 border border-dashed border-amber-600/30 hover:border-amber-500/60 hover:bg-amber-600/5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Field
      </button>
      <button onClick={resetToDefaults}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 border border-[#2e3350] hover:border-[#3d4470] hover:text-slate-400 transition-colors">
        Reset to defaults
      </button>
    </div>
  )
}

// ─── AI Extractor ─────────────────────────────────────────────────────────────

export function AIExtractorPanel({ id, data: d, update }: {
  id: string; data: AIExtractorData
  update: (id: string, patch: Partial<AIExtractorData>) => void
}) {
  const fields = d.fields ?? []

  const addField = () =>
    update(id, { fields: [...fields, { id: `f-${Date.now()}`, label: 'New Field' }] })
  const removeField = (fid: string) =>
    update(id, { fields: fields.filter(f => f.id !== fid) })

  return (
    <div className="space-y-4">
      <SectionTitle>Instruction</SectionTitle>
      <Field label="What to extract" hint="Natural language description for the AI">
        <textarea className={cn(inputCls, 'resize-none h-24')}
          placeholder="Extract the product name, price, availability, and main description from each product page…"
          value={d.instruction} onChange={e => update(id, { instruction: e.target.value })} />
      </Field>
      <Field label="Input field" hint="Which field in upstream records contains the HTML">
        <input className={inputCls} placeholder="_html" value={d.inputField}
          onChange={e => update(id, { inputField: e.target.value })} />
      </Field>
      <Field label="AI Model">
        <select className={inputCls} value={d.model}
          onChange={e => update(id, { model: e.target.value })}>
          {['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'].map(m =>
            <option key={m}>{m}</option>)}
        </select>
      </Field>
      <SectionTitle>Output Fields</SectionTitle>
      <p className="text-[10px] text-slate-500 -mt-2">Name the fields you want in the output records.</p>
      <div className="space-y-2">
        {fields.map(f => (
          <div key={f.id} className="flex items-center gap-1.5">
            <input className={cn(inputCls, 'flex-1')} placeholder="field name…"
              value={f.label} onChange={e => update(id, { fields: fields.map(fi => fi.id === f.id ? { ...fi, label: e.target.value } : fi) })} />
            <button onClick={() => removeField(f.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addField}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-pink-400 border border-dashed border-pink-600/30 hover:border-pink-500/60 hover:bg-pink-600/5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Output Field
      </button>
    </div>
  )
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export function FilterPanel({ id, data: d, update }: {
  id: string; data: FilterData
  update: (id: string, patch: Partial<FilterData>) => void
}) {
  const conditions = d.conditions ?? []
  const OPERATORS  = ['exists', 'notExists', 'equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'gt', 'lt', 'gte', 'lte']

  const addCondition = () =>
    update(id, { conditions: [...conditions, { id: `c-${Date.now()}`, field: '', operator: 'exists', value: '' }] })
  const removeCondition = (cid: string) =>
    update(id, { conditions: conditions.filter(c => c.id !== cid) })
  const updateCondition = (cid: string, patch: Partial<FilterData['conditions'][0]>) =>
    update(id, { conditions: conditions.map(c => c.id === cid ? { ...c, ...patch } : c) })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SectionTitle>Conditions</SectionTitle>
        <select className={cn(inputCls, 'w-16 ml-auto mb-3')} value={d.logic}
          onChange={e => update(id, { logic: e.target.value as 'AND' | 'OR' })}>
          <option>AND</option>
          <option>OR</option>
        </select>
      </div>
      <p className="text-[10px] text-slate-500 -mt-2">Keep records matching {d.logic} of these conditions.</p>
      <div className="space-y-2">
        {conditions.map(c => (
          <div key={c.id} className="rounded-lg border border-[#2e3350] bg-[#1a1d27] p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Field label="Field">
                <input className={inputCls} placeholder="fieldName" value={c.field}
                  onChange={e => updateCondition(c.id, { field: e.target.value })} />
              </Field>
              <button onClick={() => removeCondition(c.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 mt-4">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Operator">
                <select className={inputCls} value={c.operator}
                  onChange={e => updateCondition(c.id, { operator: e.target.value })}>
                  {OPERATORS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              {!['exists', 'notExists'].includes(c.operator) && (
                <Field label="Value">
                  <input className={inputCls} placeholder="value" value={c.value}
                    onChange={e => updateCondition(c.id, { value: e.target.value })} />
                </Field>
              )}
            </div>
          </div>
        ))}
      </div>
      <button onClick={addCondition}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-orange-400 border border-dashed border-orange-600/30 hover:border-orange-500/60 hover:bg-orange-600/5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Condition
      </button>
    </div>
  )
}

// ─── Transform ────────────────────────────────────────────────────────────────

export function TransformPanel({ id, data: d, update }: {
  id: string; data: TransformData
  update: (id: string, patch: Partial<TransformData>) => void
}) {
  const renames  = d.renames  ?? []
  const computed = d.computed ?? []

  const addRename = () =>
    update(id, { renames: [...renames, { from: '', to: '' }] })
  const addComputed = () =>
    update(id, { computed: [...computed, { id: `comp-${Date.now()}`, label: 'New Field', expression: '' }] })

  return (
    <div className="space-y-4">
      <SectionTitle>Rename Fields</SectionTitle>
      <div className="space-y-2">
        {renames.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input className={cn(inputCls, 'flex-1')} placeholder="from" value={r.from}
              onChange={e => update(id, { renames: renames.map((ri, ii) => ii === i ? { ...ri, from: e.target.value } : ri) })} />
            <span className="text-slate-600 text-xs">→</span>
            <input className={cn(inputCls, 'flex-1')} placeholder="to" value={r.to}
              onChange={e => update(id, { renames: renames.map((ri, ii) => ii === i ? { ...ri, to: e.target.value } : ri) })} />
            <button onClick={() => update(id, { renames: renames.filter((_, ii) => ii !== i) })}
              className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRename}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-yellow-400 border border-dashed border-yellow-600/30 hover:border-yellow-500/60 hover:bg-yellow-600/5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Rename
      </button>
      <SectionTitle>Omit Fields</SectionTitle>
      <Field label="Comma-separated field names to remove" hint="e.g. _html, _raw, _url">
        <input className={inputCls} placeholder="_html, _raw" value={d.omit ?? ''}
          onChange={e => update(id, { omit: e.target.value })} />
      </Field>
      <SectionTitle>Computed Fields</SectionTitle>
      <div className="space-y-2">
        {computed.map((c) => (
          <div key={c.id} className="rounded-lg border border-[#2e3350] bg-[#1a1d27] p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input className={cn(inputCls, 'flex-1')} placeholder="field name" value={c.label}
                onChange={e => update(id, { computed: computed.map(ci => ci.id === c.id ? { ...ci, label: e.target.value } : ci) })} />
              <button onClick={() => update(id, { computed: computed.filter(ci => ci.id !== c.id) })}
                className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input className={cn(inputCls, 'font-mono text-[10px]')} placeholder={`record.price * 0.9`}
              value={c.expression}
              onChange={e => update(id, { computed: computed.map(ci => ci.id === c.id ? { ...ci, expression: e.target.value } : ci) })} />
          </div>
        ))}
      </div>
      <button onClick={addComputed}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-yellow-400 border border-dashed border-yellow-600/30 hover:border-yellow-500/60 hover:bg-yellow-600/5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Computed Field
      </button>
    </div>
  )
}

// ─── File Export ──────────────────────────────────────────────────────────────

export function FileExportPanel({ id, data: d, update }: {
  id: string; data: FileExportData
  update: (id: string, patch: Partial<FileExportData>) => void
}) {
  const [browsing, setBrowsing] = useState(false)

  const browse = async () => {
    setBrowsing(true)
    const dir = await window.electronAPI.selectFolder()
    if (dir) update(id, { outputDir: dir })
    setBrowsing(false)
  }

  const formats = [
    { key: 'exportJson'  as const, label: 'JSON',         desc: 'Machine-readable .json' },
    { key: 'exportExcel' as const, label: 'Excel (.xlsx)', desc: 'Spreadsheet'             },
    { key: 'exportCsv'   as const, label: 'CSV',           desc: 'Comma-separated text'   },
  ]

  return (
    <div className="space-y-4">
      <SectionTitle>Output</SectionTitle>
      <Field label="Output folder" hint="Files are saved here">
        <div className="flex gap-1.5">
          <input className={cn(inputCls, 'flex-1 min-w-0')} placeholder="/path/to/output" value={d.outputDir}
            onChange={e => update(id, { outputDir: e.target.value })} />
          <button disabled={browsing}
            className="nodrag nopan shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#1a1d27] border border-[#2e3350] text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500 transition-colors"
            onClick={browse}>
            <FolderOpen className="w-3 h-3" />
          </button>
        </div>
      </Field>
      <Field label="Base filename" hint="Date + extension will be appended">
        <input className={inputCls} placeholder="output" value={d.filename}
          onChange={e => update(id, { filename: e.target.value })} />
      </Field>
      <SectionTitle>Formats</SectionTitle>
      <div className="space-y-2">
        {formats.map(({ key, label, desc }) => (
          <div key={key}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
              d[key] ? 'bg-emerald-600/10 border-emerald-500/30' : 'bg-[#1a1d27] border-[#2e3350] hover:border-[#3d4470]',
            )}
            onClick={() => update(id, { [key]: !d[key] })}>
            <div>
              <p className="text-xs font-medium text-slate-300">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
            </div>
            <Toggle value={d[key]} onChange={v => update(id, { [key]: v })} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export function WebhookPanel({ id, data: d, update }: {
  id: string; data: WebhookData
  update: (id: string, patch: Partial<WebhookData>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Endpoint</SectionTitle>
      <Field label="URL">
        <input className={inputCls} placeholder="https://your-server.com/webhook" value={d.url}
          onChange={e => update(id, { url: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Method">
          <select className={inputCls} value={d.method}
            onChange={e => update(id, { method: e.target.value as WebhookData['method'] })}>
            {['POST', 'PUT', 'PATCH'].map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Batch size" hint="Records per request">
          <input type="number" className={inputCls} value={d.batchSize} min={1}
            onChange={e => update(id, { batchSize: +e.target.value })} />
        </Field>
      </div>
      <Field label="Headers (JSON)">
        <textarea className={cn(inputCls, 'resize-none h-16 font-mono text-[10px]')}
          value={d.headers} onChange={e => update(id, { headers: e.target.value })} />
      </Field>
    </div>
  )
}
