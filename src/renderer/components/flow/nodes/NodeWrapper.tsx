import React, { memo, useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Trash2, Copy, Settings2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACCENT_HEX, STATUS_BADGE } from './constants'
import { useOpenDetail, useNodeStatus } from './context'

// ─── Shared form primitives (used by ConfigPanels) ────────────────────────────

export const inputCls =
  'nodrag nopan w-full bg-[#0d0f1a] border border-[#2a2e45] rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition-colors'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
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
        'nodrag nopan relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
        value ? 'bg-indigo-600' : 'bg-[#2a2e45]',
      )}
      onClick={() => onChange(!value)}
    >
      <span className={cn(
        'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
        value ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

// ─── Canvas preview primitives ────────────────────────────────────────────────
// These are intentionally NOT exported — they are implementation details of NodeWrapper.

export function PreviewUrl({ url, accent = 'indigo' }: { url?: string; accent?: string }) {
  const hex = ACCENT_HEX[accent] ?? '#6366f1'
  if (!url?.trim()) {
    return <p className="text-[10px] text-slate-600 italic">No URL configured</p>
  }
  let display = url
  try {
    const parsed = new URL(url)
    display = parsed.hostname + parsed.pathname.replace(/\/$/, '')
  } catch { /* use raw string */ }
  return <p className="text-[11px] font-mono truncate" style={{ color: hex }}>{display}</p>
}

export function PreviewChip({ label, color = 'slate' }: { label: string; color?: string }) {
  const palettes: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    red:    'bg-red-500/15 text-red-300 border-red-500/30',
    slate:  'bg-[#2a2e45] text-slate-400 border-[#3a3e55]',
  }
  return (
    <span className={cn(
      'inline-flex items-center text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md border',
      palettes[color] ?? palettes.slate,
    )}>
      {label}
    </span>
  )
}

export function PreviewRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 flex-wrap min-h-[18px]">{children}</div>
}

// ─── NodeWrapper ───────────────────────────────────────────────────────────────

interface NodeWrapperProps {
  id:         string
  selected?:  boolean
  accent:     keyof typeof ACCENT_HEX
  icon:       React.ElementType
  label:      string
  category:   'input' | 'process' | 'output'
  children:   React.ReactNode
  hasTarget?: boolean
  hasSource?: boolean
  warning?:   string
}

export const NodeWrapper = memo(function NodeWrapper({
  id, selected, accent, icon: Icon, label, children,
  warning,
}: NodeWrapperProps) {
  const { deleteElements, getNodes, addNodes } = useReactFlow()
  const openDetail = useOpenDetail()
  const execStatus = useNodeStatus(id)
  const [hovered, setHovered] = useState(false)

  const hex       = ACCENT_HEX[accent] ?? '#6366f1'
  const showBar   = hovered || selected
  const isActive  = !!execStatus

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
      position: { x: node.position.x + 280, y: node.position.y + 40 },
      selected: false,
    })
  }, [getNodes, addNodes, id])

  const borderColor = execStatus === 'running' ? '#fbbf24'
    : execStatus === 'success'  ? '#10b981'
    : execStatus === 'failed'   ? '#ef4444'
    : selected                  ? hex
    : hovered                   ? `${hex}80`
    : '#2a2e45'

  return (
    <div
      className="relative group"
      style={{ width: 272 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Floating action bar */}
      <div
        className={cn(
          'nodrag nopan absolute -top-10 right-0 z-50 flex items-center gap-1 px-1.5 py-1 rounded-xl',
          'bg-[#12141e]/95 backdrop-blur-sm border border-[#2a2e45] shadow-2xl',
          'transition-all duration-150',
          showBar
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-1',
        )}
      >
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); openDetail?.(id, 'config') }}
          className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-300 hover:text-white hover:bg-indigo-600/30 transition-colors"
        >
          <Settings2 className="w-3 h-3" /> Config
        </button>
        <div className="w-px h-3 bg-[#2a2e45]" />
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDuplicate}
          className="nodrag nopan flex items-center justify-center w-6 h-6 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
          title="Duplicate"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          className="nodrag nopan flex items-center justify-center w-6 h-6 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Card */}
      <div
        className={cn('rounded-2xl overflow-hidden transition-all duration-150 bg-[#181b29]', isActive && execStatus === 'running' && 'shadow-lg')}
        style={{
          border:     `1.5px solid ${borderColor}`,
          boxShadow:  selected
            ? `0 0 0 1px ${hex}60, 0 8px 32px ${hex}25`
            : isActive && execStatus === 'running'
            ? `0 0 0 1px #fbbf2440, 0 8px 24px #fbbf2420`
            : isActive && execStatus === 'success'
            ? `0 0 0 1px #10b98140, 0 4px 16px #10b98115`
            : undefined,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Running sweep */}
        {execStatus === 'running' && (
          <div className="h-0.5 w-full bg-yellow-400/20 overflow-hidden">
            <div className="h-full bg-yellow-400" style={{ width: '40%', animation: 'slideProgress 1.4s ease-in-out infinite' }} />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: `${hex}12` }}>
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${hex}22`, border: `1px solid ${hex}50` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: hex }} />
          </div>
          <span className="text-[11px] font-bold text-slate-100 uppercase tracking-[0.08em] flex-1 leading-none">
            {label}
          </span>
          {execStatus ? STATUS_BADGE[execStatus] : (
            <span className="text-[9px] text-slate-600 font-mono opacity-60">
              #{id.split('-').slice(-1)[0]}
            </span>
          )}
        </div>

        <div className="h-px" style={{ background: `${hex}20` }} />

        {/* Preview body */}
        <div className="px-3 py-2.5 bg-[#181b29]">{children}</div>

        {/* Warning strip */}
        {warning && (
          <>
            <div className="h-px bg-amber-400/20" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/8">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[9px] text-amber-300 truncate">{warning}</span>
            </div>
          </>
        )}

        {/* Hover accent bar */}
        <div
          className={cn('h-0.5 transition-all duration-150', showBar && !execStatus ? 'opacity-100' : 'opacity-0')}
          style={{ background: hex }}
        />
      </div>
    </div>
  )
})
