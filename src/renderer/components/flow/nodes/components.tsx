/**
 * Canvas node components — compact preview cards.
 * Full configuration is handled in NodeConfigPanel → ConfigPanels.tsx.
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Globe2, Zap, Cpu, Link2, List, FileSearch,
  Bot, Filter, Shuffle, Download, Webhook,
} from 'lucide-react'
import { NodeWrapper, PreviewUrl, PreviewChip, PreviewRow } from './NodeWrapper'
import { handleStyle } from './constants'
import { DEFAULT_DETAIL_FIELDS } from './defaults'
import type {
  BrowserSourceData, HttpSourceData, ApiSourceData,
  LinkExtractorData, ListScraperData, FieldExtractorData,
  AIExtractorData, FilterData, TransformData, FileExportData, WebhookData,
} from './types'
import { cn } from '@/lib/utils'

// ─── Input nodes ──────────────────────────────────────────────────────────────

export const BrowserSourceNode = memo(function BrowserSourceNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as BrowserSourceData
  return (
    <NodeWrapper id={id} selected={selected} accent="indigo" icon={Globe2} label="Browser Source" category="input" hasSource warning={!d.url?.trim() ? 'URL required' : undefined}>
      <div className="space-y-1.5">
        <PreviewUrl url={d.url} accent="indigo" />
        <PreviewRow>
          <PreviewChip label={d.headless ? 'Headless' : 'Visible'} color={d.headless ? 'indigo' : 'amber'} />
          {d.delayMs > 0 && <PreviewChip label={`${d.delayMs}ms`} />}
        </PreviewRow>
      </div>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('indigo'), right: -5 }} />
    </NodeWrapper>
  )
})

export const HttpSourceNode = memo(function HttpSourceNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as HttpSourceData
  return (
    <NodeWrapper id={id} selected={selected} accent="blue" icon={Zap} label="HTTP Source" category="input" warning={!d.url?.trim() ? 'URL required' : undefined}>
      <div className="space-y-1.5">
        <PreviewRow><PreviewChip label={d.method} color="indigo" /></PreviewRow>
        <PreviewUrl url={d.url} accent="blue" />
      </div>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('blue'), right: -5 }} />
    </NodeWrapper>
  )
})

export const ApiSourceNode = memo(function ApiSourceNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ApiSourceData
  return (
    <NodeWrapper id={id} selected={selected} accent="cyan" icon={Cpu} label="API Source" category="input" warning={!d.url?.trim() ? 'URL required' : undefined}>
      <div className="space-y-1.5">
        <PreviewRow>
          <PreviewChip label={d.method} color="indigo" />
          {d.authType !== 'none' && <PreviewChip label={d.authType} color="amber" />}
          {d.maxPages > 1 && <PreviewChip label={`${d.maxPages}p`} />}
        </PreviewRow>
        <PreviewUrl url={d.url} accent="cyan" />
      </div>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('cyan'), right: -5 }} />
    </NodeWrapper>
  )
})

// ─── Process nodes ────────────────────────────────────────────────────────────

export const LinkExtractorNode = memo(function LinkExtractorNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as LinkExtractorData
  return (
    <NodeWrapper id={id} selected={selected} accent="violet" icon={Link2} label="Link Extractor" category="process">
      <div className="space-y-1.5">
        <p className="text-[11px] font-mono text-violet-300 truncate">
          {d.selector || <span className="text-slate-600 italic not-italic">No selector</span>}
        </p>
        <PreviewRow>
          <PreviewChip label={`max ${d.limit}`} />
          {d.filterPattern && <PreviewChip label="filtered" color="amber" />}
        </PreviewRow>
      </div>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle('violet'), left: -5 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('violet'), right: -5 }} />
    </NodeWrapper>
  )
})

export const ListScraperNode = memo(function ListScraperNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ListScraperData
  return (
    <NodeWrapper id={id} selected={selected} accent="purple" icon={List} label="List Scraper" category="process">
      <div className="space-y-1.5">
        <p className="text-[11px] font-mono text-purple-300 truncate">
          {d.itemSelector || <span className="text-slate-600 italic not-italic">No selector</span>}
        </p>
        <PreviewRow>
          <PreviewChip label={`${d.maxPages} pages`} />
          <PreviewChip label={`${d.maxItems} items`} />
        </PreviewRow>
      </div>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle('purple'), left: -5 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('purple'), right: -5 }} />
    </NodeWrapper>
  )
})

export const FieldExtractorNode = memo(function FieldExtractorNode({ id, data, selected }: NodeProps) {
  const d          = data as unknown as FieldExtractorData
  const fields     = d.fields ?? DEFAULT_DETAIL_FIELDS
  const configured = fields.filter((f) => f.selector.trim()).length
  return (
    <NodeWrapper id={id} selected={selected} accent="amber" icon={FileSearch} label="Field Extractor" category="process" warning={configured === 0 ? 'No selectors configured' : undefined}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#2a2e45] overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: fields.length > 0 ? `${(configured / fields.length) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] font-semibold text-amber-300 tabular-nums">{configured}/{fields.length}</span>
        </div>
        <PreviewRow>
          {fields.slice(0, 4).map((f) => (
            <span key={f.id} className={cn('text-[9px] px-1 rounded', f.selector ? 'text-amber-300' : 'text-slate-600')}>
              {f.label}
            </span>
          ))}
          {fields.length > 4 && <span className="text-[9px] text-slate-600">+{fields.length - 4}</span>}
        </PreviewRow>
      </div>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle('amber'), left: -5 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('amber'), right: -5 }} />
    </NodeWrapper>
  )
})

export const AIExtractorNode = memo(function AIExtractorNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as AIExtractorData
  return (
    <NodeWrapper id={id} selected={selected} accent="pink" icon={Bot} label="AI Extractor" category="process">
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
          {d.instruction || <span className="italic text-slate-600">No instruction</span>}
        </p>
        <PreviewRow>
          <PreviewChip label={d.model?.split('-')[0] ?? 'gpt'} color="indigo" />
          {d.fields?.length > 0 && <PreviewChip label={`${d.fields.length} fields`} />}
        </PreviewRow>
      </div>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle('pink'), left: -5 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('pink'), right: -5 }} />
    </NodeWrapper>
  )
})

export const FilterNode = memo(function FilterNode({ id, data, selected }: NodeProps) {
  const d          = data as unknown as FilterData
  const conditions = d.conditions ?? []
  return (
    <NodeWrapper id={id} selected={selected} accent="orange" icon={Filter} label="Filter" category="process">
      <div className="space-y-1.5">
        <PreviewRow>
          <PreviewChip label={`${conditions.length} condition${conditions.length !== 1 ? 's' : ''}`} />
          <PreviewChip label={d.logic} color={d.logic === 'AND' ? 'indigo' : 'amber'} />
        </PreviewRow>
        {conditions.slice(0, 2).map((c) => (
          <p key={c.id} className="text-[9px] text-slate-500 font-mono truncate">
            {c.field || '…'} {c.operator} {c.value && `"${c.value}"`}
          </p>
        ))}
      </div>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle('orange'), left: -5 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('orange'), right: -5 }} />
    </NodeWrapper>
  )
})

export const TransformNode = memo(function TransformNode({ id, data, selected }: NodeProps) {
  const d        = data as unknown as TransformData
  const renames  = d.renames  ?? []
  const computed = d.computed ?? []
  const omitted  = d.omit ? d.omit.split(',').filter(Boolean).length : 0
  return (
    <NodeWrapper id={id} selected={selected} accent="yellow" icon={Shuffle} label="Transform" category="process">
      <PreviewRow>
        {renames.length  > 0 && <PreviewChip label={`${renames.length} rename${renames.length !== 1 ? 's' : ''}`} />}
        {computed.length > 0 && <PreviewChip label={`${computed.length} computed`} color="indigo" />}
        {omitted         > 0 && <PreviewChip label={`${omitted} omit`} color="red" />}
        {renames.length + computed.length + omitted === 0 && (
          <p className="text-[10px] text-slate-600 italic">No transforms configured</p>
        )}
      </PreviewRow>
      <Handle type="target" position={Position.Left}  style={{ ...handleStyle('yellow'), left: -5 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle('yellow'), right: -5 }} />
    </NodeWrapper>
  )
})

// ─── Output nodes ─────────────────────────────────────────────────────────────

export const FileExportNode = memo(function FileExportNode({ id, data, selected }: NodeProps) {
  const d       = data as unknown as FileExportData
  const formats = [d.exportJson && 'JSON', d.exportExcel && 'XLSX', d.exportCsv && 'CSV'].filter(Boolean) as string[]
  return (
    <NodeWrapper id={id} selected={selected} accent="emerald" icon={Download} label="File Export" category="output" warning={!d.outputDir ? 'Output folder required' : formats.length === 0 ? 'Select at least one format' : undefined}>
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-500 font-mono truncate">
          {d.outputDir || <span className="italic text-slate-600">No folder set</span>}
        </p>
        <PreviewRow>{formats.map((f) => <PreviewChip key={f} label={f} color="green" />)}</PreviewRow>
      </div>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle('emerald'), left: -5 }} />
    </NodeWrapper>
  )
})

export const WebhookNode = memo(function WebhookNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as WebhookData
  return (
    <NodeWrapper id={id} selected={selected} accent="teal" icon={Webhook} label="Webhook" category="output" warning={!d.url?.trim() ? 'URL required' : undefined}>
      <div className="space-y-1.5">
        <PreviewRow>
          <PreviewChip label={d.method} color="indigo" />
          <PreviewChip label={`batch ${d.batchSize}`} />
        </PreviewRow>
        <PreviewUrl url={d.url} accent="teal" />
      </div>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle('teal'), left: -5 }} />
    </NodeWrapper>
  )
})
