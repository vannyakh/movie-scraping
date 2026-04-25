/**
 * Public API for the flow nodes module.
 * Import from this file instead of reaching into sub-modules.
 */

// Types
export type {
  BrowserSourceData, HttpSourceData, ApiSourceData,
  LinkExtractorData, ListScraperData, FieldExtractorData, DetailField,
  AIExtractorData, FilterData, TransformData, FileExportData, WebhookData,
} from './types'

// Contexts & hooks
export {
  NodeDetailContext, NodeDetailProvider, useOpenDetail,
  NodeStatusContext, NodeStatusProvider,
  type OpenDetailFn,
} from './context'

// Constants & palette
export {
  ACCENT_HEX, handleStyle, STATUS_BADGE,
  PALETTE_GROUPS, PALETTE_NODES, NODE_COLOR_MAP, NODE_ACCENT_KEY,
  type PaletteNodeMeta,
} from './constants'

// Defaults & data
export {
  DEFAULT_DETAIL_FIELDS, defaultNodeData,
  INITIAL_NODES, INITIAL_EDGES,
  getSampleData,
} from './defaults'

// Shared UI primitives (used by ConfigPanels)
export { inputCls, Field, Toggle, PreviewUrl, PreviewChip, PreviewRow, NodeWrapper } from './NodeWrapper'

// Edge
export { CustomEdge } from './CustomEdge'

// Node components
export {
  BrowserSourceNode, HttpSourceNode, ApiSourceNode,
  LinkExtractorNode, ListScraperNode, FieldExtractorNode,
  AIExtractorNode, FilterNode, TransformNode,
  FileExportNode, WebhookNode,
} from './components'

// ─── Registry maps ────────────────────────────────────────────────────────────
// Defined here (not in components.tsx) to avoid circular imports.

import {
  BrowserSourceNode, HttpSourceNode, ApiSourceNode,
  LinkExtractorNode, ListScraperNode, FieldExtractorNode,
  AIExtractorNode, FilterNode, TransformNode,
  FileExportNode, WebhookNode,
} from './components'
import { CustomEdge } from './CustomEdge'

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
