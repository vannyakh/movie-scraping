import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'
import { electronPersistStorage } from '@/lib/electron-persist-storage'
import { INITIAL_NODES, INITIAL_EDGES } from '@/components/flow/nodes'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id:          string
  name:        string
  description: string
  createdAt:   string
  updatedAt:   string
  nodes:       Node[]
  edges:       Edge[]
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ProjectStore {
  projects: Project[]

  createProject: (name: string, description?: string) => Project
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  deleteProject: (id: string) => void
  getProject:    (id: string) => Project | undefined
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],

      createProject: (name, description = '') => {
        const project: Project = {
          id:          crypto.randomUUID(),
          name:        name.trim(),
          description: description.trim(),
          createdAt:   new Date().toISOString(),
          updatedAt:   new Date().toISOString(),
          nodes:       INITIAL_NODES.map(n => ({ ...n, data: { ...n.data } })),
          edges:       INITIAL_EDGES.map(e => ({ ...e })),
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
    }),
    {
      name:    'movie-scraping-projects',
      storage: electronPersistStorage,
    },
  ),
)
