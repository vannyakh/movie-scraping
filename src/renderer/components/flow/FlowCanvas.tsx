import { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Panel, Background, BackgroundVariant,
  MiniMap, SelectionMode, addEdge, applyNodeChanges, applyEdgeChanges,
  useReactFlow,
  type Node, type Edge, type OnConnect, type NodeChange, type EdgeChange,
} from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play, RotateCcw, Save, ArrowLeft, CheckCircle2, AlertCircle, Loader2,
  Undo2, Redo2, Maximize2, ZoomIn, ZoomOut, MousePointer2, Hand,
  Sparkles, Pause, Square,
} from 'lucide-react'
import {
  nodeTypes, edgeTypes, defaultNodeData, NodeDetailProvider, NodeStatusProvider,
  DEFAULT_DETAIL_FIELDS, INITIAL_NODES, INITIAL_EDGES,
} from './nodes'
import { NodeConfigPanel } from './NodeConfigPanel'
import { NodePalette }     from './NodePalette'
import { flowToWorkflow, isFlowValid } from './flowToWorkflow'
import { useJobStore } from '@/store/jobStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowCanvasProps {
  projectId?:    string
  projectName?:  string
  workflowId?:   string
  workflowName?: string
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

  const push = useCallback((snap: Snapshot) => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), snap]
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

// ─── Custom controls ──────────────────────────────────────────────────────────

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
      <button onClick={() => fitView({ padding: 0.2, duration: 300 })} className={btn} title="Fit view (F)">
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => zoomIn({ duration: 200 })} className={btn} title="Zoom in">
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => zoomOut({ duration: 200 })} className={btn} title="Zoom out">
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
    </Panel>
  )
}

// ─── AI assistant prompt modal ─────────────────────────────────────────────────

