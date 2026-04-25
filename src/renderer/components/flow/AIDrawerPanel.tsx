import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, AlertCircle, X, Settings, RefreshCw, ChevronDown, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

const EXAMPLES = [
  'Scrape product names, prices, and ratings from an e-commerce site and save as CSV',
  'Extract article titles, dates, and summaries from a news website',
  'Get job listings with title, company, location, and salary from a job board',
  'Scrape hotel names, prices, and star ratings from a travel booking site',
  'Collect GitHub repository names, stars, and descriptions from a user profile',
]

// ─── Inline model picker ──────────────────────────────────────────────────────

interface ModelPickerProps {
  models:        string[]
  current:       string
  loading:       boolean
  error:         string | null
  onSelect:      (m: string) => void
  onRefresh:     () => void
}

function ModelPicker({ models, current, loading, error, onSelect, onRefresh }: ModelPickerProps) {
  const [open, setOpen] = useState(false)

  const label = current
    ? current.length > 28 ? current.slice(0, 26) + '…' : current
    : 'Select model'

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {/* Dropdown trigger */}
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          title="Switch model"
          className={cn(
            'flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[10px] font-medium transition-all border max-w-[170px]',
            'bg-[#1a1d2e] border-[#2a2e45] text-slate-400',
            'hover:text-slate-100 hover:border-[#3a3e55]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            open && 'border-pink-500/40 text-pink-300',
          )}
        >
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            : <Sparkles className="w-3 h-3 shrink-0 text-pink-400" />}
          <span className="truncate">{label}</span>
          <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh model list from API"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-pink-400 hover:bg-pink-500/10 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Dropdown list */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] max-w-[260px] rounded-xl border border-[#2a2e45] bg-[#12141e] shadow-2xl overflow-hidden">
            <div className="px-3 py-1.5 border-b border-[#1e2235]">
              <span className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Available models</span>
            </div>

            {error && (
              <div className="px-3 py-2">
                <p className="text-[10px] text-red-400">{error}</p>
              </div>
            )}

            {!error && models.length === 0 && !loading && (
              <div className="px-3 py-2">
                <p className="text-[10px] text-slate-500">No models loaded — click ↻ to fetch</p>
              </div>
            )}

            <div className="max-h-52 overflow-y-auto">
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => { onSelect(m); setOpen(false) }}
                  className={cn(
                    'w-full text-left flex items-center gap-2 px-3 py-2 text-[11px] transition-colors',
                    m === current
                      ? 'text-pink-300 bg-pink-500/10'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5',
                  )}
                >
                  <Check className={cn('w-3 h-3 shrink-0', m === current ? 'opacity-100 text-pink-400' : 'opacity-0')} />
                  <span className="truncate font-mono">{m}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  onClose:       () => void
  onGenerate:    (prompt: string) => Promise<string | null>
  apiConfigured: boolean
}

