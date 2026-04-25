import { useEffect, useRef, useState } from 'react'
import {
  X, Play, Pause, Square, CheckCircle2, XCircle,
  Loader2, ExternalLink, ChevronRight, AlertTriangle,
  Zap,
} from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { formatElapsed, cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Node step row ─────────────────────────────────────────────────────────

function StepRow({ nodeId, status, recordCount }: {
  nodeId: string
  status: string
  recordCount?: number
  error?: string
}) {
  const isRunning = status === 'running'
  const isSuccess = status === 'success'
  const isFailed  = status === 'failed'
  const isPending = status === 'pending'

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
      isRunning ? 'bg-indigo-500/8 border-indigo-500/30'
      : isSuccess ? 'bg-emerald-500/5 border-emerald-500/15'
      : isFailed  ? 'bg-red-500/8 border-red-500/25'
      : 'bg-[#0f1117] border-[#1a1d2e]',
    )}>
      {/* Icon */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {isRunning  && <Loader2    className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
        {isSuccess  && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {isFailed   && <XCircle    className="w-3.5 h-3.5 text-red-400" />}
        {isPending  && <ChevronRight className="w-3 h-3 text-slate-700" />}
        {!isRunning && !isSuccess && !isFailed && !isPending && (
          <div className="w-2 h-2 rounded-full bg-slate-700" />
        )}
      </div>

      {/* Label */}
      <span className={cn(
        'text-[11px] flex-1 truncate font-medium',
        isRunning ? 'text-indigo-300'
        : isSuccess ? 'text-emerald-400'
        : isFailed  ? 'text-red-400'
        : 'text-slate-600',
      )}>
        {nodeId.replace(/-\d+$/, '').replace(/-/g, ' ')}
      </span>

      {/* Records */}
      {recordCount !== undefined && recordCount > 0 && (
        <span className="text-[10px] text-slate-500 shrink-0">{recordCount}</span>
      )}
    </div>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function ExecutionPanel({ onClose }: Props) {
  const store     = useJobStore()
  const activeJob = useJobStore((s) => s.activeJob)
  const logRef    = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  // Tick elapsed timer every second
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJob?.logs.length])

  if (!activeJob) {
    return (
      <div className="w-72 border-l border-[#1e2235] bg-[#0d0f1a] flex flex-col h-full shrink-0">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1e2235]">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-[11px] font-bold text-slate-100 flex-1">Execution</span>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600 p-8">
          <Zap className="w-8 h-8 opacity-20" />
          <p className="text-[11px] text-center leading-relaxed">No active job.<br />Hit Run to start the workflow.</p>
        </div>
      </div>
    )
  }

  const { status, progress, logs, records, nodeStatuses, result, startedAt, error } = activeJob
  const isRunning = status === 'running'
  const isPaused  = status === 'paused'
  const isDone    = status === 'done'
  const isError   = status === 'error'
  const isStopped = status === 'stopped'
  const isFinished = isDone || isError || isStopped

  const overallPct = isDone ? 100
    : !progress || progress.total === 0 ? 0
    : Math.round((progress.current / progress.total) * 100)

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

  const handleClose = () => {
    if (isFinished) store.clearActive()
    onClose()
  }

  const nodeSteps = Object.values(nodeStatuses)

  return (
    <div className="w-72 border-l border-[#1e2235] bg-[#0d0f1a] flex flex-col h-full shrink-0">

      {/* ── Header ── */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-3 border-b border-[#1e2235] shrink-0',
      )}>
        <div className={cn(
          'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
          isRunning ? 'bg-indigo-500/20 border border-indigo-500/40'
          : isPaused  ? 'bg-amber-500/15 border border-amber-500/30'
          : isDone    ? 'bg-emerald-500/15 border border-emerald-500/30'
          : isError   ? 'bg-red-500/15 border border-red-500/30'
          : 'bg-slate-500/15 border border-slate-500/30',
        )}>
          {isRunning && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
          {isPaused  && <Pause   className="w-3.5 h-3.5 text-amber-400" />}
          {isDone    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {isError   && <XCircle className="w-3.5 h-3.5 text-red-400" />}
          {isStopped && <Square  className="w-3.5 h-3.5 text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-slate-100">
            {isRunning ? 'Running…' : isPaused ? 'Paused' : isDone ? 'Complete' : isError ? 'Failed' : 'Stopped'}
          </div>
          <div className="text-[10px] text-slate-500 truncate">{activeJob.workflowName ?? activeJob.workflowId}</div>
        </div>
        <button onClick={handleClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* ── Error alert ── */}
      {isError && error && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-relaxed break-words">{error}</p>
        </div>
      )}

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-1.5 px-3 pt-3 shrink-0">
        {[
          { label: 'Records', value: records.length.toLocaleString() },
          { label: 'Step',    value: progress ? `${progress.step}/${progress.totalSteps}` : '—' },
          { label: 'Elapsed', value: formatElapsed(startedAt) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#12141e] border border-[#1a1d2e] rounded-xl px-2 py-1.5 text-center">
            <div className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</div>
            <div className="text-[11px] font-bold text-slate-200 mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      <div className="px-3 pt-2.5 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-500 truncate flex-1 mr-2">
            {progress?.message ?? (isDone ? 'All steps complete' : 'Initializing…')}
          </span>
          <span className={cn(
            'text-[10px] font-bold shrink-0',
            isDone ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-indigo-400',
          )}>{overallPct}%</span>
        </div>
        <div className="h-1.5 bg-[#1a1d2e] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isDone  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : isError ? 'bg-red-500'
              : isStopped ? 'bg-slate-500'
              : 'bg-gradient-to-r from-indigo-500 to-purple-500',
            )}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* ── Node steps ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pt-3 flex flex-col gap-1.5">
        {nodeSteps.length === 0 && (isRunning || isPaused) ? (
          <div className="flex items-center gap-2 text-slate-600 text-[11px] py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Starting nodes…</span>
          </div>
        ) : (
          nodeSteps.map((ns) => (
            <StepRow
              key={ns.nodeId}
              nodeId={ns.nodeId}
              status={ns.status}
              recordCount={ns.recordCount}
              error={ns.error}
            />
          ))
        )}
      </div>

      {/* ── Live log ── */}
      <div className="mx-3 mb-2 mt-2 shrink-0">
        <div className="bg-[#080a10] border border-[#1a1d2e] rounded-xl p-2.5 h-24 overflow-y-auto scrollbar-thin font-mono">
          {logs.length === 0 ? (
            <div className="text-[10px] text-slate-700 italic">Waiting for output…</div>
          ) : (
            logs.slice(-40).map((line, i, arr) => (
              <div key={i} className={cn(
                'text-[10px] leading-snug',
                i === arr.length - 1 ? 'text-slate-300' : 'text-slate-600',
              )}>{line}</div>
            ))
          )}
          <div ref={logRef} />
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="px-3 pb-3 flex flex-col gap-2 border-t border-[#1e2235] pt-2.5 shrink-0">

        {/* Running/paused controls */}
        {(isRunning || isPaused) && (
          <div className="flex gap-2">
            <button
              onClick={handlePause}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all',
                isPaused
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-[#1a1d2e] border border-[#2a2e45] text-slate-300 hover:text-white hover:border-indigo-500/50',
              )}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          </div>
        )}

        {/* Done state: output files */}
        {isDone && result?.outputPaths && Object.keys(result.outputPaths).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(result.outputPaths).map(([ext, path]) => (
              <button
                key={ext}
                onClick={() => window.electronAPI.openPath(path)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 bg-[#1a1d2e] border border-[#2a2e45] rounded-xl hover:text-white hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Open {ext.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Done/error/stopped: dismiss button */}
        {isFinished && (
          <button
            onClick={handleClose}
            className="w-full py-2 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-[#1e2235] transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
