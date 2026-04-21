import { useNavigate } from 'react-router-dom'
import { Film, PlusCircle, CheckCircle, AlertCircle, Clock, TrendingUp, Zap } from 'lucide-react'
import { useScrapingStore } from '@/store/scrapingStore'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const { history, activeJob } = useScrapingStore()

  const totalMovies  = history.reduce((s, h) => s + h.totalMovies, 0)
  const totalJobs    = history.length
  const successRate  = totalJobs === 0 ? 100 : Math.round((history.filter(h => h.status === 'done').length / totalJobs) * 100)
  const recentJobs   = history.slice(0, 5)

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
        <p className="text-slate-400 text-sm mt-1">Overview of your scraping activity</p>
      </div>

      {/* Active job banner */}
      {activeJob && activeJob.status === 'running' && (
        <div
          className="mb-6 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center gap-4 cursor-pointer hover:bg-indigo-600/15 transition-colors"
          onClick={() => navigate('/progress')}
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-indigo-300">Scraping in progress</div>
            <div className="text-xs text-slate-400 mt-0.5">{activeJob.config.baseUrl}</div>
          </div>
          <div className="text-xs text-slate-400">{activeJob.movies.length} movies found</div>
          <div className="text-xs text-indigo-400 font-medium">View →</div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: Film,      label: 'Total Movies Scraped', value: totalMovies.toLocaleString(), color: 'text-indigo-400' },
          { icon: CheckCircle, label: 'Jobs Completed',     value: totalJobs.toString(),         color: 'text-green-400'  },
          { icon: TrendingUp,  label: 'Success Rate',       value: `${successRate}%`,             color: 'text-blue-400'   },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <div className={cn('text-3xl font-bold', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/30 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-slate-100 mb-1">Start a new scraping job</div>
          <div className="text-sm text-slate-400">Configure URL, selectors, export format and launch</div>
        </div>
        <button
          onClick={() => navigate('/new')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          New Scraping
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          { icon: Zap,   label: 'Quick scrape last URL', desc: recentJobs[0]?.url ?? 'No recent jobs',
            onClick: () => recentJobs[0] ? navigate('/new') : undefined,
            disabled: !recentJobs[0] },
          { icon: Clock, label: 'View history', desc: `${totalJobs} past jobs`,
            onClick: () => navigate('/history'), disabled: false },
        ].map(({ icon: Icon, label, desc, onClick, disabled }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-4 p-4 bg-[#1a1d27] border border-[#2e3350] rounded-xl text-left hover:border-indigo-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-[#21253a] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-indigo-400" />
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
              <div
                key={job.id}
                className="flex items-center gap-4 p-3.5 bg-[#1a1d27] border border-[#2e3350] rounded-lg hover:border-[#3d4468] transition-colors cursor-pointer"
                onClick={() => navigate('/history')}
              >
                <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLOR[job.status] ?? '')}>
                  {job.status === 'done' ? '✓' : job.status === 'error' ? '✕' : '■'} {job.status}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">{job.url}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatDate(job.startedAt)}</div>
                </div>
                <div className="text-sm font-semibold text-slate-300">{job.totalMovies.toLocaleString()}</div>
                <div className="text-xs text-slate-500">movies</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Film className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <div className="text-base font-medium mb-1">No scraping history yet</div>
          <div className="text-sm">Click "New Scraping" to get started</div>
        </div>
      )}
    </div>
  )
}
