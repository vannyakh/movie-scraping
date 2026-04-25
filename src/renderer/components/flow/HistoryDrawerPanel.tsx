import { useState } from 'react'
import { History, Trash2, Database, X, ExternalLink } from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS: Record<string, { label: string; cls: string }> = {
  done:    { label: 'Done',    cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  error:   { label: 'Error',   cls: 'text-red-400    bg-red-400/10    border-red-400/20'       },
  stopped: { label: 'Stopped', cls: 'text-amber-400  bg-amber-400/10  border-amber-400/20'     },
}

function elapsed(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

interface Props {
  onClose: () => void
}

export function HistoryDrawerPanel({ onClose }: Props) {
  const { history, deleteHistory, clearHistory } = useJobStore()
  const [confirmClear, setConfirmClear] = useState(false)

  const handleDelete = (id: string) => {
    deleteHistory(id)
    toast.success('Removed from history')
  }

  const handleClearAll = () => {
    clearHistory()
    setConfirmClear(false)
    toast.success('History cleared')
  }

  return (
    <div className="w-full h-full border-l border-[#1e2235] bg-[#0d0f1a] flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1e2235] shrink-0">
        <div className="w-7 h-7 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <History className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-slate-100">Run History</div>
          <div className="text-[10px] text-slate-500">
            {history.length} job{history.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 px-6">
            <History className="w-8 h-8 opacity-25" />
            <div className="text-[11px] text-center leading-relaxed">
              No history yet.<br />
              Run a workflow to see results here.
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#1a1d2e]">
            {history.map((job) => {
              const s   = STATUS[job.status] ?? STATUS.done
              const dur = elapsed(job.startedAt, job.finishedAt)
              return (
                <div key={job.id} className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors group">
                  {/* Status + name */}
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className={cn('shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5', s.cls)}>
                      {s.label}
                    </span>
                    <span className="text-[11px] font-medium text-slate-200 truncate leading-tight">
                      {job.workflowName ?? job.sourceUrl ?? job.workflowId}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] text-slate-600 ml-0.5 mb-1.5">
                    <span>{formatDate(job.startedAt)}</span>
                    <span>{dur}</span>
                    <span className="text-slate-500 font-medium">{job.totalRecords.toLocaleString()} rec</span>
                  </div>

                  {/* Output files + actions */}
                  <div className="flex items-center gap-1">
                    {job.outputPaths && Object.entries(job.outputPaths).map(([ext, path]) => (
                      <button
                        key={ext}
                        onClick={() => window.electronAPI.openPath(path)}
                        title={`Open ${ext.toUpperCase()} file`}
                        className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 hover:text-indigo-400 bg-[#12141e] hover:bg-indigo-500/10 border border-[#1e2235] hover:border-indigo-500/30 px-1.5 py-0.5 rounded-lg transition-all"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {ext.toUpperCase()}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      title="View data"
                      onClick={() => {}}
                      className="p-1 text-slate-700 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Database className="w-3 h-3" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDelete(job.id)}
                      className="p-1 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer - clear all */}
      {history.length > 0 && (
        <div className="px-3 py-2.5 border-t border-[#1e2235] shrink-0">
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 flex-1">Clear all history?</span>
              <button
                onClick={handleClearAll}
                className="px-2 py-1 text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 w-full justify-center text-[10px] text-slate-600 hover:text-red-400 transition-colors py-1 rounded-lg hover:bg-red-400/5"
            >
              <Trash2 className="w-3 h-3" /> Clear all history
            </button>
          )}
        </div>
      )}
    </div>
  )
}
