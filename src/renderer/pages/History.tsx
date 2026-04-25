import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, History, Database } from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { formatDate, cn } from '@/lib/utils'

const STATUS: Record<string, { label: string; cls: string }> = {
  done:    { label: 'Done',    cls: 'text-green-400  bg-green-400/10  border-green-400/20'  },
  error:   { label: 'Error',   cls: 'text-red-400    bg-red-400/10    border-red-400/20'    },
  stopped: { label: 'Stopped', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
}

function elapsed(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export default function HistoryPage() {
  const { history, deleteHistory, clearHistory } = useJobStore()
  const [confirmClear, setConfirmClear] = useState(false)

  const handleDelete = (id: string) => {
    deleteHistory(id)
    toast.success('Job removed from history')
  }

  const handleClearAll = () => {
    clearHistory()
    setConfirmClear(false)
    toast.success('History cleared')
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <History className="w-12 h-12 mb-4 opacity-30" />
        <div className="text-base font-medium mb-1">No history yet</div>
        <div className="text-sm">Completed workflow jobs will appear here</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">History</h1>
          <p className="text-slate-400 text-sm mt-1">{history.length} past job{history.length !== 1 ? 's' : ''}</p>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Clear all?</span>
            <button onClick={handleClearAll} className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors">Confirm</button>
            <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 bg-[#1a1d27] border border-[#2e3350] text-slate-400 rounded-lg text-sm font-medium hover:text-slate-200 transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d27] border border-[#2e3350] text-slate-400 hover:text-red-400 rounded-lg text-sm transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {history.map((job) => {
          const s   = STATUS[job.status] ?? STATUS.done
          const dur = elapsed(job.startedAt, job.finishedAt)
          return (
            <div key={job.id} className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5 hover:border-[#3d4468] transition-colors">
              <div className="flex items-start gap-4">
                <span className={cn('shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full border', s.cls)}>
                  {s.label}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200 truncate mb-0.5">
                    {job.workflowName ?? job.sourceUrl ?? job.workflowId}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span>{formatDate(job.startedAt)}</span>
                    <span>Duration: {dur}</span>
                    <span className="font-medium text-slate-400">{job.totalRecords.toLocaleString()} records</span>
                  </div>

                  {job.outputPaths && Object.keys(job.outputPaths).length > 0 && (
                    <div className="flex gap-3 mt-2">
                      {Object.entries(job.outputPaths).map(([ext, path]) => (
                        <button key={ext} onClick={() => window.electronAPI.openPath(path)}
                          className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                          {ext === 'json' ? '📄' : ext === 'xlsx' ? '📊' : '📋'} {ext.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button title="View data" onClick={() => {}}
                    className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors">
                    <Database className="w-4 h-4" />
                  </button>
                  <button title="Delete" onClick={() => handleDelete(job.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
