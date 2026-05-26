/**
 * Data interfaces for each node type's `data` property.
 * These are serialised into WorkflowNodeConfig and interpreted by the main-process engine.
 */

/** How a node uses the proxy — inherits global setting, disables it, or uses a custom URL */
export type ProxyOverride = 'global' | 'none' | 'custom'

// ─── Browser action sequence ──────────────────────────────────────────────────

export type BrowserActionType = 'click' | 'type' | 'wait' | 'scroll' | 'hover' | 'select' | 'screenshot'

export interface BrowserAction {
  id:        string
  type:      BrowserActionType
  selector?: string   // CSS selector (not required for 'wait')
  value?:    string   // text for 'type', ms for 'wait', option for 'select', px for 'scroll'
}

// ─── Pagination modes ─────────────────────────────────────────────────────────

export type PaginationType = 'none' | 'next-button' | 'url-pattern' | 'infinite-scroll'

export interface BrowserSourceData {
  url:           string
  headless:      boolean
  userAgent:     string
  delayMs:       number
  cookies:       string          // cookie string; empty = use global cookies from settings
  proxyOverride: ProxyOverride   // 'global' = use settings proxy
  proxyUrl:      string          // used when proxyOverride === 'custom'
  actions:       BrowserAction[] // pre-scrape action sequence (click banners, log in, etc.)
}

export interface HttpSourceData {
  url:           string
  method:        'GET' | 'POST'
  headers:       string
  body:          string
  proxyOverride: ProxyOverride
  proxyUrl:      string
}

export interface ApiSourceData {
  url:           string
  method:        'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers:       string
  body:          string
  authType:      'none' | 'bearer' | 'api-key'
  authValue:     string
  dataPath:      string
  maxPages:      number
  pageParam:     string
  proxyOverride: ProxyOverride
  proxyUrl:      string
}

export interface DetailField {
  id:       string
  label:    string
  selector: string
  attrName: string
  type:     'text' | 'attr' | 'html'
}

export interface LinkExtractorData {
  selector:      string
  filterPattern: string
  limit:         number
  textSelector:  string
}

export interface ListScraperData {
  itemSelector:     string
  paginationType:   PaginationType
  // next-button mode
  nextPageSelector: string
  // url-pattern mode  (use {page} placeholder)
  urlPattern:       string
  startPage:        number
  // infinite-scroll mode
  scrollDelay:      number
  maxScrolls:       number
  // shared limits
  maxPages:         number
  maxItems:         number
}

export interface FieldExtractorData {
  fields:        DetailField[]
  urlField:      string
  headless:      boolean
  delayMs:       number
  cookies:       string
  proxyOverride: ProxyOverride
  proxyUrl:      string
  actions:       BrowserAction[] // run before extracting fields on each page
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
