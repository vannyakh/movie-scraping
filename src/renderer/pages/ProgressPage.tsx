import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Pause, Play, Square, CheckCircle2, Loader2, Circle, ExternalLink } from 'lucide-react'
import { useScrapingStore } from '@/store/scrapingStore'
import { formatElapsed, cn } from '@/lib/utils'

function StepCard({
  num, label, active, done, current, total, message,
}: {
  num: 1 | 2 | 3; label: string; active: boolean; done: boolean
  current: number; total: number; message: string
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className={cn(
      'bg-[#1a1d27] border rounded-xl p-4 transition-all',
      active ? 'border-indigo-500/60 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]' : done ? 'border-green-500/30' : 'border-[#2e3350]',
    )}>
      <div className="flex items-center gap-2 mb-3">
        {done
          ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          : active
            ? <Loader2 className="w-4 h-4 text-indigo-400 shrink-0 animate-spin" />
            : <Circle className="w-4 h-4 text-slate-600 shrink-0" />}
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Step {num}</span>
      </div>
      <div className="text-sm font-semibold text-slate-200 mb-1">{label}</div>
      <div className={cn('text-2xl font-bold mb-2', done ? 'text-green-400' : active ? 'text-indigo-400' : 'text-slate-600')}>
        {done ? '✓' : active ? current.toLocaleString() : '—'}
        {active && total > 0 && <span className="text-sm text-slate-500 font-normal ml-1">/ {total.toLocaleString()}</span>}
      </div>
      <div className="text-xs text-slate-400 truncate min-h-[1em] mb-2">{active ? message : done ? 'Complete' : 'Waiting…'}</div>
      {(active || done) && (
        <div className="h-1.5 bg-[#2e3350] rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', done ? 'bg-green-500' : 'bg-indigo-500')} style={{ width: `${done ? 100 : pct}%` }} />
        </div>
      )}
    </div>
  )
}

export default function ProgressPage() {
  const navigate     = useNavigate()
  const store        = useScrapingStore()
  const { activeJob } = store
  const [tick, setTick] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    logRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJob?.logs.length])

  useEffect(() => {
    if (activeJob?.status === 'done') {
      toast.success(`Done! ${activeJob.movies.length} movies scraped.`)
    }
  }, [activeJob?.status])

  if (!activeJob) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Loader2 className="w-8 h-8 mb-3 opacity-40" />
        <div className="text-sm">No active job. <button className="text-indigo-400 underline" onClick={() => navigate('/new')}>Start one →</button></div>
      </div>
    )
  }

  const { status, progress, logs, movies, startedAt, result } = activeJob
  const isRunning = status === 'running'
  const isPaused  = status === 'paused'
  const isDone    = status === 'done'

  /* overall progress: step1=10%, step2=10-45%, step3=45-100% */
  const overallPct = (() => {
    if (!progress) return 0
    if (isDone)    return 100
    const r = progress.total > 0 ? progress.current / progress.total : 0
    if (progress.step === 1) return 10
    if (progress.step === 2) return 10 + r * 35
    return 45 + r * 55
  })()

  const handlePause = async () => {
    if (isPaused) {
      store.setStatus('running')
      await window.electronAPI.resumeScraping()
      toast.info('Resumed')
    } else {
      store.setStatus('paused')
      await window.electronAPI.pauseScraping()
      toast.info('Paused')
    }
  }

  const handleStop = async () => {
    await window.electronAPI.stopScraping()
    store.stopJob()
    toast.warning('Scraping stopped')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {isDone ? 'Scraping Complete' : isPaused ? 'Scraping Paused' : 'Scraping in Progress'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 truncate max-w-md">{activeJob.config.baseUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          {(isRunning || isPaused) && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#21253a] border border-[#2e3350] text-slate-300 hover:text-white hover:border-indigo-500 rounded-lg text-sm font-medium transition-colors"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={() => navigate('/results')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Results
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Movies Found',  value: movies.length.toLocaleString() },
          { label: 'Current Step',  value: progress ? `${progress.step} / 3` : '—' },
          { label: 'Elapsed',       value: formatElapsed(startedAt) },
          { label: 'Status',        value: status.charAt(0).toUpperCase() + status.slice(1) },
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
          <span className="text-sm font-bold text-indigo-400">{Math.round(overallPct)}%</span>
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

      {/* Step cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {([1, 2, 3] as const).map((n) => {
          const stepLabels: Record<number, string> = { 1: 'Categories', 2: 'Movie List', 3: 'Detail Pages' }
          const isStepActive = progress?.step === n && (isRunning || isPaused)
          const isStepDone   = (progress?.step ?? 0) > n || (isDone && n <= 3)
          return (
            <StepCard
              key={n} num={n} label={stepLabels[n]}
              active={isStepActive}
              done={isStepDone}
              current={isStepActive ? (progress?.current ?? 0) : 0}
              total={isStepActive ? (progress?.total ?? 0) : 0}
              message={isStepActive ? (progress?.message ?? '') : ''}
            />
          )
        })}
      </div>

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

      {/* Result links */}
      {isDone && result && (
        <div className="mt-4 flex gap-3 flex-wrap">
          {result.jsonPath  && <button onClick={() => window.electronAPI.openPath(result.jsonPath!)}  className="text-xs px-3 py-1.5 bg-[#21253a] border border-[#2e3350] rounded-lg text-slate-300 hover:text-white hover:border-indigo-500 transition-colors">📄 Open JSON</button>}
          {result.excelPath && <button onClick={() => window.electronAPI.openPath(result.excelPath!)} className="text-xs px-3 py-1.5 bg-[#21253a] border border-[#2e3350] rounded-lg text-slate-300 hover:text-white hover:border-indigo-500 transition-colors">📊 Open Excel</button>}
          {result.csvPath   && <button onClick={() => window.electronAPI.openPath(result.csvPath!)}   className="text-xs px-3 py-1.5 bg-[#21253a] border border-[#2e3350] rounded-lg text-slate-300 hover:text-white hover:border-indigo-500 transition-colors">📋 Open CSV</button>}
        </div>
      )}
    </div>
  )
}
