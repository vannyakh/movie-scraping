import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Pause, Play, Square, CheckCircle2, Loader2, ExternalLink, Database } from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { formatElapsed, cn } from '@/lib/utils'

function NodeStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'text-[9px] font-semibold px-1.5 py-0.5 rounded border',
      status === 'running'  ? 'bg-indigo-900/40 border-indigo-500/40 text-indigo-300 animate-pulse'
      : status === 'success' ? 'bg-green-900/30 border-green-500/30 text-green-400'
      : status === 'failed'  ? 'bg-red-900/30 border-red-500/30 text-red-400'
      : status === 'pending' ? 'bg-[#1a1d27] border-[#2e3350] text-slate-600'
      : 'bg-slate-900/30 border-slate-500/30 text-slate-500',
    )}>
      {status}
    </span>
  )
}

export default function ProgressPage() {
  const navigate   = useNavigate()
  const store      = useJobStore()
  const { activeJob } = store
  const logRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    logRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJob?.logs.length])

  useEffect(() => {
    if (activeJob?.status === 'done') {
      toast.success(`Done! ${activeJob.records.length} records extracted.`)
    }
  }, [activeJob?.status])

  if (!activeJob) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Loader2 className="w-8 h-8 mb-3 opacity-40" />
        <div className="text-sm">
          No active job.{' '}
          <button className="text-indigo-400 underline" onClick={() => navigate('/projects')}>
            Start one →
          </button>
        </div>
      </div>
    )
  }

  const { status, progress, logs, records, startedAt, result, nodeStatuses } = activeJob
  const isRunning = status === 'running'
  const isPaused  = status === 'paused'
  const isDone    = status === 'done'

  const overallPct = (() => {
    if (isDone) return 100
    if (!progress) return 0
    return progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  })()

  const handlePause = async () => {
    if (isPaused) {
      store.setStatus('running')
      await window.electronAPI.resumeWorkflow()
      toast.info('Resumed')
    } else {
      store.setStatus('paused')
      await window.electronAPI.pauseWorkflow()
      toast.info('Paused')
    }
  }

  const handleStop = async () => {
    await window.electronAPI.stopWorkflow()
    store.stopJob()
    toast.warning('Workflow stopped')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {isDone ? 'Workflow Complete' : isPaused ? 'Workflow Paused' : 'Workflow Running'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 truncate max-w-md">
            {activeJob.workflowName ?? activeJob.workflowId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isRunning || isPaused) && (
            <>
              <button onClick={handlePause}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#21253a] border border-[#2e3350] text-slate-300 hover:text-white hover:border-indigo-500 rounded-lg text-sm font-medium transition-colors">
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </>
          )}
          {isDone && (
            <button onClick={() => navigate('/results')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors">
              <Database className="w-3.5 h-3.5" /> View Results
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Records',      value: records.length.toLocaleString() },
          { label: 'Step',         value: progress ? `${progress.step} / ${progress.totalSteps}` : '—' },
          { label: 'Elapsed',      value: formatElapsed(startedAt) },
          { label: 'Status',       value: status.charAt(0).toUpperCase() + status.slice(1) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-3.5 text-center">
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-medium">{label}</div>
            <div className="text-lg font-bold text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-300">Overall Progress</span>
          <span className="text-sm font-bold text-indigo-400">{overallPct}%</span>
        </div>
        <div className="h-3 bg-[#0f1117] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-600 to-purple-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        {progress && (
          <div className="text-xs text-slate-400 mt-2 truncate">{progress.message}</div>
        )}
      </div>

      {/* Node statuses */}
      {Object.keys(nodeStatuses).length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Node Execution</p>
          <div className="flex flex-col gap-2">
            {Object.values(nodeStatuses).map((ns) => (
              <div key={ns.nodeId} className="flex items-center gap-3">
                <NodeStatusBadge status={ns.status} />
                <span className="text-xs text-slate-300 flex-1 truncate">{ns.nodeId}</span>
                {ns.recordCount !== undefined && (
                  <span className="text-xs text-slate-500">{ns.recordCount} records</span>
                )}
                {ns.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />}
                {ns.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                {ns.error && <span className="text-xs text-red-400 truncate max-w-[200px]">{ns.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log console */}
      <div className="bg-[#0a0c12] border border-[#2e3350] rounded-xl p-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Live Log</div>
        <div className="h-48 overflow-y-auto font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">Waiting for output…</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className={cn('', i === logs.length - 1 ? 'text-slate-200' : 'text-slate-500')}>
                {line}
              </div>
            ))
          )}
          <div ref={logRef} />
        </div>
      </div>

      {/* Result output paths */}
      {isDone && result?.outputPaths && Object.keys(result.outputPaths).length > 0 && (
        <div className="mt-4 flex gap-3 flex-wrap">
          {Object.entries(result.outputPaths).map(([ext, path]) => (
            <button
              key={ext}
              onClick={() => window.electronAPI.openPath(path)}
              className="text-xs px-3 py-1.5 bg-[#21253a] border border-[#2e3350] rounded-lg text-slate-300 hover:text-white hover:border-indigo-500 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Open {ext.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
