import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Play, RotateCcw, HelpCircle } from 'lucide-react'
import {
  nodeTypes,
  defaultNodeData,
  PALETTE_NODES,
  type SourceData,
  type CategoryData,
  type MovieListData,
  type DetailData,
  type ExportData,
} from '@/components/flow/nodes'
import { useScrapingStore } from '@/store/scrapingStore'
import type { ScraperConfig } from '../../lib/ipc'

// ─── Default pipeline ─────────────────────────────────────────────────────────

const INITIAL_NODES: Node[] = [
  {
    id: 'source-1',
    type: 'source',
    position: { x: 40, y: 120 },
    data: { ...defaultNodeData.source },
  },
  {
    id: 'category-1',
    type: 'category',
    position: { x: 400, y: 60 },
    data: { ...defaultNodeData.category },
  },
  {
    id: 'movieList-1',
    type: 'movieList',
    position: { x: 760, y: 20 },
    data: { ...defaultNodeData.movieList },
  },
  {
    id: 'detail-1',
    type: 'detail',
    position: { x: 1120, y: 0 },
    data: { ...defaultNodeData.detail },
  },
  {
    id: 'export-1',
    type: 'export',
    position: { x: 1480, y: 80 },
    data: { ...defaultNodeData.export },
  },
]

const INITIAL_EDGES: Edge[] = [
  { id: 'e-src-cat',   source: 'source-1',    target: 'category-1',  animated: true },
  { id: 'e-cat-list',  source: 'category-1',  target: 'movieList-1', animated: true },
  { id: 'e-list-det',  source: 'movieList-1', target: 'detail-1',    animated: true },
  { id: 'e-det-exp',   source: 'detail-1',    target: 'export-1',    animated: true },
]

// ─── Flow → ScraperConfig ─────────────────────────────────────────────────────

function flowToConfig(nodes: Node[]): ScraperConfig | null {
  const src  = nodes.find(n => n.type === 'source')
  const exp  = nodes.find(n => n.type === 'export')
  if (!src || !exp) return null

  const sd = src.data as unknown as SourceData
  const ed = exp.data as unknown as ExportData
  if (!sd.baseUrl?.trim())   return null
  if (!ed.outputDir?.trim()) return null

  const cat = nodes.find(n => n.type === 'category')
  const lst = nodes.find(n => n.type === 'movieList')
  const det = nodes.find(n => n.type === 'detail')

  const sels: ScraperConfig['selectors'] = {}
  let hasSel = false

  if (cat) {
    const c = cat.data as unknown as CategoryData
    if (c.selector.trim()) { sels.categories = c.selector.trim(); hasSel = true }
  }

  if (lst) {
    const l = lst.data as unknown as MovieListData
    if (l.movieSelector.trim())    { sels.movieList = l.movieSelector.trim();    hasSel = true }
    if (l.nextPageSelector.trim()) { sels.nextPage  = l.nextPageSelector.trim(); hasSel = true }
  }

  if (det) {
    const detSels: NonNullable<ScraperConfig['selectors']>['detail'] = {}
    let hasDet = false
    const d = det.data as unknown as DetailData
    if (d.titleSelector.trim())       { detSels.title       = d.titleSelector.trim();       hasDet = true }
    if (d.yearSelector.trim())        { detSels.year        = d.yearSelector.trim();        hasDet = true }
    if (d.ratingSelector.trim())      { detSels.rating      = d.ratingSelector.trim();      hasDet = true }
    if (d.durationSelector.trim())    { detSels.duration    = d.durationSelector.trim();    hasDet = true }
    if (d.directorSelector.trim())    { detSels.director    = d.directorSelector.trim();    hasDet = true }
    if (d.descriptionSelector.trim()) { detSels.description = d.descriptionSelector.trim(); hasDet = true }
    if (d.castSelector.trim())        { detSels.cast        = d.castSelector.trim();        hasDet = true }
    if (d.posterSelector.trim())      { detSels.poster      = d.posterSelector.trim();      hasDet = true }
    if (hasDet) { sels.detail = detSels; hasSel = true }
  }

  const ld = lst?.data as unknown as MovieListData | undefined

  return {
    baseUrl:              sd.baseUrl.trim(),
    outputDir:            ed.outputDir.trim(),
    headless:             sd.headless,
    delayMs:              sd.delayMs ?? 500,
    userAgent:            sd.userAgent?.trim() || undefined,
    maxMoviesPerCategory: ld?.maxMovies  || undefined,
    maxPagesPerCategory:  ld?.maxPages   || undefined,
    exportJson:           ed.exportJson,
    exportExcel:          ed.exportExcel,
    exportCsv:            ed.exportCsv,
    selectors:            hasSel ? sels : undefined,
  }
}

