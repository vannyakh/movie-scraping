import { toast } from 'sonner'
import { RotateCcw, FolderOpen, Monitor, Clock, Download, Shield } from 'lucide-react'
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
    <button
      type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative w-9 h-5 rounded-full transition-colors', checked ? 'bg-indigo-600' : 'bg-[#2e3350]')}
    >
      <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow', checked ? 'translate-x-4' : '')} />
    </button>
  )
}

function NumberField({ value, onChange, min = 0, max, step = 1, unit }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 text-right"
      />
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
  )
}

export default function Settings() {
  const { settings, update, reset } = useSettingsStore()

  const pickFolder = async () => {
    const folder = await window.electronAPI.selectFolder()
    if (folder) { update({ outputDir: folder }); toast.success('Output folder updated') }
  }

  const handleReset = () => {
    reset()
    toast.success('Settings reset to defaults')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Defaults applied to every new scraping job</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1d27] border border-[#2e3350] text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset defaults
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Browser */}
        <Section icon={Monitor} title="Browser">
          <Row label="Headless mode" hint="Run Chromium without a visible window">
            <Toggle checked={settings.headless} onChange={(v) => update({ headless: v })} />
          </Row>
          <Row label="User Agent" hint="Leave blank for default Chrome UA">
            <input
              value={settings.userAgent}
              onChange={(e) => update({ userAgent: e.target.value })}
              className="w-64 bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
              placeholder="Mozilla/5.0 …"
            />
          </Row>
        </Section>

        {/* Request timing */}
        <Section icon={Clock} title="Request Timing">
          <Row label="Delay between requests" hint="Politeness delay to avoid rate limiting">
            <NumberField value={settings.delayMs} onChange={(v) => update({ delayMs: v })} min={0} max={30000} step={100} unit="ms" />
          </Row>
          <Row label="Max pages per category" hint="Pagination depth limit">
            <NumberField value={settings.maxPagesPerCategory} onChange={(v) => update({ maxPagesPerCategory: v })} min={1} max={1000} />
          </Row>
          <Row label="Max movies per category">
            <NumberField value={settings.maxMoviesPerCategory} onChange={(v) => update({ maxMoviesPerCategory: v })} min={1} max={100000} />
          </Row>
        </Section>

        {/* Export */}
        <Section icon={Download} title="Export Formats">
          <Row label="JSON" hint="Save scraped data as .json">
            <Toggle checked={settings.exportJson} onChange={(v) => update({ exportJson: v })} />
          </Row>
          <Row label="Excel (.xlsx)" hint="Save as formatted spreadsheet">
            <Toggle checked={settings.exportExcel} onChange={(v) => update({ exportExcel: v })} />
          </Row>
          <Row label="CSV" hint="Save as comma-separated values">
            <Toggle checked={settings.exportCsv} onChange={(v) => update({ exportCsv: v })} />
          </Row>
          <Row label="Default output folder" hint="Where files are saved">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 max-w-[160px] truncate">{settings.outputDir || 'Not set'}</span>
              <button onClick={pickFolder} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#21253a] border border-[#2e3350] text-slate-300 hover:text-white rounded-lg text-xs transition-colors">
                <FolderOpen className="w-3.5 h-3.5" /> Browse
              </button>
            </div>
          </Row>
        </Section>

        {/* Defaults */}
        <Section icon={Shield} title="Default URL">
          <Row label="Default scraping URL" hint="Pre-filled in new scraping form">
            <input
              value={settings.defaultUrl}
              onChange={(e) => update({ defaultUrl: e.target.value })}
              className="w-64 bg-[#0f1117] border border-[#2e3350] text-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
              placeholder="https://movie-site.com"
            />
          </Row>
        </Section>

        <button
          onClick={() => { toast.success('Settings saved') }}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}