export function AIDrawerPanel({ onClose, onGenerate, apiConfigured }: Props) {
  const navigate              = useNavigate()
  const { settings, update }  = useSettingsStore()

  const [prompt,        setPrompt]        = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  const [models,        setModels]        = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelFetchErr, setModelFetchErr] = useState<string | null>(null)

  const isModelNotFound = !!error?.includes('Model not found')

  // Fetch available models from the provider API
  const refreshModels = useCallback(async () => {
    if (!apiConfigured) return
    setLoadingModels(true)
    setModelFetchErr(null)
    try {
      const list = await window.electronAPI.fetchModels(settings.aiProvider, settings.aiApiKey)
      if (list && list.length > 0) {
        setModels(list)
        // Auto-select first model when current is not found
        if (!list.includes(settings.aiModel)) {
          update({ aiModel: list[0] })
        }
        // Clear model_not_found error after successful refresh
        setError((prev) => (prev?.includes('Model not found') ? null : prev))
      } else {
        setModelFetchErr('Could not load models. Check your API key.')
      }
    } catch {
      setModelFetchErr('Network error while fetching models.')
    } finally {
      setLoadingModels(false)
    }
  }, [apiConfigured, settings.aiProvider, settings.aiApiKey, settings.aiModel, update])

  // Auto-fetch on mount / when provider changes
  useEffect(() => {
    if (apiConfigured) refreshModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfigured, settings.aiProvider])

  // Auto-refresh when model_not_found error surfaces
  useEffect(() => {
    if (isModelNotFound) refreshModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModelNotFound])

  const submit = async () => {
    if (!prompt.trim() || loading || !apiConfigured) return
    setLoading(true)
    setError(null)
    const err = await onGenerate(prompt.trim())
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setPrompt('')
    }
  }

  return (
    <div className="w-full h-full border-l border-[#1e2235] bg-[#0d0f1a] flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e2235] shrink-0">
        <div className="w-7 h-7 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-slate-100">Build with AI</div>
          <div className="text-[10px] text-slate-500">Describe your scraping workflow</div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Model selector bar */}
      {apiConfigured && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2235] bg-[#0a0c17] shrink-0">
          <span className="text-[10px] text-slate-600 shrink-0">Model</span>
          <ModelPicker
            models={models}
            current={settings.aiModel}
            loading={loadingModels}
            error={modelFetchErr}
            onSelect={(m) => update({ aiModel: m })}
            onRefresh={refreshModels}
          />
          {models.length > 0 && (
            <span className="text-[9px] text-slate-700 ml-auto shrink-0">{models.length} available</span>
          )}
        </div>
      )}

      {/* API not configured warning */}
      {!apiConfigured && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-400 leading-relaxed">No AI key configured.</p>
            <button
              onClick={() => navigate('/settings')}
              className="text-[10px] text-amber-500 hover:text-amber-300 underline mt-0.5 transition-colors"
            >
              Open Settings → AI
            </button>
          </div>
        </div>
      )}

      {/* Example prompts */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 scrollbar-thin">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Examples</div>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setPrompt(ex); setError(null) }}
              className="text-left text-[11px] text-slate-400 bg-[#12141e] hover:bg-[#1a1d2e] border border-[#1e2235] hover:border-[#2a2e45] rounded-xl px-3 py-2.5 transition-all duration-150 leading-relaxed"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Input + generate */}
      <div className="px-3 pb-3 pt-2 flex flex-col gap-2 border-t border-[#1e2235] mt-2 shrink-0">

        {/* Error banner */}
        {error && (
          <div className={cn(
            'flex items-start gap-2 p-2.5 rounded-xl border',
            isModelNotFound
              ? 'bg-orange-500/10 border-orange-500/20'
              : 'bg-red-500/10 border-red-500/20',
          )}>
            <AlertCircle className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', isModelNotFound ? 'text-orange-400' : 'text-red-400')} />
            <div className="flex-1 min-w-0 space-y-1">
              <p className={cn('text-[11px] leading-relaxed', isModelNotFound ? 'text-orange-400' : 'text-red-400')}>
                {error}
              </p>
              {isModelNotFound && (
                <button
                  onClick={refreshModels}
                  disabled={loadingModels}
                  className="flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3 h-3', loadingModels && 'animate-spin')} />
                  {loadingModels ? 'Refreshing models…' : 'Refresh model list'}
                </button>
              )}
              {error.includes('Settings') && (
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-300 underline transition-colors"
                >
                  <Settings className="w-3 h-3" /> Open Settings
                </button>
              )}
            </div>
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }}
          placeholder="Describe what you want to scrape…"
          className="w-full bg-[#12141e] border border-[#2a2e45] focus:border-pink-500/50 text-slate-200 text-[11px] rounded-xl px-3 py-2.5 outline-none resize-none h-20 placeholder-slate-600 transition-colors"
        />

        <button
          onClick={submit}
          disabled={loading || !prompt.trim() || !apiConfigured}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[11px] font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
            : <><Sparkles className="w-3.5 h-3.5" /> Generate Workflow</>}
        </button>
        <p className="text-[10px] text-slate-700 text-center">⌘+Enter to submit</p>
      </div>
    </div>
  )
}