function AIPromptModal({
  onClose,
  onSubmit,
}: { onClose: () => void; onSubmit: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    await onSubmit(prompt.trim())
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d27] border border-[#2e3350] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Build Workflow with AI</h2>
            <p className="text-xs text-slate-500">Describe what you want to scrape</p>
          </div>
        </div>
        <textarea
          autoFocus
          className="w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-pink-500 transition-colors resize-none h-28"
          placeholder="e.g. Scrape product names, prices, and ratings from an e-commerce site and save as CSV…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }}
        />
        <p className="text-[10px] text-slate-600 mt-1.5">Ctrl+Enter to submit</p>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-lg transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inner canvas ─────────────────────────────────────────────────────────────

function Canvas({ projectId, projectName, workflowId, workflowName, initialNodes, initialEdges, onSave }: FlowCanvasProps) {
  const navigate      = useNavigate()
  const jobStore      = useJobStore()
  const { settings }  = useSettingsStore()
  const wrapperRef    = useRef<HTMLDivElement>(null)

  const [nodes, setNodes] = useState<Node[]>(initialNodes ?? INITIAL_NODES)
  const [edges, setEdges] = useState<Edge[]>(initialEdges ?? INITIAL_EDGES)
  const { screenToFlowPosition, updateNodeData, deleteElements, fitView } = useReactFlow()

  const [configNodeId, setConfigNodeId] = useState<string | null>(null)
  const [configTab,    setConfigTab]    = useState<'config' | 'preview'>('config')
  const [showAIModal,  setShowAIModal]  = useState(false)

  // ── Undo/Redo ────────────────────────────────────────────────────────────
  const history = useFlowHistory()
  const isApplyingHistory = useRef(false)

  const restore      = useCallback((snap: Snapshot) => {
    isApplyingHistory.current = true
    setNodes(snap.nodes)
    setEdges(snap.edges)
    requestAnimationFrame(() => { isApplyingHistory.current = false })
  }, [])

  const currentSnap  = useCallback((): Snapshot => ({ nodes, edges }), [nodes, edges])
  const handleUndo   = useCallback(() => history.undo(currentSnap(), restore), [history, currentSnap, restore])
  const handleRedo   = useCallback(() => history.redo(currentSnap(), restore), [history, currentSnap, restore])

  // ── Interaction mode ──────────────────────────────────────────────────────
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
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
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
    autoSaveTimer.current = setTimeout(() => { onSave(nodes, edges); setIsDirty(false) }, 3000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [nodes, edges, isDirty, onSave])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setIsSaving(true)
    onSave(nodes, edges)
    setIsDirty(false)
    await new Promise((r) => setTimeout(r, 300))
    setIsSaving(false)
    setSaveLabel('saved')
    toast.success('Workflow saved')
    setTimeout(() => setSaveLabel('save'), 2000)
  }, [onSave, nodes, edges])

  // ── React Flow change handlers ────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!isApplyingHistory.current) {
      const hasDragEnd = changes.some((c) => c.type === 'position' && (c as NodeChange & { dragging?: boolean }).dragging === false)
      if (hasDragEnd) history.push(currentSnap())
    }
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [history, currentSnap])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect: OnConnect = useCallback((conn) => {
    if (!isApplyingHistory.current) history.push(currentSnap())
    setEdges((eds) => addEdge({ ...conn, type: 'custom', animated: true }, eds))
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
    const data = type === 'field-extractor'
      ? { fields: DEFAULT_DETAIL_FIELDS.map((f) => ({ ...f })), urlField: '_url', headless: true, delayMs: 300 }
      : { ...defaultNodeData[type] }
    setNodes((nds) => [...nds, { id: `${type}-${Date.now()}`, type, position, data }])
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
    setNodes(INITIAL_NODES.map((n) => ({
      ...n,
      data: n.type === 'field-extractor'
        ? { fields: DEFAULT_DETAIL_FIELDS.map((f) => ({ ...f })), urlField: '_url', headless: true, delayMs: 300 }
        : { ...defaultNodeData[n.type!] },
    })))
    setEdges(INITIAL_EDGES)
    setConfigNodeId(null)
    toast.info('Workflow reset to default pipeline')
  }, [history, currentSnap])

  // ── Run ───────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    const resolvedWorkflowId = workflowId ?? projectId ?? `wf-${Date.now()}`
    const config = flowToWorkflow(nodes, edges, resolvedWorkflowId, projectId)
    if (!config) {
      toast.error('Workflow is incomplete', {
        description: 'Add a source node with a URL and an output node.',
      })
      return
    }

    const hasExport = nodes.some((n) => n.type === 'file-export')
    const exportNode = nodes.find((n) => n.type === 'file-export')
    if (hasExport && !(exportNode?.data as { exportJson?: boolean; exportExcel?: boolean; exportCsv?: boolean })?.exportJson
      && !(exportNode?.data as { exportJson?: boolean; exportExcel?: boolean; exportCsv?: boolean })?.exportExcel
      && !(exportNode?.data as { exportJson?: boolean; exportExcel?: boolean; exportCsv?: boolean })?.exportCsv) {
      toast.error('No export format selected', { description: 'Enable JSON, Excel, or CSV in the File Export node.' })
      return
    }

    if (onSave) { onSave(nodes, edges); setIsDirty(false) }
    jobStore.initJob(config, workflowName ?? projectName)
    window.electronAPI.startWorkflow(config).catch(() => {})
    toast.success('Workflow started!', { description: (nodes.find((n) => ['browser-source','http-source','api-source'].includes(n.type ?? ''))?.data as { url?: string })?.url })
    navigate('/progress')
  }, [nodes, edges, jobStore, navigate, onSave, projectId, projectName])

  // ── Pause / Stop (from progress page navigation) ──────────────────────────
  const activeJob     = useJobStore((s) => s.activeJob)
  const isRunning     = activeJob?.status === 'running'
  const nodeStatusMap = useMemo(() => {
    if (!activeJob) return {}
    return Object.fromEntries(
      Object.entries(activeJob.nodeStatuses).map(([nid, ns]) => [nid, ns.status]),
    )
  }, [activeJob])

  // ── AI generate ───────────────────────────────────────────────────────────
  const handleAIGenerate = useCallback(async (prompt: string) => {
    if (settings.aiProvider === 'none' || !settings.aiApiKey) {
      toast.error('AI not configured', { description: 'Add an API key in Settings → AI.' })
      return
    }
    try {
      const result = await window.electronAPI.generateWorkflow(prompt)
      if (!result) { toast.error('AI could not generate a workflow'); return }
      history.push(currentSnap())
      setNodes((result.nodes as Node[]).map((n, i) => ({
        ...n,
        position: n.position ?? { x: i * 360, y: 100 },
      })))
      setEdges(result.edges as Edge[])
      toast.success('Workflow generated by AI!')
    } catch {
      toast.error('AI generation failed')
    }
  }, [settings, history, currentSnap])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod    = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (mod && e.key === 's' && onSave)                          { e.preventDefault(); handleSave(); return }
      if (mod && e.key === 'z' && !e.shiftKey)                     { e.preventDefault(); handleUndo(); return }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return }
      if (!inInput && e.key === 'f') { e.preventDefault(); fitView({ padding: 0.2, duration: 300 }); return }

      if (!inInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        const selNodes = nodes.filter((n) => n.selected)
        const selEdges = edges.filter((ed) => ed.selected)
        if (selNodes.length || selEdges.length) {
          history.push(currentSnap())
          deleteElements({ nodes: selNodes.map((n) => ({ id: n.id })), edges: selEdges.map((ed) => ({ id: ed.id })) })
          if (selNodes.some((n) => n.id === configNodeId)) setConfigNodeId(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodes, edges, history, currentSnap, deleteElements, configNodeId, onSave, handleSave, handleUndo, handleRedo, fitView])

  const flowValid = isFlowValid(nodes, edges)
  const openPanel = useCallback((nodeId: string, tab: 'config' | 'preview' = 'config') => {
    setConfigNodeId(nodeId); setConfigTab(tab)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <NodeStatusProvider value={nodeStatusMap}>
    <NodeDetailProvider value={openPanel}>
      <div className="flex flex-col h-screen bg-[#0f1117] overflow-hidden">

        {/* ── Toolbar ── */}
        <header className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#2e3350] bg-[#13151f] shrink-0">

          {projectId && (
            <>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition-colors shrink-0 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors hidden sm:inline">Projects</span>
              </button>
              <span className="text-[#2e3350] text-xs shrink-0">/</span>
            </>
          )}

          <div className="flex-1 min-w-0 mr-2">
            <h1 className="text-sm font-semibold text-slate-100 truncate leading-none">
              {projectName ?? 'Flow Builder'}
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              {flowValid
                ? <><CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" /><span className="text-[10px] text-emerald-500">Ready to run</span></>
                : <><AlertCircle  className="w-2.5 h-2.5 text-slate-600 shrink-0"   /><span className="text-[10px] text-slate-600">Add a source URL and an output node</span></>}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-600 shrink-0 border-r border-[#2e3350] pr-3 mr-1">
            <span>{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
            <span>{edges.length} connection{edges.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Mode toggle */}
          <div className="hidden sm:flex items-center gap-0.5 shrink-0 bg-[#0f1117] border border-[#2e3350] rounded-lg p-0.5 mr-1">
            <button onClick={() => setLockedPanMode(false)}
              className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                !lockedPanMode ? 'bg-[#1e2133] text-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-400')}>
              <MousePointer2 className="w-3 h-3" /><span className="hidden md:inline">Select</span>
            </button>
            <button onClick={() => setLockedPanMode((v) => !v)}
              className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                lockedPanMode || spaceHeld ? 'bg-indigo-600/20 text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-400')}>
              <Hand className="w-3 h-3" /><span className="hidden md:inline">Pan</span>
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5 shrink-0 border-r border-[#2e3350] pr-1.5 mr-1">
            {[
              { action: handleUndo, can: history.canUndo, icon: Undo2,  title: 'Undo (Ctrl+Z)' },
              { action: handleRedo, can: history.canRedo, icon: Redo2,  title: 'Redo (Ctrl+Y)' },
            ].map(({ action, can, icon: Icon, title }) => (
              <button key={title} onClick={action} disabled={!can} title={title}
                className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                  can ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5' : 'text-slate-700 cursor-not-allowed')}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          {/* AI Generate */}
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-pink-400 border border-pink-500/30 hover:border-pink-400 hover:bg-pink-950/20 bg-[#1a1d27] transition-colors shrink-0"
            title="Build workflow with AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI</span>
          </button>

          {/* Reset */}
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-[#2e3350] hover:border-[#3d4470] hover:text-slate-200 bg-[#1a1d27] transition-colors shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /><span className="hidden sm:inline">Reset</span>
          </button>

          {/* Save */}
          {onSave && (
            <button onClick={handleSave} disabled={isSaving} title="Save (Ctrl+S)"
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0',
                isSaving      ? 'text-slate-500 border-[#2e3350] bg-[#1a1d27] cursor-default'
                : saveLabel === 'saved' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                : isDirty     ? 'text-amber-300 border-amber-500/40 bg-amber-950/20 hover:border-amber-400'
                              : 'text-slate-400 border-[#2e3350] bg-[#1a1d27] hover:border-[#3d4470] hover:text-slate-200',
              )}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isSaving ? 'Saving…' : saveLabel === 'saved' ? 'Saved!' : isDirty ? 'Unsaved' : 'Save'}
              </span>
              {isDirty && !isSaving && saveLabel !== 'saved' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
            </button>
          )}

          {/* Run / Pause / Stop */}
          {isRunning ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={async () => {
                  jobStore.setStatus('paused')
                  await window.electronAPI.pauseWorkflow()
                  toast.info('Paused')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
              <button
                onClick={async () => {
                  await window.electronAPI.stopWorkflow()
                  jobStore.stopJob()
                  toast.warning('Stopped')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </div>
          ) : (
            <button onClick={handleRun} title={flowValid ? 'Run workflow' : 'Complete the workflow first'}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors shrink-0',
                flowValid ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40' : 'bg-indigo-600/40 cursor-default')}>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span className="hidden sm:inline">Run</span>
            </button>
          )}
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <div ref={wrapperRef} className={cn('flex-1 relative overflow-hidden', isPanMode && 'flow-pan-mode')}>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={null}
              defaultEdgeOptions={{ type: 'custom', animated: true }}
              panOnDrag={lockedPanMode ? true : [1, 2]}
              panActivationKeyCode={lockedPanMode ? null : 'Space'}
              selectionOnDrag={!lockedPanMode}
              selectionMode={SelectionMode.Partial}
              style={{ background: '#0f1117' }}
            >
              <Background variant={BackgroundVariant.Dots} color="#1e2133" gap={20} size={1.2} />
              <MiniMap
                style={{ background: '#13151f', border: '1px solid #2e3350', borderRadius: 8 }}
                nodeColor={(n) => ({
                  'browser-source':  '#6366f1',
                  'http-source':     '#3b82f6',
                  'api-source':      '#06b6d4',
                  'link-extractor':  '#8b5cf6',
                  'list-scraper':    '#a855f7',
                  'field-extractor': '#f59e0b',
                  'ai-extractor':    '#ec4899',
                  'filter':          '#f97316',
                  'transform':       '#eab308',
                  'file-export':     '#10b981',
                  'webhook':         '#14b8a6',
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

      {showAIModal && (
        <AIPromptModal
          onClose={() => setShowAIModal(false)}
          onSubmit={handleAIGenerate}
        />
      )}
    </NodeDetailProvider>
    </NodeStatusProvider>
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
