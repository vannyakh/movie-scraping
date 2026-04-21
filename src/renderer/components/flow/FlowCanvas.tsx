import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  Background,
  BackgroundVariant,
  MiniMap,
  SelectionMode,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play, RotateCcw, Save, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2,
  Undo2, Redo2,
  Maximize2, ZoomIn, ZoomOut,
  MousePointer2, Hand,
} from 'lucide-react'
import {
  nodeTypes, edgeTypes, defaultNodeData, NodeDetailProvider,
  DEFAULT_DETAIL_FIELDS, INITIAL_NODES, INITIAL_EDGES,
} from './nodes'
import { NodeConfigPanel } from './NodeConfigPanel'
import { NodePalette } from './NodePalette'
import { flowToConfig, isFlowValid } from './flowToConfig'
import { useScrapingStore } from '@/store/scrapingStore'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowCanvasProps {
  projectId?:    string
  projectName?:  string
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onSave?: (nodes: Node[], edges: Edge[]) => void
}

interface Snapshot { nodes: Node[]; edges: Edge[] }

// ─── useFlowHistory ───────────────────────────────────────────────────────────

const MAX_HISTORY = 60

function useFlowHistory() {
  const past   = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncFlags = () => {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  const push = useCallback((snapshot: Snapshot) => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), snapshot]
    future.current = []
    syncFlags()
  }, [])

  const undo = useCallback((current: Snapshot, restore: (s: Snapshot) => void) => {
    const prev = past.current[past.current.length - 1]
    if (!prev) return
    future.current = [current, ...future.current.slice(0, MAX_HISTORY - 1)]
    past.current   = past.current.slice(0, -1)
    restore(prev)
    syncFlags()
  }, [])

  const redo = useCallback((current: Snapshot, restore: (s: Snapshot) => void) => {
    const next = future.current[0]
    if (!next) return
    past.current   = [...past.current.slice(-(MAX_HISTORY - 1)), current]
    future.current = future.current.slice(1)
    restore(next)
    syncFlags()
  }, [])

  return { push, undo, redo, canUndo, canRedo }
}

// ─── Custom controls panel ────────────────────────────────────────────────────

function FlowControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const btn = cn(
    'w-8 h-8 flex items-center justify-center rounded-lg',
    'bg-[#1e2133] border border-[#2a2d3e]',
    'text-slate-500 hover:text-slate-100 hover:border-[#3d4470] hover:bg-[#252840]',
    'transition-all shadow-sm',
  )

  return (
    <Panel position="bottom-left" className="flex gap-1 ml-2 mb-2">
      <button
        onClick={() => fitView({ padding: 0.2, duration: 300 })}
        className={btn}
        title="Fit view (F)"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className={btn}
        title="Zoom in"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className={btn}
        title="Zoom out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
    </Panel>
  )
}

// ─── Inner canvas ─────────────────────────────────────────────────────────────

