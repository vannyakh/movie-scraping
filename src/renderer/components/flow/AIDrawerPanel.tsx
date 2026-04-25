import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, X, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EXAMPLES = [
  'Scrape product names, prices, and ratings from an e-commerce site and save as CSV',
  'Extract article titles, dates, and summaries from a news website',
  'Get job listings with title, company, location, and salary from a job board',
  'Scrape hotel names, prices, and star ratings from a travel booking site',
  'Collect GitHub repository names, stars, and descriptions from a user profile',
]

interface Props {
  onClose:     () => void
  onGenerate:  (prompt: string) => Promise<string | null>
  apiConfigured: boolean
}

export function AIDrawerPanel({ onClose, onGenerate, apiConfigured }: Props) {
  const navigate             = useNavigate()
  const [prompt,  setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]  = useState<string | null>(null)

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
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1e2235] shrink-0">
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
        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
              {error.includes('Settings') && (
                <button
                  onClick={() => navigate('/settings')}
                  className="text-[10px] text-red-500 hover:text-red-300 underline mt-0.5 flex items-center gap-1 transition-colors"
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
