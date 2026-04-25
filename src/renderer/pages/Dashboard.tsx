import { useNavigate } from 'react-router-dom'
import {
  Database, PlusCircle, Clock, TrendingUp, Zap, Workflow, Activity, FolderOpen,
} from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { useProjectStore } from '@/store/projectStore'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const navigate    = useNavigate()
  const { history, activeJob } = useJobStore()
  const projects    = useProjectStore(s => s.projects)

  const totalRecords    = history.reduce((s, h) => s + h.totalRecords, 0)
  const totalJobs       = history.length
  const successRate     = totalJobs === 0 ? 100 : Math.round((history.filter((h) => h.status === 'done').length / totalJobs) * 100)
  const recentJobs      = history.slice(0, 5)
  const totalWorkflows  = projects.reduce((s, p) => s + p.workflows.length, 0)

  const STATUS_COLOR: Record<string, string> = {
    done:    'text-green-400 bg-green-400/10',
    error:   'text-red-400 bg-red-400/10',
    stopped: 'text-yellow-400 bg-yellow-400/10',
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Overview of your data extraction activity</p>
      </div>

      {/* Active job banner */}
      {activeJob && (activeJob.status === 'running' || activeJob.status === 'paused') && (
        <div
          className="mb-6 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center gap-4 cursor-pointer hover:bg-indigo-600/15 transition-colors"
          onClick={() => navigate('/progress')}
        >
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            activeJob.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-amber-400',
          )} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-indigo-300">
              {activeJob.status === 'running' ? 'Workflow running' : 'Workflow paused'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {activeJob.workflowName ?? activeJob.workflowId}
            </div>
          </div>
          <div className="text-xs text-slate-400">{activeJob.records.length} records</div>
          <div className="text-xs text-indigo-400 font-medium">View →</div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: FolderOpen,  label: 'Projects',               value: projects.length.toString(),    color: 'text-violet-400', onClick: () => navigate('/projects') },
          { icon: Workflow,    label: 'Workflows',               value: totalWorkflows.toString(),     color: 'text-indigo-400', onClick: () => navigate('/projects') },
          { icon: Database,    label: 'Records Extracted',       value: totalRecords.toLocaleString(), color: 'text-cyan-400',   onClick: () => navigate('/results')  },
          { icon: TrendingUp,  label: 'Job Success Rate',        value: `${successRate}%`,             color: 'text-green-400',  onClick: () => navigate('/history')  },
        ].map(({ icon: Icon, label, value, color, onClick }) => (
          <div key={label} onClick={onClick}
            className="bg-[#1a1d27] border border-[#2e3350] hover:border-indigo-500/30 rounded-xl p-5 cursor-pointer transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
              <Icon className={cn('w-4 h-4 group-hover:opacity-100 opacity-70 transition-opacity', color)} />
            </div>
            <div className={cn('text-3xl font-bold', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/30">
        <div className="mb-4">
          <div className="text-lg font-bold text-slate-100 mb-1">Start a new data extraction project</div>
          <div className="text-sm text-slate-400">Build a visual scraping pipeline and run it with one click</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <div className="font-bold text-sm">New Project</div>
              <div className="text-xs text-indigo-200 font-normal">Open the flow builder</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2.5 px-4 py-3 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 hover:border-violet-500/70 text-white font-semibold rounded-lg transition-all text-sm"
          >
            <Workflow className="w-4 h-4 shrink-0 text-violet-300" />
            <div className="text-left">
              <div className="font-bold text-sm text-violet-200">All Projects</div>
              <div className="text-xs text-violet-300/70 font-normal">View & manage</div>
            </div>
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: Zap,      label: 'New Project',   desc: 'Create and open flow builder', onClick: () => navigate('/projects/new'),  color: 'text-indigo-400' },
          { icon: Activity, label: 'Active Jobs',   desc: 'View running & queued jobs',   onClick: () => navigate('/task-jobs'),    color: 'text-green-400'  },
          { icon: Clock,    label: 'History',       desc: `${totalJobs} past jobs`,       onClick: () => navigate('/history'),      color: 'text-blue-400'   },
        ].map(({ icon: Icon, label, desc, onClick, color }) => (
          <button key={label} onClick={onClick}
            className="flex items-center gap-4 p-4 bg-[#1a1d27] border border-[#2e3350] rounded-xl text-left hover:border-indigo-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-[#21253a] flex items-center justify-center shrink-0">
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">{label}</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Recent history */}
      {recentJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Recent Jobs</h2>
            <button onClick={() => navigate('/history')} className="text-xs text-indigo-400 hover:text-indigo-300">View all →</button>
          </div>
          <div className="flex flex-col gap-2">
            {recentJobs.map((job) => (
              <div key={job.id}
                className="flex items-center gap-4 p-3.5 bg-[#1a1d27] border border-[#2e3350] rounded-lg hover:border-[#3d4468] transition-colors cursor-pointer"
                onClick={() => navigate('/history')}
              >
                <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLOR[job.status] ?? '')}>
                  {job.status === 'done' ? '✓' : job.status === 'error' ? '✕' : '■'} {job.status}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">{job.workflowName ?? job.sourceUrl ?? job.workflowId}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatDate(job.startedAt)}</div>
                </div>
                <div className="text-sm font-semibold text-slate-300">{job.totalRecords.toLocaleString()}</div>
                <div className="text-xs text-slate-500">records</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <div className="text-base font-medium mb-1">No jobs yet</div>
          <div className="text-sm">Create a project and run your first workflow</div>
        </div>
      )}
    </div>
  )
}
