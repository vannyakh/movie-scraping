import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sparkles, Loader2, AlertCircle, X, RefreshCw,
  ChevronDown, Check, Trash2, User, Bot, WandSparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/store/settingsStore'
import { useAIChatStore } from '@/store/aiChatStore'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000)      return 'just now'
  if (d < 3_600_000)   return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000)  return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

const EXAMPLES = [
  'Scrape product names, prices, and ratings from an e-commerce site and save as CSV',
  'Extract article titles, dates, and summaries from a news website',
  'Get job listings with title, company, location, and salary from a job board',
  'Scrape hotel names, prices, and star ratings from a travel booking site',
  'Collect GitHub repository names, stars, and descriptions from a user profile',
]

// ─── Model picker ─────────────────────────────────────────────────────────────

interface ModelPickerProps {
  models:    string[]
  current:   string
  loading:   boolean
  fetchErr:  string | null
  onSelect:  (m: string) => void
  onRefresh: () => void
}

function ModelPicker({ models, current, loading, fetchErr, onSelect, onRefresh }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const label = current
    ? (current.length > 26 ? current.slice(0, 24) + '…' : current)
    : 'Select model'

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          title="Switch model"
          className={cn(
            'flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-[10px] font-medium transition-all border max-w-[160px]',
            'bg-[#1a1d2e] border-[#2a2e45] text-slate-400 hover:text-slate-100 hover:border-[#3a3e55]',
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

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh model list"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-pink-400 hover:bg-pink-500/10 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[210px] max-w-[270px] rounded-xl border border-[#2a2e45] bg-[#12141e] shadow-2xl overflow-hidden">
            <div className="px-3 py-1.5 border-b border-[#1e2235] flex items-center justify-between">
              <span className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Available models</span>
              {models.length > 0 && <span className="text-[9px] text-slate-700">{models.length} total</span>}
            </div>
            {fetchErr && <p className="px-3 py-2 text-[10px] text-red-400">{fetchErr}</p>}
            {!fetchErr && models.length === 0 && !loading && (
              <p className="px-3 py-2 text-[10px] text-slate-500">No models — click ↻ to fetch</p>
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
                  <span className="truncate font-mono text-[10px]">{m}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

import type { ChatMessage } from '@/store/aiChatStore'

function MessageBubble({ msg, isLatest }: { msg: ChatMessage; isLatest: boolean }) {
  const isUser = msg.role === 'user'
  const isPending = msg.status === 'pending'

  return (
    <div className={cn('flex gap-2 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser
          ? 'bg-indigo-500/20 border border-indigo-500/30'
          : msg.status === 'error'
            ? 'bg-red-500/15 border border-red-500/25'
            : 'bg-pink-500/15 border border-pink-500/25',
      )}>
        {isUser
          ? <User className="w-3 h-3 text-indigo-400" />
          : isPending
            ? <Loader2 className="w-3 h-3 text-pink-400 animate-spin" />
            : <Bot className="w-3 h-3 text-pink-400" />}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-0.5 max-w-[82%]', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'px-3 py-2 rounded-2xl text-[11px] leading-relaxed',
          isUser
            ? 'bg-indigo-600/30 border border-indigo-500/25 text-slate-200 rounded-tr-sm'
            : msg.status === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm'
              : msg.status === 'pending'
                ? 'bg-[#12141e] border border-[#2a2e45] text-slate-500 rounded-tl-sm'
                : 'bg-emerald-500/8 border border-emerald-500/20 text-emerald-300 rounded-tl-sm',
        )}>
          {msg.status === 'pending' ? (
            <span className="flex items-center gap-1.5 text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Generating workflow…
            </span>
          ) : msg.status === 'success' ? (
            <span className="flex items-center gap-1.5">
              <WandSparkles className="w-3 h-3 text-emerald-400 shrink-0" />
              {msg.content}
            </span>
          ) : msg.status === 'error' ? (
            <span className="flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
              {msg.content}
            </span>
          ) : (
            msg.content
          )}
        </div>
        <span className="text-[9px] text-slate-700 px-1">
          {relativeTime(msg.timestamp)}
          {isLatest && msg.status === 'success' && (
            <span className="ml-1 text-emerald-600">· saved</span>
          )}
        </span>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  onClose:       () => void
  onGenerate:    (prompt: string) => Promise<string | null>
  apiConfigured: boolean
  projectId?:    string
}

export function AIDrawerPanel({ onClose, onGenerate, apiConfigured, projectId }: Props) {
  const navigate             = useNavigate()
  const { settings, update } = useSettingsStore()
  const { conversations, addMessage, updateMessage, clearChat } = useAIChatStore()

  const chatKey  = projectId ?? 'global'
  const messages = conversations[chatKey] ?? []

  const [prompt,        setPrompt]        = useState('')
  const [loading,       setLoading]       = useState(false)
  const [models,        setModels]        = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelFetchErr, setModelFetchErr] = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  // Fetch models from provider API
  const refreshModels = useCallback(async () => {
    if (!apiConfigured) return
    setLoadingModels(true)
    setModelFetchErr(null)
    try {
      const list = await window.electronAPI.fetchModels(settings.aiProvider, settings.aiApiKey)
      if (list && list.length > 0) {
        setModels(list)
        if (!list.includes(settings.aiModel)) update({ aiModel: list[0] })
      } else {
        setModelFetchErr('Could not load models. Check your API key.')
      }
    } catch {
      setModelFetchErr('Network error while fetching models.')
    } finally {
      setLoadingModels(false)
    }
  }, [apiConfigured, settings.aiProvider, settings.aiApiKey, settings.aiModel, update])

  useEffect(() => {
    if (apiConfigured) refreshModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfigured, settings.aiProvider])

  const submit = async () => {
    const text = prompt.trim()
    if (!text || loading || !apiConfigured) return

    setPrompt('')
    setLoading(true)

    // Add user bubble immediately
    addMessage(chatKey, { role: 'user', content: text, timestamp: Date.now() })

    // Add "pending" AI bubble
    const pendingId = addMessage(chatKey, {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending',
    })

    const errMsg = await onGenerate(text)
    setLoading(false)

    // Resolve pending bubble to success or error
    updateMessage(chatKey, pendingId, {
      content: errMsg
        ? errMsg
        : 'Workflow generated and saved to canvas.',
      status:    errMsg ? 'error' : 'success',
      timestamp: Date.now(),
    })

    // Auto-refresh model list if the error was model_not_found
    if (errMsg?.includes('Model not found')) refreshModels()
  }

  const hasMessages = messages.length > 0

  return (
    <div className="w-full h-full border-l border-[#1e2235] bg-[#0d0f1a] flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e2235] shrink-0">
        <div className="w-7 h-7 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-slate-100">Build with AI</div>
          <div className="text-[10px] text-slate-500">
            {hasMessages ? `${messages.length} message${messages.length !== 1 ? 's' : ''}` : 'Describe your scraping workflow'}
          </div>
        </div>

        {/* Clear chat */}
        {hasMessages && (
          <button
            onClick={() => clearChat(chatKey)}
            title="Clear conversation"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* ── Model selector bar ── */}
      {apiConfigured && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2235] bg-[#0a0c17] shrink-0">
          <span className="text-[10px] text-slate-600 shrink-0">Model</span>
          <ModelPicker
            models={models}
            current={settings.aiModel}
            loading={loadingModels}
            fetchErr={modelFetchErr}
            onSelect={(m) => update({ aiModel: m })}
            onRefresh={refreshModels}
          />
          {models.length > 0 && (
            <span className="text-[9px] text-slate-700 ml-auto shrink-0">{models.length} available</span>
          )}
        </div>
      )}

      {/* ── API not configured warning ── */}
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

      {/* ── Chat thread / Examples ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {!hasMessages ? (
          /* Empty state: example prompts */
          <>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Examples</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setPrompt(ex); textareaRef.current?.focus() }}
                  className="text-left text-[11px] text-slate-400 bg-[#12141e] hover:bg-[#1a1d2e] border border-[#1e2235] hover:border-[#2a2e45] rounded-xl px-3 py-2.5 transition-all duration-150 leading-relaxed"
                >
                  {ex}
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Message history */
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isLatest={i === messages.length - 1}
              />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div className="px-3 pb-3 pt-2 flex flex-col gap-2 border-t border-[#1e2235] shrink-0">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }}
          placeholder={hasMessages ? 'Ask a follow-up or describe another workflow…' : 'Describe what you want to scrape…'}
          disabled={loading}
          className="w-full bg-[#12141e] border border-[#2a2e45] focus:border-pink-500/50 text-slate-200 text-[11px] rounded-xl px-3 py-2.5 outline-none resize-none h-[72px] placeholder-slate-600 transition-colors disabled:opacity-50"
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

        {hasMessages && (
          <button
            onClick={() => { clearChat(chatKey); setPrompt('') }}
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors text-center"
          >
            + New conversation
          </button>
        )}

        <p className="text-[10px] text-slate-700 text-center">⌘+Enter to submit</p>
      </div>
    </div>
  )
}