function Canvas({ projectId, projectName, initialNodes, initialEdges, onSave }: FlowCanvasProps) {
  const navigate      = useNavigate()
  const scrapingStore = useScrapingStore()
  const wrapperRef    = useRef<HTMLDivElement>(null)

  const [nodes, setNodes] = useState<Node[]>(initialNodes ?? INITIAL_NODES)
  const [edges, setEdges] = useState<Edge[]>(initialEdges ?? INITIAL_EDGES)
  const {
    screenToFlowPosition, updateNodeData, deleteElements, fitView,
  } = useReactFlow()

  const [configNodeId, setConfigNodeId] = useState<string | null>(null)
  const [configTab,    setConfigTab]    = useState<'config' | 'preview'>('config')

  // ── Undo/Redo ────────────────────────────────────────────────────────────
  const history = useFlowHistory()
  const isApplyingHistory = useRef(false)

  const restore = useCallback((snap: Snapshot) => {
    isApplyingHistory.current = true
    setNodes(snap.nodes)
    setEdges(snap.edges)
    requestAnimationFrame(() => { isApplyingHistory.current = false })
  }, [])

  const currentSnap  = useCallback((): Snapshot => ({ nodes, edges }), [nodes, edges])
  const handleUndo   = useCallback(() => history.undo(currentSnap(), restore),  [history, currentSnap, restore])
  const handleRedo   = useCallback(() => history.redo(currentSnap(), restore),  [history, currentSnap, restore])

  // ── Interaction mode (select / pan) ──────────────────────────────────────
  // lockedPanMode: user clicked the Hand button → always pan on drag
  // spaceHeld:     Space is currently pressed  → temporarily pan on drag
  const [lockedPanMode, setLockedPanMode] = useState(false)
  const [spaceHeld,     setSpaceHeld]     = useState(false)
  const isPanMode = lockedPanMode || spaceHeld

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      setSpaceHeld(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
    }
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────────
  const [isDirty,   setIsDirty]   = useState(false)
  const [isSaving,  setIsSaving]  = useState(false)
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved'>('save')
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (onSave && !isApplyingHistory.current) setIsDirty(true)
  }, [nodes, edges, onSave])

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!onSave || !isDirty) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      onSave(nodes, edges)
      setIsDirty(false)
    }, 3000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [nodes, edges, isDirty, onSave])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setIsSaving(true)
    onSave(nodes, edges)
    setIsDirty(false)
    await new Promise(r => setTimeout(r, 300))
    setIsSaving(false)
    setSaveLabel('saved')
    toast.success('Project saved')
    setTimeout(() => setSaveLabel('save'), 2000)
  }, [onSave, nodes, edges])

  // ── React Flow change handlers ────────────────────────────────────────────

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!isApplyingHistory.current) {
      const hasDragEnd = changes.some(
        c => c.type === 'position' && (c as NodeChange & { dragging?: boolean }).dragging === false,
      )
      if (hasDragEnd) history.push(currentSnap())
    }
    setNodes(nds => applyNodeChanges(changes, nds))
  }, [history, currentSnap])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect: OnConnect = useCallback((conn) => {
    if (!isApplyingHistory.current) history.push(currentSnap())
    setEdges(eds => addEdge({ ...conn, type: 'custom', animated: true }, eds))
  }, [history, currentSnap])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow/type')
    if (!type || !(type in defaultNodeData)) return
    history.push(currentSnap())
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const data = type === 'detail'
      ? { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) }
      : { ...defaultNodeData[type] }
    setNodes(nds => [...nds, { id: `${type}-${Date.now()}`, type, position, data }])
  }, [history, currentSnap, screenToFlowPosition])

  const handleUpdateNodeData = useCallback((id: string, patch: Partial<object>) => {
    history.push(currentSnap())
    updateNodeData(id, patch)
  }, [history, currentSnap, updateNodeData])

  const handleDeleteNode = useCallback((id: string) => {
    history.push(currentSnap())
    deleteElements({ nodes: [{ id }] })
    toast.info('Node deleted')
  }, [history, currentSnap, deleteElements])

  const handleReset = useCallback(() => {
    history.push(currentSnap())
    setNodes(INITIAL_NODES.map(n => ({
      ...n,
      data: n.type === 'detail'
        ? { fields: DEFAULT_DETAIL_FIELDS.map(f => ({ ...f })) }
        : { ...defaultNodeData[n.type!] },
    })))
    setEdges(INITIAL_EDGES)
    setConfigNodeId(null)
    toast.info('Flow reset to default pipeline')
  }, [history, currentSnap])

  const handleRun = useCallback(async () => {
    const config = flowToConfig(nodes)
    if (!config) {
      toast.error('Flow is incomplete', {
        description: 'Source node needs a URL · Export node needs an output folder.',
      })
      return
    }
    if (!config.exportJson && !config.exportExcel && !config.exportCsv) {
      toast.error('No export format selected', {
        description: 'Enable at least one format in the Export node.',
      })
      return
    }
    if (onSave) { onSave(nodes, edges); setIsDirty(false) }
    scrapingStore.initJob(config)
    window.electronAPI.startScraping(config).catch(() => {})
    toast.success('Scraping started!', { description: config.baseUrl })
    navigate('/progress')
  }, [nodes, edges, scrapingStore, navigate, onSave])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod    = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (mod && e.key === 's' && onSave)                         { e.preventDefault(); handleSave();  return }
      if (mod && e.key === 'z' && !e.shiftKey)                    { e.preventDefault(); handleUndo();  return }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))){ e.preventDefault(); handleRedo();  return }

      // Fit view
      if (!inInput && e.key === 'f') {
        e.preventDefault()
        fitView({ padding: 0.2, duration: 300 })
        return
      }

      // Delete selected
      if (!inInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        const selNodes = nodes.filter(n => n.selected)
        const selEdges = edges.filter(ed => ed.selected)
        if (selNodes.length || selEdges.length) {
          history.push(currentSnap())
          deleteElements({
            nodes: selNodes.map(n => ({ id: n.id })),
            edges: selEdges.map(ed => ({ id: ed.id })),
          })
          if (selNodes.some(n => n.id === configNodeId)) setConfigNodeId(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    nodes, edges, history, currentSnap, deleteElements, configNodeId,
    onSave, handleSave, handleUndo, handleRedo, fitView,
  ])

  // ── Derived ───────────────────────────────────────────────────────────────
  const flowValid = isFlowValid(nodes)
  const openPanel = useCallback((nodeId: string, tab: 'config' | 'preview' = 'config') => {
    setConfigNodeId(nodeId); setConfigTab(tab)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <NodeDetailProvider value={openPanel}>
      <div className="flex flex-col h-screen bg-[#0f1117] overflow-hidden">

        {/* ── Toolbar ── */}
        <header className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#2e3350] bg-[#13151f] shrink-0">

          {/* Back breadcrumb */}
          {projectId && (
            <>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition-colors shrink-0 group"
                title="Back to Projects"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors hidden sm:inline">
                  Projects
                </span>
              </button>
              <span className="text-[#2e3350] text-xs shrink-0">/</span>
            </>
          )}

          {/* Title + validity */}
          <div className="flex-1 min-w-0 mr-2">
            <h1 className="text-sm font-semibold text-slate-100 truncate leading-none">
              {projectName ?? 'Flow Builder'}
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              {flowValid
                ? <><CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" /><span className="text-[10px] text-emerald-500">Ready to run</span></>
                : <><AlertCircle  className="w-2.5 h-2.5 text-slate-600   shrink-0" /><span className="text-[10px] text-slate-600">Source URL &amp; export folder required</span></>}
            </div>
          </div>

          {/* Node/edge counts */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-600 shrink-0 border-r border-[#2e3350] pr-3 mr-1">
            <span>{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
            <span>{edges.length} connection{edges.length !== 1 ? 's' : ''}</span>
          </div>

          {/* ── Mode toggle: Select / Pan ── */}
          <div
            className="hidden sm:flex items-center gap-0.5 shrink-0 bg-[#0f1117] border border-[#2e3350] rounded-lg p-0.5 mr-1"
            title={isPanMode ? 'Pan mode (Space to hold · click to lock)' : 'Select mode (Space = pan)'}
          >
            {/* Select */}
            <button
              onClick={() => setLockedPanMode(false)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                !lockedPanMode
                  ? 'bg-[#1e2133] text-slate-200 shadow-sm'
                  : 'text-slate-600 hover:text-slate-400',
              )}
              title="Select mode (default)"
            >
              <MousePointer2 className="w-3 h-3" />
              <span className="hidden md:inline">Select</span>
            </button>
            {/* Pan */}
            <button
              onClick={() => setLockedPanMode(v => !v)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                lockedPanMode || spaceHeld
                  ? 'bg-indigo-600/20 text-indigo-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-400',
              )}
              title="Pan mode (or hold Space)"
            >
              <Hand className="w-3 h-3" />
              <span className="hidden md:inline">Pan</span>
              {!lockedPanMode && (
                <span className="hidden lg:inline text-[9px] text-slate-700 ml-0.5">Space</span>
              )}
            </button>
          </div>

          {/* ── Undo / Redo ── */}
          <div className="flex items-center gap-0.5 shrink-0 border-r border-[#2e3350] pr-1.5 mr-1">
            <button
              onClick={handleUndo}
              disabled={!history.canUndo}
              title="Undo (Ctrl+Z)"
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                history.canUndo
                  ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  : 'text-slate-700 cursor-not-allowed',
              )}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!history.canRedo}
              title="Redo (Ctrl+Y)"
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                history.canRedo
                  ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  : 'text-slate-700 cursor-not-allowed',
              )}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-[#2e3350] hover:border-[#3d4470] hover:text-slate-200 bg-[#1a1d27] transition-colors shrink-0"
            title="Reset pipeline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Save */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              title="Save (Ctrl+S)"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0',
                isSaving
                  ? 'text-slate-500 border-[#2e3350] bg-[#1a1d27] cursor-default'
                  : saveLabel === 'saved'
                    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                    : isDirty
                      ? 'text-amber-300 border-amber-500/40 bg-amber-950/20 hover:border-amber-400'
                      : 'text-slate-400 border-[#2e3350] bg-[#1a1d27] hover:border-[#3d4470] hover:text-slate-200',
              )}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isSaving ? 'Saving…' : saveLabel === 'saved' ? 'Saved!' : isDirty ? 'Unsaved' : 'Save'}
              </span>
              {isDirty && !isSaving && saveLabel !== 'saved' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              )}
            </button>
          )}

          {/* Run */}
          <button
            onClick={handleRun}
            title={flowValid ? 'Run scraping' : 'Complete the flow first'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors shrink-0',
              flowValid
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40'
                : 'bg-indigo-600/40 cursor-default',
            )}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span className="hidden sm:inline">Run</span>
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />

          {/* Apply grab cursor class when in pan mode */}
          <div
            ref={wrapperRef}
            className={cn('flex-1 relative overflow-hidden', isPanMode && 'flow-pan-mode')}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={null}
              defaultEdgeOptions={{ type: 'custom', animated: true }}
              /* ── Interaction mode ──────────────── */
              panOnDrag={lockedPanMode ? true : [1, 2]}   // locked = left drag pans; else middle/right only
              panActivationKeyCode={lockedPanMode ? null : 'Space'} // Space = temp pan (when not locked)
              selectionOnDrag={!lockedPanMode}             // rubber-band select when not locked
              selectionMode={SelectionMode.Partial}        // partial overlap counts as selected
              /* ─────────────────────────────────── */
              style={{ background: '#0f1117' }}
            >
              <Background variant={BackgroundVariant.Dots} color="#1e2133" gap={20} size={1.2} />
              <MiniMap
                style={{ background: '#13151f', border: '1px solid #2e3350', borderRadius: 8 }}
                nodeColor={(n) => ({
                  source:    '#6366f1',
                  category:  '#8b5cf6',
                  movieList: '#10b981',
                  detail:    '#f59e0b',
                  export:    '#64748b',
                })[n.type ?? ''] ?? '#334155'}
                maskColor="rgba(15,17,23,0.7)"
              />
              <FlowControls />
            </ReactFlow>

            <NodeConfigPanel
              nodeId={configNodeId}
              nodes={nodes}
              defaultTab={configTab}
              onClose={() => { setConfigNodeId(null); setConfigTab('config') }}
              onUpdateNodeData={handleUpdateNodeData}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        </div>
      </div>
    </NodeDetailProvider>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
