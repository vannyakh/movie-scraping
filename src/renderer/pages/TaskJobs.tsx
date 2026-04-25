import { useNavigate } from 'react-router-dom'
import { Activity, CheckCircle2, XCircle, Square, Clock, ChevronRight, Database } from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_MAP = {
  running: { label: 'Running',  icon: Activity,     cls: 'text-green-400  bg-green-400/10  border-green-400/30'  },
  paused:  { label: 'Paused',   icon: Clock,        cls: 'text-amber-400  bg-amber-400/10  border-amber-400/30'  },
  done:    { label: 'Done',     icon: CheckCircle2, cls: 'text-green-400  bg-green-400/10  border-green-400/20'  },
  error:   { label: 'Error',    icon: XCircle,      cls: 'text-red-400    bg-red-400/10    border-red-400/20'    },
  stopped: { label: 'Stopped',  icon: Square,       cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  idle:    { label: 'Idle',     icon: Clock,        cls: 'text-slate-500  bg-slate-500/10  border-slate-500/20'  },
}

function elapsed(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export default function TaskJobs() {
  const navigate = useNavigate()
  const { activeJob, history } = useJobStore()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">Execution history and active runs</p>
        </div>
      </div>

      {/* Active job section */}
      {activeJob && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Active</h2>
          <div
            className="bg-[#1a1d27] border border-indigo-500/30 rounded-xl p-5 cursor-pointer hover:border-indigo-400/50 transition-colors"
            onClick={() => navigate('/progress')}
          >
            <div className="flex items-start gap-4">
              {/* Status */}
              {(() => {
                const meta = STATUS_MAP[activeJob.status] ?? STATUS_MAP.idle
                const Icon = meta.icon
                return (
                  <span className={cn('shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border', meta.cls)}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                    {activeJob.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-0.5" />}
                  </span>
                )
              })()}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-100 truncate">
                  {activeJob.workflowName ?? activeJob.workflowId}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{formatDate(activeJob.startedAt)}</div>

                {/* Progress bar */}
                {activeJob.progress && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 truncate">{activeJob.progress.message}</span>
                      <span className="text-xs text-indigo-400 font-mono ml-2 shrink-0">
                        {activeJob.progress.total > 0
                          ? `${Math.round((activeJob.progress.current / activeJob.progress.total) * 100)}%`
                          : `${activeJob.progress.current}`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#2e3350] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-500"
                        style={{
                          width: activeJob.progress.total > 0
                            ? `${(activeJob.progress.current / activeJob.progress.total) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Node statuses */}
                {Object.keys(activeJob.nodeStatuses).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.values(activeJob.nodeStatuses).map((ns) => (
                      <span
                        key={ns.nodeId}
                        className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded border',
                          ns.status === 'success' ? 'bg-green-900/30 border-green-500/30 text-green-400'
                          : ns.status === 'running' ? 'bg-indigo-900/30 border-indigo-500/30 text-indigo-300 animate-pulse'
                          : ns.status === 'failed'  ? 'bg-red-900/30 border-red-500/30 text-red-400'
                          : 'bg-[#1a1d27] border-[#2e3350] text-slate-500'
                        )}
                      >
                        {ns.nodeId.split('-').slice(0, -1).join('-')} · {ns.status}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-200">{activeJob.records.length.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">records</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History section */}
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
        {activeJob ? 'Recent' : 'All Jobs'}
      </h2>

      {history.length === 0 && !activeJob && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Activity className="w-12 h-12 mb-4 opacity-30" />
          <div className="text-base font-medium mb-1">No jobs yet</div>
          <div className="text-sm">Run a workflow to see execution history here</div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {history.map((job) => {
          const meta = STATUS_MAP[job.status] ?? STATUS_MAP.done
          const Icon = meta.icon
          const dur  = elapsed(job.startedAt, job.finishedAt)

          return (
            <div key={job.id} className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-4 hover:border-[#3d4468] transition-colors">
              <div className="flex items-start gap-3">
                <span className={cn('shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border', meta.cls)}>
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200 truncate">
                    {job.workflowName ?? job.sourceUrl ?? job.workflowId}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                    <span>{formatDate(job.startedAt)}</span>
                    <span>Duration: {dur}</span>
                    <span className="font-medium text-slate-400">{job.totalRecords.toLocaleString()} records</span>
                  </div>

                  {job.outputPaths && Object.keys(job.outputPaths).length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {Object.entries(job.outputPaths).map(([ext, path]) => (
                        <button
                          key={ext}
                          onClick={() => window.electronAPI.openPath(path)}
                          className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                          {ext === 'json' ? '📄' : ext === 'xlsx' ? '📊' : '📋'} {ext.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate('/results')}
                  className="shrink-0 p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                  title="View data"
                >
                  <Database className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
