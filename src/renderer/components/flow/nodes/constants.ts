import React from 'react'
import type { NodeExecStatus } from '../../../../lib/ipc'
import {
  Globe2, Zap, Cpu, Link2, List, FileSearch,
  Bot, Filter, Shuffle, Download, Webhook,
} from 'lucide-react'

// ─── Accent colours ───────────────────────────────────────────────────────────

export const ACCENT_HEX: Record<string, string> = {
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

/** Inline style for a React Flow connection handle. */
export function handleStyle(color: string): React.CSSProperties {
  const hex = ACCENT_HEX[color] ?? '#6366f1'
  return { background: hex, border: `2px solid ${hex}99`, width: 10, height: 10, borderRadius: '50%' }
}

// ─── Execution status badges ──────────────────────────────────────────────────

export const STATUS_BADGE: Record<NodeExecStatus, React.ReactNode> = {
  running: React.createElement('span', {
    className: 'inline-flex items-center gap-1 text-[8px] font-bold text-yellow-300 bg-yellow-400/15 border border-yellow-400/40 rounded-full px-1.5 py-0.5 animate-pulse tracking-wide',
  }, '▶ RUNNING'),
  success: React.createElement('span', {
    className: 'inline-flex items-center gap-1 text-[8px] font-bold text-emerald-300 bg-emerald-400/15 border border-emerald-400/40 rounded-full px-1.5 py-0.5 tracking-wide',
  }, '✓ DONE'),
  failed: React.createElement('span', {
    className: 'inline-flex items-center gap-1 text-[8px] font-bold text-red-300 bg-red-400/15 border border-red-400/40 rounded-full px-1.5 py-0.5 tracking-wide',
  }, '✗ ERROR'),
  pending: React.createElement('span', {
    className: 'text-[8px] font-bold text-slate-600 tracking-wide',
  }, 'QUEUED'),
  skipped: React.createElement('span', {
    className: 'text-[8px] font-bold text-slate-600 tracking-wide',
  }, 'SKIP'),
}

// ─── Palette configuration ────────────────────────────────────────────────────

export interface PaletteNodeMeta {
  type:  string
  label: string
  icon:  React.ComponentType<{ className?: string }>
  color: string
  desc:  string
}

export const PALETTE_GROUPS = [
  {
    label: 'Input',
    nodes: [
      { type: 'browser-source', label: 'Browser Source', icon: Globe2,      color: 'bg-indigo-600', desc: 'Chromium, JS-rendered pages' },
      { type: 'http-source',    label: 'HTTP Source',    icon: Zap,         color: 'bg-blue-600',   desc: 'Fast static HTML fetch'    },
      { type: 'api-source',     label: 'API Source',     icon: Cpu,         color: 'bg-cyan-600',   desc: 'REST/JSON API endpoint'    },
    ],
  },
  {
    label: 'Process',
    nodes: [
      { type: 'link-extractor',  label: 'Link Extractor',  icon: Link2,      color: 'bg-violet-600', desc: 'Extract links by CSS selector' },
      { type: 'list-scraper',    label: 'List Scraper',    icon: List,       color: 'bg-purple-600', desc: 'Paginate & collect items'      },
      { type: 'field-extractor', label: 'Field Extractor', icon: FileSearch, color: 'bg-amber-600',  desc: 'Extract fields per URL'        },
      { type: 'ai-extractor',    label: 'AI Extractor',    icon: Bot,        color: 'bg-pink-600',   desc: 'AI-powered data extraction'   },
      { type: 'filter',          label: 'Filter',          icon: Filter,     color: 'bg-orange-600', desc: 'Filter records by conditions'  },
      { type: 'transform',       label: 'Transform',       icon: Shuffle,    color: 'bg-yellow-600', desc: 'Rename, omit, compute fields'  },
    ],
  },
  {
    label: 'Output',
    nodes: [
      { type: 'file-export', label: 'File Export', icon: Download, color: 'bg-emerald-600', desc: 'Save JSON, CSV, Excel'  },
      { type: 'webhook',     label: 'Webhook',     icon: Webhook,  color: 'bg-teal-600',    desc: 'POST records to a URL'  },
    ],
  },
] as const

export const PALETTE_NODES: PaletteNodeMeta[] = PALETTE_GROUPS.flatMap(
  (g) => g.nodes as unknown as PaletteNodeMeta[],
)

/** Hex colour for each node type — used by MiniMap and NodeConfigPanel. */
export const NODE_COLOR_MAP: Record<string, string> = {
  'browser-source':  ACCENT_HEX.indigo,
  'http-source':     ACCENT_HEX.blue,
  'api-source':      ACCENT_HEX.cyan,
  'link-extractor':  ACCENT_HEX.violet,
  'list-scraper':    ACCENT_HEX.purple,
  'field-extractor': ACCENT_HEX.amber,
  'ai-extractor':    ACCENT_HEX.pink,
  'filter':          ACCENT_HEX.orange,
  'transform':       ACCENT_HEX.yellow,
  'file-export':     ACCENT_HEX.emerald,
  'webhook':         ACCENT_HEX.teal,
}

/** Accent key (name, not hex) per node type — used by NodeWrapper and NodeConfigPanel. */
export const NODE_ACCENT_KEY: Record<string, string> = {
  'browser-source':  'indigo',
  'http-source':     'blue',
  'api-source':      'cyan',
  'link-extractor':  'violet',
  'list-scraper':    'purple',
  'field-extractor': 'amber',
  'ai-extractor':    'pink',
  'filter':          'orange',
  'transform':       'yellow',
  'file-export':     'emerald',
  'webhook':         'teal',
}
