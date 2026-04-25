/**
 * Data interfaces for each node type's `data` property.
 * These are serialised into WorkflowNodeConfig and interpreted by the main-process engine.
 */

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
