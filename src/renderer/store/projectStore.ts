import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'
import { electronPersistStorage } from '@/lib/electron-persist-storage'
import { INITIAL_NODES, INITIAL_EDGES } from '@/components/flow/nodes'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Workflow {
  id:          string
  name:        string
  description: string
  nodes:       Node[]
  edges:       Edge[]
  createdAt:   string
  updatedAt:   string
}

export interface Project {
  id:          string
  name:        string
  description: string
  createdAt:   string
  updatedAt:   string
  workflows:   Workflow[]
  /** @deprecated kept for migration from old persisted format */
  nodes?: Node[]
  /** @deprecated kept for migration from old persisted format */
  edges?: Edge[]
}

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id:          crypto.randomUUID(),
    name:        'Default Workflow',
    description: '',
    nodes:       INITIAL_NODES.map(n => ({ ...n, data: { ...n.data } })),
    edges:       INITIAL_EDGES.map(e => ({ ...e })),
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    ...overrides,
  }
}

/** Migrate a legacy project (nodes+edges directly on project) to the new workflow model. */
function migrateProject(raw: Project): Project {
  if (raw.workflows && raw.workflows.length > 0) return raw
  const wf = makeWorkflow({
    nodes: (raw.nodes?.length ? raw.nodes : INITIAL_NODES).map(n => ({ ...n, data: { ...n.data } })),
    edges: (raw.edges?.length ? raw.edges : INITIAL_EDGES).map(e => ({ ...e })),
  })
  return { ...raw, workflows: [wf], nodes: undefined, edges: undefined }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ProjectStore {
  projects: Project[]

  // Project CRUD
  createProject:  (name: string, description?: string) => Project
  updateProject:  (id: string, patch: Partial<Pick<Project, 'name' | 'description'>>) => void
  deleteProject:  (id: string) => void
  getProject:     (id: string) => Project | undefined

  // Workflow CRUD
  createWorkflow:  (projectId: string, name?: string, description?: string) => Workflow | null
  updateWorkflow:  (projectId: string, workflowId: string, patch: Partial<Pick<Workflow, 'name' | 'description' | 'nodes' | 'edges'>>) => void
  deleteWorkflow:  (projectId: string, workflowId: string) => void
  getWorkflow:     (projectId: string, workflowId: string) => Workflow | undefined
  getFirstWorkflow: (projectId: string) => Workflow | undefined
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],

      // ── Project ──────────────────────────────────────────────────────────

      createProject: (name, description = '') => {
        const project: Project = {
          id:          crypto.randomUUID(),
          name:        name.trim(),
          description: description.trim(),
          createdAt:   new Date().toISOString(),
          updatedAt:   new Date().toISOString(),
          workflows:   [makeWorkflow()],
        }
        set((s) => ({ projects: [project, ...s.projects] }))
        return project
      },

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, ...patch, updatedAt: new Date().toISOString() }
              : p,
          ),
        })),

      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      getProject: (id) => get().projects.find((p) => p.id === id),

      // ── Workflow ──────────────────────────────────────────────────────────

      createWorkflow: (projectId, name = 'New Workflow', description = '') => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return null
        const wf = makeWorkflow({ name, description })
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, workflows: [...p.workflows, wf], updatedAt: new Date().toISOString() }
              : p,
          ),
        }))
        return wf
      },

      updateWorkflow: (projectId, workflowId, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              workflows: p.workflows.map((wf) =>
                wf.id === workflowId
                  ? { ...wf, ...patch, updatedAt: new Date().toISOString() }
                  : wf,
              ),
            }
          }),
        })),

      deleteWorkflow: (projectId, workflowId) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p
            const workflows = p.workflows.filter((wf) => wf.id !== workflowId)
            return { ...p, workflows, updatedAt: new Date().toISOString() }
          }),
        })),

      getWorkflow: (projectId, workflowId) => {
        const p = get().projects.find((p) => p.id === projectId)
        return p?.workflows.find((wf) => wf.id === workflowId)
      },

      getFirstWorkflow: (projectId) => {
        const p = get().projects.find((p) => p.id === projectId)
        return p?.workflows[0]
      },
    }),
    {
      name:    'dataflow-projects',
      storage: electronPersistStorage,
      // Migrate legacy projects on rehydration
      merge: (persisted, current) => {
        const state = persisted as { projects?: Project[] }
        const migrated = (state.projects ?? []).map(migrateProject)
        return { ...current, projects: migrated }
      },
    },
  ),
)
