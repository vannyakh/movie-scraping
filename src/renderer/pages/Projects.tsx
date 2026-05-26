import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Workflow, MoreVertical, Pencil, Trash2,
  FolderOpen, Clock, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { useProjectStore, type Project } from '@/store/projectStore'

// ─── Option Menu ──────────────────────────────────────────────────────────────

interface OptionMenuProps {
  project:   Project
  onRename:  (p: Project) => void
  onDelete:  (p: Project) => void
}

function OptionMenu({ project, onRename, onDelete }: OptionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors"
        title="Options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-40 rounded-xl bg-[#1e2130] border border-[#2e3350] shadow-2xl overflow-hidden py-1">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(project) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-indigo-400" />
            Rename
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(project) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Rename Dialog ────────────────────────────────────────────────────────────

interface RenameDialogProps {
  project:  Project
  onSave:   (name: string) => void
  onCancel: () => void
}

function RenameDialog({ project, onSave, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(project.name)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) { toast.error('Name cannot be empty'); return }
    onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d27] border border-[#2e3350] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-base font-bold text-slate-100 mb-4">Rename Project</h2>
        <input
          autoFocus
          className="w-full bg-[#0f1117] border border-[#2e3350] text-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
          placeholder="Project name…"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project:  Project
  onClick:  () => void
  onRename: (p: Project) => void
  onDelete: (p: Project) => void
}

function ProjectCard({ project, onClick, onRename, onDelete }: ProjectCardProps) {
  const firstWf   = project.workflows[0]
  const nodeCount = firstWf?.nodes.length ?? 0
  const edgeCount = firstWf?.edges.length ?? 0
  const wfCount   = project.workflows.length

  const date = new Date(project.updatedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      onClick={onClick}
      className="group relative bg-[#1a1d27] border border-[#2e3350] hover:border-indigo-500/50 rounded-xl p-5 cursor-pointer transition-all hover:bg-[#1e2135] hover:shadow-lg hover:shadow-indigo-950/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/30 transition-colors">
            <Workflow className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <OptionMenu project={project} onRename={onRename} onDelete={onDelete} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-4">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {wfCount} workflow{wfCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
          {edgeCount} link{edgeCount !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-600">
          <Clock className="w-3 h-3" />
          {date}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Projects() {
  const navigate      = useNavigate()
  const { projects, updateProject, deleteProject } = useProjectStore()

  const [search,        setSearch]        = useState('')
  const [renamingProject, setRenamingProject] = useState<Project | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleRename = (name: string) => {
    if (!renamingProject) return
    updateProject(renamingProject.id, { name })
    toast.success('Project renamed')
    setRenamingProject(null)
  }

  const handleDelete = (id: string) => {
    deleteProject(id)
    toast.success('Project deleted')
    setDeletingId(null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-400 text-sm mt-1">
            {projects.length === 0
              ? 'Create your first scraping project'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/30 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search — only show when there's something to search */}
      {projects.length > 4 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full bg-[#1a1d27] border border-[#2e3350] text-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <FolderOpen className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-300 mb-2">No projects yet</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-xs leading-relaxed">
            Create a project to build your scraping pipeline with the visual Flow Builder.
          </p>
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create First Project
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/projects/${p.id}`)}
              onRename={(proj) => setRenamingProject(proj)}
              onDelete={(proj) => setDeletingId(proj.id)}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {projects.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-sm">No projects match "<span className="text-slate-400">{search}</span>"</p>
        </div>
      )}

      {/* Rename dialog */}
      {renamingProject && (
        <RenameDialog
          project={renamingProject}
          onSave={handleRename}
          onCancel={() => setRenamingProject(null)}
        />
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-[#2e3350] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-slate-100 mb-2">Delete Project?</h2>
            <p className="text-sm text-slate-400 mb-6">
              This will permanently delete the project and its flow configuration. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
