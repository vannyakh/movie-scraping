import { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  MiniMap, SelectionMode, addEdge, applyNodeChanges, applyEdgeChanges,
  useReactFlow,
  type Node, type Edge, type OnConnect, type NodeChange, type EdgeChange,
} from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play, RotateCcw, Save, ArrowLeft, CheckCircle2, AlertCircle, Loader2,
  Undo2, Redo2, Sparkles, Pause, Square, Workflow,
} from 'lucide-react'
import {
  nodeTypes, edgeTypes, defaultNodeData, NodeDetailProvider, NodeStatusProvider,
  DEFAULT_DETAIL_FIELDS, INITIAL_NODES, INITIAL_EDGES, NODE_COLOR_MAP,
} from './nodes'
import { NodeConfigPanel } from './NodeConfigPanel'
import { NodePalette }     from './NodePalette'
import { FlowControls }    from './FlowControls'
import { AIPromptModal }   from './AIPromptModal'
import { flowToWorkflow, isFlowValid } from './flowToWorkflow'
import { useFlowHistory, type FlowSnapshot } from '@/hooks/useFlowHistory'
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

// ─── Toolbar button variants ──────────────────────────────────────────────────

function TBtn({
  onClick, disabled, title, className, children,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-150 shrink-0',
        'border border-[#2a2e45] bg-[#1a1d2e] text-slate-400',
        'hover:text-slate-100 hover:border-[#3a3e55] hover:bg-[#1e2235]',
        'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#1a1d2e] disabled:hover:border-[#2a2e45] disabled:hover:text-slate-400',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ─── Inner canvas ─────────────────────────────────────────────────────────────

function Canvas({ projectId, projectName, workflowId, workflowName, initialNodes, initialEdges, onSave }: FlowCanvasProps) {
  const navigate     = useNavigate()
  const jobStore     = useJobStore()
  const { settings } = useSettingsStore()
  const wrapperRef   = useRef<HTMLDivElement>(null)

  const [nodes, setNodes] = useState<Node[]>(initialNodes ?? INITIAL_NODES)
  const [edges, setEdges] = useState<Edge[]>(initialEdges ?? INITIAL_EDGES)
  const { screenToFlowPosition, updateNodeData, deleteElements, fitView } = useReactFlow()

  const [configNodeId, setConfigNodeId] = useState<string | null>(null)
  const [configTab,    setConfigTab]    = useState<'config' | 'preview'>('config')
  const [showAIModal,  setShowAIModal]  = useState(false)

  // ── Undo/Redo ────────────────────────────────────────────────────────────
  const history = useFlowHistory()
  const isApplyingHistory = useRef(false)

  const restore     = useCallback((snap: FlowSnapshot) => {
    isApplyingHistory.current = true
    setNodes(snap.nodes)
    setEdges(snap.edges)
    requestAnimationFrame(() => { isApplyingHistory.current = false })
  }, [])

  const currentSnap = useCallback((): FlowSnapshot => ({ nodes, edges }), [nodes, edges])
  const handleUndo  = useCallback(() => history.undo(currentSnap(), restore), [history, currentSnap, restore])
  const handleRedo  = useCallback(() => history.redo(currentSnap(), restore), [history, currentSnap, restore])

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

  // ── React Flow handlers ───────────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!isApplyingHistory.current) {
      const hasDragEnd = changes.some(
        (c) => c.type === 'position' && (c as NodeChange & { dragging?: boolean }).dragging === false,
      )
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
    const newId = `${type}-${Date.now()}`
    setNodes((nds) => [...nds, { id: newId, type, position, data }])
    setConfigNodeId(newId)
    setConfigTab('config')
  }, [history, currentSnap, screenToFlowPosition])

  // Open config on node click
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setConfigNodeId(node.id)
    setConfigTab('config')
  }, [])

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
    toast.info('Workflow reset')
  }, [history, currentSnap])

  // ── Run ───────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    const resolvedWorkflowId = workflowId ?? projectId ?? `wf-${Date.now()}`
    const config = flowToWorkflow(nodes, edges, resolvedWorkflowId, projectId)
    if (!config) {
      toast.error('Workflow is incomplete', { description: 'Add a source node with a URL and an output node.' })
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
    toast.success('Workflow started!', {
      description: (nodes.find((n) => ['browser-source','http-source','api-source'].includes(n.type ?? ''))?.data as { url?: string })?.url,
    })
    navigate('/progress')
  }, [nodes, edges, jobStore, navigate, onSave, projectId, projectName, workflowId, workflowName])

  // ── Running state ─────────────────────────────────────────────────────────
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
        position: n.position ?? { x: i * 340, y: 100 },
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
      const mod     = e.ctrlKey || e.metaKey
      const target  = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (mod && e.key === 's' && onSave)                          { e.preventDefault(); handleSave(); return }
      if (mod && e.key === 'z' && !e.shiftKey)                     { e.preventDefault(); handleUndo(); return }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return }
      if (!inInput && e.key === 'f')                               { e.preventDefault(); fitView({ padding: 0.15, duration: 350 }); return }
      if (!inInput && e.key === 'Escape') { setConfigNodeId(null); return }

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
      <div className="flex flex-col h-screen bg-[#0d0f1a] overflow-hidden">

        {/* ── Toolbar ── */}
        <header className="flex items-center gap-2 px-4 py-2 border-b border-[#1e2235] bg-[#0d0f1a] shrink-0 h-12">

          {/* Back + breadcrumb */}
          {projectId && (
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition-colors shrink-0 group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors hidden sm:inline">
                Projects
              </span>
            </button>
          )}

          {projectId && <span className="text-[#1e2235] shrink-0">/</span>}

          {/* Workflow icon + name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Workflow className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="text-[12px] font-semibold text-slate-200 truncate">
              {workflowName ?? projectName ?? 'Flow Builder'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {flowValid
                ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-[10px] text-emerald-500 hidden md:inline">Ready</span></>
                : <><AlertCircle  className="w-3 h-3 text-slate-600"   /><span className="text-[10px] text-slate-600 hidden md:inline">Incomplete</span></>}
            </div>
          </div>

          {/* Stats */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-600 shrink-0 pr-3 border-r border-[#1e2235]">
            <span>{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
            <span>{edges.length} edge{edges.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 shrink-0">
            {([
              { action: handleUndo, can: history.canUndo, title: 'Undo (⌘Z)',         Icon: Undo2 },
              { action: handleRedo, can: history.canRedo, title: 'Redo (⌘⇧Z / ⌘Y)', Icon: Redo2 },
            ]).map(({ action, can, title, Icon }) => (
              <button key={title} onClick={action} disabled={!can} title={title}
                className={cn('w-7 h-7 flex items-center justify-center rounded-xl transition-colors',
                  can ? 'text-slate-400 hover:text-slate-100 hover:bg-white/6' : 'text-slate-700 cursor-not-allowed')}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-[#1e2235] shrink-0" />

          {/* AI Generate */}
          <TBtn
            onClick={() => setShowAIModal(true)}
            className="text-pink-400 border-pink-500/30 bg-pink-950/20 hover:border-pink-500/60 hover:bg-pink-950/40 hover:text-pink-300"
            title="Build workflow with AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI</span>
          </TBtn>

          {/* Reset */}
          <TBtn onClick={handleReset} title="Reset to default pipeline">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </TBtn>

          {/* Save */}
          {onSave && (
            <TBtn
              onClick={handleSave}
              disabled={isSaving}
              title="Save (⌘S)"
              className={cn(
                isSaving        ? 'text-slate-500'
                : saveLabel === 'saved' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                : isDirty       ? 'text-amber-300 border-amber-500/40 bg-amber-950/20 hover:border-amber-500/60'
                                : '',
              )}
            >
              {isSaving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isSaving ? 'Saving…' : saveLabel === 'saved' ? 'Saved!' : isDirty ? 'Save*' : 'Save'}
              </span>
            </TBtn>
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
              <button
                onClick={async () => {
                  await window.electronAPI.stopWorkflow()
                  jobStore.stopJob()
                  toast.warning('Stopped')
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white bg-red-700 hover:bg-red-600 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleRun}
              title={flowValid ? 'Run workflow (⌘↵)' : 'Complete the workflow first'}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all shrink-0',
                flowValid
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40'
                  : 'bg-indigo-600/30 cursor-default',
              )}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span className="hidden sm:inline">Run</span>
            </button>
          )}
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Palette */}
          <NodePalette />

          {/* Canvas */}
          <div ref={wrapperRef} className="flex-1 relative overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={null}
              defaultEdgeOptions={{ type: 'custom', animated: true }}
              panOnDrag={[1, 2]}
              panActivationKeyCode="Space"
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              minZoom={0.1}
              maxZoom={2}
              style={{ background: '#0d0f1a' }}
              nodesDraggable
              nodesConnectable
              elementsSelectable
            >
              <Background
                variant={BackgroundVariant.Dots}
                color="#1e2235"
                gap={24}
                size={1.5}
              />
              <MiniMap
                position="bottom-right"
                style={{
                  background:   '#0d0f1a',
                  border:       '1px solid #1e2235',
                  borderRadius: 12,
                  marginBottom: 12,
                  marginRight:  12,
                }}
                nodeColor={(n) => NODE_COLOR_MAP[n.type ?? ''] ?? '#2a2e45'}
                maskColor="rgba(13,15,26,0.8)"
              />
              <FlowControls />
            </ReactFlow>
          </div>

          {/* Config panel — outside canvas, slides as a column */}
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
