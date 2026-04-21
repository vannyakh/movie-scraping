import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Workflow, FileText, Globe,
  FolderOpen, ChevronDown, ChevronUp, Settings2,
} from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

// ─── Mini helpers ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
    />
  )
}

function Toggle({
  checked, onChange, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectCreate() {
  const navigate    = useNavigate()
  const createProject = useProjectStore((s) => s.createProject)
  const { settings }  = useSettingsStore()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [defaultUrl,  setDefaultUrl]  = useState(settings.defaultUrl || '')
  const [outputDir,   setOutputDir]   = useState(settings.outputDir  || '')
  const [headless,    setHeadless]    = useState(settings.headless)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const pickFolder = async () => {
    const folder = await window.electronAPI.selectFolder()
    if (folder) setOutputDir(folder)
  }

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Please enter a project name')
      return
    }

    const project = createProject(name.trim(), description.trim())

    // Pre-fill the source node's baseUrl if one was provided
    if (defaultUrl.trim() || outputDir.trim() || !headless) {
      const { updateProject } = useProjectStore.getState()
      const updatedNodes = project.nodes.map((n) => {
        if (n.type === 'source' && (defaultUrl.trim() || !headless)) {
          return {
            ...n,
            data: {
              ...n.data,
              baseUrl:  defaultUrl.trim() || (n.data as { baseUrl: string }).baseUrl,
              headless,
            },
          }
        }
        if (n.type === 'export' && outputDir.trim()) {
          return { ...n, data: { ...n.data, outputDir: outputDir.trim() } }
        }
        return n
      })
      updateProject(project.id, { nodes: updatedNodes })
    }

    toast.success('Project created!')
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Projects
      </button>

      {/* Title */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <Workflow className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Create Project</h1>
          <p className="text-slate-400 text-sm mt-0.5">Set up your project then build the scraping flow</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Basic info */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Project Info</span>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Project Name">
              <TextInput
                autoFocus
                value={name}
                onChange={setName}
                placeholder="e.g. IMDB Scraper, Netflix Titles…"
              />
            </Field>
            <Field label="Description" hint="Optional — helps you remember what this project does">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of this scraping project…"
                rows={2}
                className="w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 resize-none"
              />
            </Field>
          </div>
        </div>

        {/* Optional: quick config prefill */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Quick Setup</span>
            <span className="ml-auto text-xs text-slate-500">Pre-fills the flow builder</span>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Target URL" hint="The homepage or category listing URL — can be set later in the flow">
              <TextInput
                value={defaultUrl}
                onChange={setDefaultUrl}
                placeholder="https://example-movie-site.com"
              />
            </Field>
            <Field label="Output Folder" hint="Where exports will be saved">
              <div className="flex gap-2">
                <TextInput value={outputDir} onChange={setOutputDir} placeholder="Select folder…" />
                <button
                  onClick={pickFolder}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#21253a] border border-[#2e3350] text-slate-300 rounded-lg hover:border-indigo-500 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse
                </button>
              </div>
            </Field>
          </div>
        </div>

        {/* Advanced */}
        <div className="bg-[#1a1d27] border border-[#2e3350] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-300 hover:text-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-400" />
              Advanced Options
            </div>
            {showAdvanced
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdvanced && (
            <div className="px-5 pb-5 border-t border-[#2e3350] pt-4">
              <Toggle
                checked={headless}
                onChange={setHeadless}
                label="Headless browser (no visible window)"
              />
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-base shadow-lg shadow-indigo-900/30"
        >
          <Workflow className="w-5 h-5" />
          Create & Open Flow Builder
        </button>
      </div>
    </div>
  )
}
