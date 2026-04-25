import { toast } from 'sonner'
import {
  RotateCcw, FolderOpen, Monitor, Clock, Download, Bot, Key, Eye, EyeOff,
  Globe, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Cookie,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-200">{title}</span>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn('relative w-9 h-5 rounded-full transition-colors', checked ? 'bg-indigo-600' : 'bg-[#2e3350]')}>
      <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow', checked ? 'translate-x-4' : '')} />
    </button>
  )
}

function NumberField({ value, onChange, min = 0, max, step = 1, unit }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 text-right" />
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
  )
}

// ─── Browser engine install panel ────────────────────────────────────────────

function BrowserEngineSection() {
  type InstallState = 'idle' | 'installing' | 'done_ok' | 'done_err'

  const [installed,    setInstalled]    = useState<boolean | null>(null)
  const [installState, setInstallState] = useState<InstallState>('idle')
  const [logs,         setLogs]         = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Check on mount
  useEffect(() => {
    window.electronAPI.checkBrowserInstalled().then(setInstalled)
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const handleInstall = async () => {
    setInstallState('installing')
    setLogs([])

    const unsub = window.electronAPI.onBrowserInstallLog(({ text, done, success }) => {
      setLogs((prev) => [...prev, text])
      if (done) {
        unsub()
        setInstallState(success ? 'done_ok' : 'done_err')
        setInstalled(success ?? false)
        if (success) toast.success('Chromium installed successfully!')
        else         toast.error('Chromium installation failed.')
      }
    })

    await window.electronAPI.installBrowser()
  }

  const isInstalling = installState === 'installing'

  return (
    <Section icon={Globe} title="Browser Engine">
      {/* Status row */}
      <Row label="Chromium status" hint="Required for browser-based scraping nodes">
        {installed === null ? (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
          </span>
        ) : installed ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Installed
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" /> Not installed
          </span>
        )}
      </Row>

      {/* Install / re-install button */}
      <Row
        label={installed ? 'Re-install / update Chromium' : 'Install Chromium'}
        hint={installed ? 'Downloads the latest compatible version' : 'Required to run workflows — ~150 MB download'}
      >
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            installed
              ? 'bg-[#21253a] border border-[#2e3350] text-slate-300 hover:text-white hover:border-indigo-500/50'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isInstalling
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Installing…</>
            : <><Download className="w-3.5 h-3.5" /> {installed ? 'Reinstall' : 'Install Chromium'}</>}
        </button>
      </Row>

      {/* Live log output */}
      {logs.length > 0 && (
        <div
          ref={logRef}
          className={cn(
            'rounded-xl border text-[10px] font-mono leading-relaxed p-3 overflow-y-auto max-h-40 whitespace-pre-wrap',
            installState === 'done_ok'  ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300' :
            installState === 'done_err' ? 'bg-red-950/30 border-red-500/20 text-red-300' :
                                         'bg-[#0d0f1a] border-[#1e2235] text-slate-400',
          )}
        >
          {logs.join('')}
        </div>
      )}
    </Section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const { settings, update, reset } = useSettingsStore()
  const [showApiKey, setShowApiKey] = useState(false)

  const pickFolder = async () => {
    const folder = await window.electronAPI.selectFolder()
    if (folder) { update({ outputDir: folder }); toast.success('Output folder updated') }
  }

  const handleReset = () => { reset(); toast.success('Settings reset to defaults') }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Default values applied to new workflows</p>
        </div>
        <button onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1d27] border border-[#2e3350] text-slate-400 hover:text-white rounded-lg text-sm transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Reset defaults
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Browser Engine */}
        <BrowserEngineSection />

        {/* Proxy */}
        <Section icon={ShieldCheck} title="Proxy">
          <div className="rounded-lg bg-indigo-600/8 border border-indigo-500/20 px-3 py-2.5 mb-1">
            <p className="text-[11px] text-indigo-300 leading-relaxed">
              Global proxy applies to all browser and HTTP nodes unless overridden per-node.
              Format: <span className="font-mono text-indigo-200">http://[user:pass@]host:port</span> or <span className="font-mono text-indigo-200">socks5://host:port</span>
            </p>
          </div>
          <Row label="Enable proxy" hint="Route all scraping traffic through the proxy">
            <Toggle checked={settings.proxyEnabled} onChange={v => update({ proxyEnabled: v })} />
          </Row>
          {settings.proxyEnabled && (
            <>
              <Row label="Proxy URL" hint="e.g. http://user:pass@proxy.host:3128">
                <input
                  value={settings.proxyUrl}
                  onChange={e => update({ proxyUrl: e.target.value })}
                  className="w-64 bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono"
                  placeholder="http://proxy.example.com:3128"
                />
              </Row>
              <Row label="Bypass hosts" hint="Comma-separated hostnames to skip proxy">
                <input
                  value={settings.proxyBypass}
                  onChange={e => update({ proxyBypass: e.target.value })}
                  className="w-64 bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono"
                  placeholder="localhost,127.0.0.1"
                />
              </Row>
            </>
          )}
        </Section>

        {/* Global Cookies */}
        <Section icon={Cookie} title="Global Cookies">
          <div className="rounded-lg bg-amber-600/8 border border-amber-500/20 px-3 py-2.5 mb-1">
            <p className="text-[11px] text-amber-300 leading-relaxed">
              Cookies set here are shared across all browser-based nodes. Per-node cookies override this.
              Paste from browser DevTools → Application → Cookies.
            </p>
          </div>
          <Row label="Cookie string">
            <div className="w-full" />
          </Row>
          <textarea
            value={settings.globalCookies}
            onChange={e => update({ globalCookies: e.target.value })}
            rows={4}
            className="w-full bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-500/60 font-mono resize-none placeholder-slate-600"
            placeholder="session_id=abc123; auth_token=xyz789; csrf_token=def456"
          />
          {settings.globalCookies && (
            <p className="text-[10px] text-slate-600">
              {settings.globalCookies.split(';').filter(s => s.trim()).length} cookie{settings.globalCookies.split(';').filter(s => s.trim()).length !== 1 ? 's' : ''} configured
            </p>
          )}
        </Section>

        {/* Browser defaults */}
        <Section icon={Monitor} title="Browser Defaults">
          <Row label="Headless mode" hint="Run Chromium without a visible window">
            <Toggle checked={settings.headless} onChange={(v) => update({ headless: v })} />
          </Row>
          <Row label="User Agent" hint="Leave blank for default Chrome UA">
            <input value={settings.userAgent} onChange={(e) => update({ userAgent: e.target.value })}
              className="w-64 bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
              placeholder="Mozilla/5.0 …" />
          </Row>
        </Section>

        {/* Request timing */}
        <Section icon={Clock} title="Request Timing">
          <Row label="Delay between requests" hint="Politeness delay to avoid rate limiting">
            <NumberField value={settings.delayMs} onChange={(v) => update({ delayMs: v })} min={0} max={30000} step={100} unit="ms" />
          </Row>
          <Row label="Max pages per source" hint="Pagination depth limit">
            <NumberField value={settings.maxPages} onChange={(v) => update({ maxPages: v })} min={1} max={1000} />
          </Row>
          <Row label="Max items per source">
            <NumberField value={settings.maxItems} onChange={(v) => update({ maxItems: v })} min={1} max={100000} />
          </Row>
        </Section>

        {/* Export */}
        <Section icon={Download} title="Export Formats">
          <Row label="JSON">
            <Toggle checked={settings.exportJson} onChange={(v) => update({ exportJson: v })} />
          </Row>
          <Row label="Excel (.xlsx)">
            <Toggle checked={settings.exportExcel} onChange={(v) => update({ exportExcel: v })} />
          </Row>
          <Row label="CSV">
            <Toggle checked={settings.exportCsv} onChange={(v) => update({ exportCsv: v })} />
          </Row>
          <Row label="Default output folder">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 max-w-[160px] truncate">{settings.outputDir || 'Not set'}</span>
              <button onClick={pickFolder}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#21253a] border border-[#2e3350] text-slate-300 hover:text-white rounded-lg text-xs transition-colors">
                <FolderOpen className="w-3.5 h-3.5" /> Browse
              </button>
            </div>
          </Row>
        </Section>

        {/* AI */}
        <Section icon={Bot} title="AI Integration">
          <div className="rounded-lg bg-pink-600/10 border border-pink-500/20 px-3 py-2.5 mb-1">
            <p className="text-[11px] text-pink-300 leading-relaxed">
              AI features (AI Extractor node, Build Workflow with AI) require an API key.
              Keys are stored locally and never shared.
            </p>
          </div>
          <Row label="Provider">
            <select value={settings.aiProvider}
              onChange={(e) => {
                const p = e.target.value as 'openai' | 'anthropic' | 'none'
                update({
                  aiProvider: p,
                  // Reset to the provider's current default model to avoid stale 404 model names
                  aiModel: p === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini',
                })
              }}
              className="bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500">
              <option value="none">None (disabled)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </Row>
          {settings.aiProvider !== 'none' && (
            <>
              <Row label={settings.aiProvider === 'openai' ? 'OpenAI API Key' : 'Anthropic API Key'} hint="Starts with sk-…">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.aiApiKey}
                      onChange={(e) => update({ aiApiKey: e.target.value })}
                      className="w-52 bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg pl-7 pr-8 py-1.5 text-xs outline-none focus:border-indigo-500"
                      placeholder="sk-…"
                    />
                    <button
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </Row>
              <Row label="Model">
                <select value={settings.aiModel}
                  onChange={(e) => update({ aiModel: e.target.value })}
                  className="bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500">
                  {settings.aiProvider === 'openai'
                    ? (
                      <>
                        <option value="gpt-4o-mini">gpt-4o-mini (Fast)</option>
                        <option value="gpt-4o">gpt-4o (Balanced)</option>
                        <option value="gpt-4.1-mini">gpt-4.1-mini (Fast)</option>
                        <option value="gpt-4.1">gpt-4.1 (Smart)</option>
                      </>
                    ) : (
                      <>
                        <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (Fast)</option>
                        <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Balanced)</option>
                        <option value="claude-3-7-sonnet-20250219">claude-3-7-sonnet (Smart)</option>
                      </>
                    )}
                </select>
              </Row>
            </>
          )}
        </Section>

        <button
          onClick={() => toast.success('Settings auto-saved')}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Settings are saved automatically
        </button>
      </div>
    </div>
  )
}
