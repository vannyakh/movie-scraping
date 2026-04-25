import type { Node, Edge } from '@xyflow/react'
import type {
  BrowserSourceData, HttpSourceData, ApiSourceData,
  LinkExtractorData, ListScraperData, FieldExtractorData,
  AIExtractorData, FilterData, TransformData, FileExportData, WebhookData,
  DetailField,
} from './types'

// ─── Default field list for FieldExtractor ────────────────────────────────────

export const DEFAULT_DETAIL_FIELDS: DetailField[] = [
  { id: 'title',       label: 'Title',       selector: '', attrName: '',     type: 'text' },
  { id: 'description', label: 'Description', selector: '', attrName: '',     type: 'text' },
  { id: 'url',         label: 'URL',         selector: '', attrName: 'href', type: 'attr' },
  { id: 'image',       label: 'Image',       selector: '', attrName: 'src',  type: 'attr' },
  { id: 'date',        label: 'Date',        selector: '', attrName: '',     type: 'text' },
  { id: 'author',      label: 'Author',      selector: '', attrName: '',     type: 'text' },
]

// ─── Default data per node type ───────────────────────────────────────────────

export const defaultNodeData: Record<string, object> = {
  'browser-source':  { url: '', headless: true, userAgent: '', delayMs: 500, cookies: '' }          satisfies BrowserSourceData,
  'http-source':     { url: '', method: 'GET', headers: '{}', body: '' }                            satisfies HttpSourceData,
  'api-source':      { url: '', method: 'GET', headers: '{}', body: '', authType: 'none',
                       authValue: '', dataPath: '', maxPages: 1, pageParam: 'page' }                 satisfies ApiSourceData,
  'link-extractor':  { selector: 'a[href]', filterPattern: '', limit: 200, textSelector: '' }       satisfies LinkExtractorData,
  'list-scraper':    { itemSelector: '', nextPageSelector: '', maxPages: 5, maxItems: 100 }          satisfies ListScraperData,
  'field-extractor': { fields: DEFAULT_DETAIL_FIELDS.map((f) => ({ ...f })),
                       urlField: '_url', headless: true, delayMs: 300 }                             satisfies FieldExtractorData,
  'ai-extractor':    { instruction: 'Extract the main content from this page',
                       fields: [], inputField: '_html', model: 'gpt-4o-mini' }                      satisfies AIExtractorData,
  'filter':          { conditions: [{ id: 'c1', field: '', operator: 'exists', value: '' }],
                       logic: 'AND' }                                                                satisfies FilterData,
  'transform':       { renames: [], omit: '', computed: [] }                                        satisfies TransformData,
  'file-export':     { outputDir: '', exportJson: true, exportExcel: false,
                       exportCsv: true, filename: 'output' }                                        satisfies FileExportData,
  'webhook':         { url: '', method: 'POST', headers: '{}', batchSize: 100 }                     satisfies WebhookData,
}

// ─── Default starter workflow ─────────────────────────────────────────────────

export const INITIAL_NODES: Node[] = [
  { id: 'browser-source-1',  type: 'browser-source',  position: { x: 60,   y: 160 }, data: { ...defaultNodeData['browser-source'] }  },
  { id: 'link-extractor-1',  type: 'link-extractor',  position: { x: 380,  y: 160 }, data: { ...defaultNodeData['link-extractor'] }  },
  { id: 'field-extractor-1', type: 'field-extractor', position: { x: 700,  y: 160 }, data: { fields: DEFAULT_DETAIL_FIELDS.map((f) => ({ ...f })), urlField: '_url', headless: true, delayMs: 300 } },
  { id: 'file-export-1',     type: 'file-export',     position: { x: 1020, y: 160 }, data: { ...defaultNodeData['file-export'] } },
]

export const INITIAL_EDGES: Edge[] = [
  { id: 'e-src-ext',  source: 'browser-source-1',  target: 'link-extractor-1',  type: 'custom', animated: true },
  { id: 'e-ext-fld',  source: 'link-extractor-1',  target: 'field-extractor-1', type: 'custom', animated: true },
  { id: 'e-fld-exp',  source: 'field-extractor-1', target: 'file-export-1',     type: 'custom', animated: true },
]

// ─── Sample preview data (used by NodeConfigPanel → Preview tab) ──────────────

export function getSampleData(nodeType: string, nodeData: unknown): unknown {
  switch (nodeType) {
    case 'browser-source':
    case 'http-source': {
      const d = nodeData as { url?: string }
      return [{ _url: d.url || 'https://example.com', _html: '<html>…</html>', _status: 200 }]
    }
    case 'api-source':
      return [{ id: 1, name: 'Item A', price: 29.99 }, { id: 2, name: 'Item B', price: 49.99 }]
    case 'link-extractor':
      return [
        { url: 'https://example.com/product/1', text: 'Widget Pro',   _sourceUrl: 'https://example.com' },
        { url: 'https://example.com/product/2', text: 'Widget Basic', _sourceUrl: 'https://example.com' },
      ]
    case 'list-scraper':
      return [
        { url: 'https://example.com/product/1', text: 'Widget Pro',   _page: 1 },
        { url: 'https://example.com/product/2', text: 'Widget Basic', _page: 2 },
      ]
    case 'field-extractor': {
      const d = nodeData as FieldExtractorData
      const fields = d?.fields ?? DEFAULT_DETAIL_FIELDS
      const sample: Record<string, unknown> = { _url: 'https://example.com/product/1' }
      const SAMPLES: Record<string, unknown> = {
        title: 'Widget Pro 3000', description: 'The best widget ever made.', url: '/product/widget-pro',
        image: 'https://example.com/images/widget-pro.jpg', date: '2024-01-15', author: 'Jane Smith',
      }
      for (const f of fields) sample[f.id] = SAMPLES[f.id] ?? `<${f.label} value>`
      return [sample]
    }
    case 'ai-extractor':
      return [{ title: 'Product Name', price: '$29.99', description: 'AI-extracted description' }]
    case 'filter':
      return [{ title: 'Widget Pro', price: '$29.99' }, { title: 'Widget Basic', price: '$9.99' }]
    case 'transform':
      return [{ name: 'Widget Pro', cost: '$29.99' }]
    case 'file-export': {
      const d = nodeData as FileExportData
      const formats = [d?.exportJson && 'json', d?.exportExcel && 'xlsx', d?.exportCsv && 'csv'].filter(Boolean)
      return { outputDir: d?.outputDir || '/output', files: formats.map((ext) => `output.${ext}`), totalRecords: 42 }
    }
    case 'webhook':
      return { sent: 42, success: true, statusCode: 200, batches: 1 }
    default:
      return {}
  }
}