// ─── Node Palette ─────────────────────────────────────────────────────────────

function NodePalette() {
  return (
    <aside className="w-52 shrink-0 flex flex-col gap-2 bg-[#13151f] border-r border-[#2e3350] p-3 overflow-y-auto">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 pt-1">Node Types</p>
      <p className="text-[10px] text-slate-600 leading-relaxed px-1">Drag a node onto the canvas to add it to your flow.</p>
      <div className="flex flex-col gap-2 mt-1">
        {PALETTE_NODES.map(({ type, label, icon: Icon, color, desc }) => (
          <div
            key={type}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('application/reactflow/type', type)
              e.dataTransfer.effectAllowed = 'move'
            }}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a1d27] border border-[#2e3350] cursor-grab active:cursor-grabbing hover:border-[#3d4470] transition-colors select-none"
          >
            <div className={`w-7 h-7 rounded-md ${color} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 leading-tight">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-[#2e3350]">
        <div className="rounded-lg bg-indigo-600/10 border border-indigo-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            <p className="text-[10px] font-semibold text-indigo-300">Tips</p>
          </div>
          <ul className="text-[9px] text-indigo-200/70 space-y-1 leading-relaxed">
            <li>• Connect nodes left→right</li>
            <li>• Leave selectors blank to auto-detect</li>
            <li>• Source + Export nodes required</li>
          </ul>
        </div>
      </div>
    </aside>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function FlowCanvas() {
  const navigate   = useNavigate()
  const store      = useScrapingStore()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const { screenToFlowPosition } = useReactFlow()

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges(eds => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/reactflow/type')
      if (!type || !(type in defaultNodeData)) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const newNode: Node = {
        id:       `${type}-${Date.now()}`,
        type,
        position,
        data:     { ...defaultNodeData[type] },
      }
      setNodes(nds => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  const handleReset = useCallback(() => {
    setNodes(INITIAL_NODES.map(n => ({ ...n, data: { ...defaultNodeData[n.type!] } })))
    setEdges(INITIAL_EDGES)
    toast.info('Flow reset to default pipeline')
  }, [setNodes, setEdges])

  const handleRun = useCallback(async () => {
    const config = flowToConfig(nodes)
    if (!config) {
      toast.error('Flow is incomplete', {
        description: 'Add a Source node (with URL) and an Export node (with output folder), then connect them.',
      })
      return
    }
    if (!config.exportJson && !config.exportExcel && !config.exportCsv) {
      toast.error('No export format selected', { description: 'Enable at least one format in the Export node.' })
      return
    }

    store.initJob(config)
    window.electronAPI.startScraping(config).catch(() => {})
    toast.success('Scraping started!', { description: config.baseUrl })
    navigate('/progress')
  }, [nodes, store, navigate])

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-[#2e3350] bg-[#13151f] shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-slate-100">Flow Builder</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Build your scraping pipeline visually — connect nodes and configure custom CSS selectors per stage.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-[#2e3350] hover:border-[#3d4470] hover:text-slate-200 bg-[#1a1d27] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          onClick={handleRun}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/40"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Run Flow
        </button>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />

        <div ref={reactFlowWrapper} className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
            }}
            style={{ background: '#0f1117' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#2e3350"
              gap={20}
              size={1.2}
            />
            <Controls
              style={{
                background: '#13151f',
                border: '1px solid #2e3350',
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{
                background: '#13151f',
                border: '1px solid #2e3350',
                borderRadius: 8,
              }}
              nodeColor={(n) => {
                const map: Record<string, string> = {
                  source:    '#6366f1',
                  category:  '#8b5cf6',
                  movieList: '#10b981',
                  detail:    '#f59e0b',
                  export:    '#64748b',
                }
                return map[n.type ?? ''] ?? '#334155'
              }}
              maskColor="rgba(15, 17, 23, 0.7)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
