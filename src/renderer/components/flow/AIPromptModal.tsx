import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

interface Props {
  onClose:  () => void
  onSubmit: (prompt: string) => Promise<void>
}

export function AIPromptModal({ onClose, onSubmit }: Props) {
  const [prompt,  setPrompt]  = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    await onSubmit(prompt.trim())
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#12141e] border border-[#1e2235] rounded-2xl p-5 w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Build with AI</h2>
            <p className="text-[11px] text-slate-500">Describe what you want to scrape</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <textarea
          autoFocus
          className="w-full bg-[#0d0f1a] border border-[#2a2e45] text-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-pink-500/60 transition-colors resize-none h-28 placeholder-slate-600"
          placeholder="e.g. Scrape product names, prices, and ratings from an e-commerce site and save as CSV…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }}
        />
        <p className="text-[10px] text-slate-700 mt-1.5">⌘+Enter to submit</p>

        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-white bg-pink-600 hover:bg-pink-500 rounded-xl transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
