import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Workflow, FileText } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600'

export default function ProjectCreate() {
  const navigate      = useNavigate()
  const createProject = useProjectStore((s) => s.createProject)

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Please enter a project name'); return }

    const project = createProject(name.trim(), description.trim())
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
          <h1 className="text-2xl font-bold text-slate-100">New Project</h1>
          <p className="text-slate-400 text-sm mt-0.5">Set up a project and build your extraction pipeline</p>
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
              <input
                autoFocus
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="e.g. E-commerce Scraper, Job Listings…"
              />
            </Field>
            <Field label="Description" hint="Optional — helps you remember what this project does">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of this project…"
                rows={2}
                className={inputCls + ' resize-none'}
              />
            </Field>
          </div>
        </div>

        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-sm text-indigo-300 font-medium mb-1">Next: Open the flow builder</p>
          <p className="text-xs text-indigo-400/70">
            Drag nodes from the left panel to build your scraping pipeline.
            Connect a source → extractors → output node, then hit Run.
          </p>
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
