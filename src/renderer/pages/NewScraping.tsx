import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FolderOpen, Play, ChevronDown, ChevronUp, Globe, Settings2, Workflow, SlidersHorizontal } from 'lucide-react'
import { useScrapingStore } from '@/store/scrapingStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'
import type { ScraperConfig } from '../../../src/lib/ipc'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          checked ? 'bg-indigo-600' : 'bg-[#2e3350]',
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow',
          checked ? 'translate-x-4' : 'translate-x-0',
        )} />
      </button>
      <span className="text-sm text-slate-300 group-hover:text-slate-100">{label}</span>
    </label>
  )
}

function NumberInput({ value, onChange, min = 0, max, step = 1 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <input
      type="number" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
    />
  )
}

function TextInput({ value, onChange, placeholder, readOnly }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <input
      type="text" value={value} readOnly={readOnly} placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        'w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2 text-sm outline-none transition-colors',
        readOnly ? 'cursor-default text-slate-400' : 'focus:border-indigo-500',
      )}
    />
  )
}

export default function NewScraping() {
  const navigate      = useNavigate()
  const store         = useScrapingStore()
  const { settings }  = useSettingsStore()

  const [url, setUrl]       = useState(settings.defaultUrl || '')
  const [outputDir, setOutputDir] = useState(settings.outputDir || '')
  const [maxPages, setMaxPages]   = useState(settings.maxPagesPerCategory)
  const [maxMovies, setMaxMovies] = useState(settings.maxMoviesPerCategory)
  const [delayMs, setDelayMs]     = useState(settings.delayMs)
  const [headless, setHeadless]   = useState(settings.headless)
  const [userAgent, setUserAgent] = useState(settings.userAgent)
  const [exportJson, setExportJson]   = useState(settings.exportJson)
  const [exportExcel, setExportExcel] = useState(settings.exportExcel)
  const [exportCsv, setExportCsv]     = useState(settings.exportCsv)
  const [selCats, setSelCats]   = useState('')
  const [selList, setSelList]   = useState('')
  const [selNext, setSelNext]   = useState('')
  const [showAdv, setShowAdv]   = useState(false)
  const [loading, setLoading]   = useState(false)

  const pickFolder = async () => {
    const folder = await window.electronAPI.selectFolder()
    if (folder) setOutputDir(folder)
  }

  const handleStart = async () => {
    if (!url.trim()) { toast.error('Please enter a target URL'); return }
    if (!outputDir.trim()) { toast.error('Please select an output folder'); return }
    if (!exportJson && !exportExcel && !exportCsv) { toast.error('Select at least one export format'); return }

    setLoading(true)

    const config: ScraperConfig = {
      baseUrl:              url.trim(),
      outputDir:            outputDir.trim(),
      headless,
      maxPagesPerCategory:  maxPages,
      maxMoviesPerCategory: maxMovies,
      delayMs,
      userAgent:            userAgent || undefined,
      exportJson,
      exportExcel,
      exportCsv,
      selectors: (selCats || selList || selNext)
        ? { categories: selCats || undefined, movieList: selList || undefined, nextPage: selNext || undefined }
        : undefined,
    }

    store.initJob(config)
    window.electronAPI.startScraping(config) // fire & forget — events handled in Layout
    toast.success('Scraping started!')
    navigate('/progress')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">New Scraping Job</h1>
        <p className="text-slate-400 text-sm mt-1">Configure your scraping parameters then hit Start</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-indigo-600/15 border-2 border-indigo-500/60 cursor-default">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-indigo-300">Quick Form</span>
            <span className="ml-auto text-[10px] font-semibold bg-indigo-600/40 text-indigo-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Active</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">Fill in a form and start immediately. Best for one-off scraping jobs.</p>
        </div>
        <button
          onClick={() => navigate('/flow')}
          className="flex flex-col gap-2 p-4 rounded-xl bg-[#1a1d27] border-2 border-[#2e3350] hover:border-violet-500/50 hover:bg-violet-600/10 transition-all text-left group"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600/40 group-hover:bg-violet-600 flex items-center justify-center shrink-0 transition-colors">
              <Workflow className="w-3.5 h-3.5 text-violet-300 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-400 group-hover:text-violet-300 transition-colors">Flow Builder</span>
          </div>
          <p className="text-xs text-slate-500 group-hover:text-slate-400 leading-relaxed transition-colors">
            Visual node graph — connect stages and set custom CSS selectors per step.
          </p>
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* URL */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Target Website</span>
          </div>
          <Field label="Base URL" hint="The homepage or category listing URL of the target site">
            <TextInput value={url} onChange={setUrl} placeholder="https://example-movie-site.com" />
          </Field>
        </div>

        {/* Output */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Output</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <Field label="Output Folder">
                <div className="flex gap-2">
                  <TextInput value={outputDir} onChange={setOutputDir} placeholder="Select folder…" />
                  <button onClick={pickFolder} className="shrink-0 px-3 py-2 bg-[#21253a] border border-[#2e3350] text-slate-300 rounded-lg hover:border-indigo-500 transition-colors text-sm">
                    Browse
                  </button>
                </div>
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle checked={exportJson}  onChange={setExportJson}  label="JSON"  />
            <Toggle checked={exportExcel} onChange={setExportExcel} label="Excel" />
            <Toggle checked={exportCsv}   onChange={setExportCsv}   label="CSV"   />
          </div>
        </div>

        {/* Scraping config */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Scraping Options</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Max Pages / Category" hint="Pagination limit">
              <NumberInput value={maxPages} onChange={setMaxPages} min={1} max={1000} />
            </Field>
            <Field label="Max Movies / Category">
              <NumberInput value={maxMovies} onChange={setMaxMovies} min={1} max={100000} />
            </Field>
            <Field label="Delay Between Requests (ms)" hint="0 = no delay">
              <NumberInput value={delayMs} onChange={setDelayMs} min={0} max={30000} step={100} />
            </Field>
          </div>
          <div className="flex gap-6 flex-wrap">
            <Toggle checked={headless}  onChange={setHeadless}  label="Headless browser" />
          </div>
        </div>

        {/* Advanced (collapsible) */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdv(!showAdv)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-colors"
          >
            <span>Advanced Options</span>
            {showAdv ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdv && (
            <div className="px-5 pb-5 border-t border-[#2e3350] pt-4 flex flex-col gap-4">
              <Field label="User Agent" hint="Leave blank to use the default Chrome UA">
                <TextInput value={userAgent} onChange={setUserAgent} placeholder="Mozilla/5.0 …" />
              </Field>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-1 mb-0.5">Custom CSS Selectors</div>
              <div className="text-xs text-slate-500 -mt-2 mb-1">Override auto-detection with your own selectors</div>
              <Field label="Categories selector">
                <TextInput value={selCats} onChange={setSelCats} placeholder="nav a[href]" />
              </Field>
              <Field label="Movie list selector">
                <TextInput value={selList} onChange={setSelList} placeholder=".movie-item a[href]" />
              </Field>
              <Field label="Next page selector">
                <TextInput value={selNext} onChange={setSelNext} placeholder="a.next" />
              </Field>
            </div>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-base"
        >
          <Play className="w-5 h-5" />
          {loading ? 'Launching…' : 'Start Scraping'}
        </button>
      </div>
    </div>
  )
}
