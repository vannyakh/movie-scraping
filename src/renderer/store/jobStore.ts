import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkflowConfig, JobProgress, JobResult, DataRecord, NodeStatus } from '../../lib/ipc'
import { electronPersistStorage } from '@/lib/electron-persist-storage'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'idle' | 'running' | 'paused' | 'done' | 'error' | 'stopped'

export interface ActiveJob {
  workflowId:   string
  workflowName?: string
  config:       WorkflowConfig
  status:       JobStatus
  progress:     JobProgress | null
  logs:         string[]
  records:      DataRecord[]
  nodeStatuses: Record<string, NodeStatus>
  result:       JobResult | null
  error:        string | null
  startedAt:    string
}

export interface JobHistoryEntry {
  id:            string
  workflowId:    string
  workflowName?: string
  sourceUrl?:    string
  status:        'done' | 'error' | 'stopped'
  totalRecords:  number
  startedAt:     string
  finishedAt:    string
  config:        WorkflowConfig
  outputPaths?:  Record<string, string>
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface JobStore {
  activeJob: ActiveJob | null
  history:   JobHistoryEntry[]

  initJob:          (config: WorkflowConfig, workflowName?: string) => void
  updateProgress:   (p: JobProgress)  => void
  appendLog:        (msg: string)     => void
  appendRecords:    (r: DataRecord[]) => void
  updateNodeStatus: (s: NodeStatus)   => void
  setStatus:        (s: JobStatus)    => void
  completeJob:      (result: JobResult) => void
  failJob:          (error: string)   => void
  stopJob:          ()                => void
  clearActive:      ()                => void
  deleteHistory:    (id: string)      => void
  clearHistory:     ()                => void
}

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      activeJob: null,
      history:   [],

      initJob: (config, workflowName) =>
        set({
          activeJob: {
            workflowId: config.workflowId,
            workflowName,
            config,
            status:       'running',
            progress:     null,
            logs:         [],
            records:      [],
            nodeStatuses: {},
            result:       null,
            error:        null,
            startedAt:    new Date().toISOString(),
          },
        }),

      updateProgress: (progress) =>
        set((s) => ({ activeJob: s.activeJob ? { ...s.activeJob, progress } : null })),

      appendLog: (msg) =>
        set((s) => ({
          activeJob: s.activeJob
            ? { ...s.activeJob, logs: [...s.activeJob.logs.slice(-499), msg] }
            : null,
        })),

      appendRecords: (records) =>
        set((s) => ({
          activeJob: s.activeJob
            ? { ...s.activeJob, records: [...s.activeJob.records, ...records] }
            : null,
        })),

      updateNodeStatus: (status) =>
        set((s) => ({
          activeJob: s.activeJob
            ? { ...s.activeJob, nodeStatuses: { ...s.activeJob.nodeStatuses, [status.nodeId]: status } }
            : null,
        })),

      setStatus: (status) =>
        set((s) => ({ activeJob: s.activeJob ? { ...s.activeJob, status } : null })),

      completeJob: (result) => {
        const { activeJob } = get()
        if (!activeJob) return
        const sourceNode = activeJob.config.nodes.find(
          (n) => n.type === 'browser-source' || n.type === 'http-source' || n.type === 'api-source',
        )
        const entry: JobHistoryEntry = {
          id:          crypto.randomUUID(),
          workflowId:  activeJob.workflowId,
          workflowName: activeJob.workflowName,
          sourceUrl:   (sourceNode?.data as { url?: string })?.url,
          status:      'done',
          totalRecords: result.totalRecords,
          startedAt:   activeJob.startedAt,
          finishedAt:  new Date().toISOString(),
          config:      activeJob.config,
          outputPaths: result.outputPaths,
        }
        set((s) => ({
          activeJob: s.activeJob ? { ...s.activeJob, status: 'done', result } : null,
          history:   [entry, ...s.history.slice(0, 49)],
        }))
      },

      failJob: (error) => {
        const { activeJob } = get()
        if (!activeJob) return
        const sourceNode = activeJob.config.nodes.find(
          (n) => n.type === 'browser-source' || n.type === 'http-source' || n.type === 'api-source',
        )
        const entry: JobHistoryEntry = {
          id:           crypto.randomUUID(),
          workflowId:   activeJob.workflowId,
          workflowName: activeJob.workflowName,
          sourceUrl:    (sourceNode?.data as { url?: string })?.url,
          status:       'error',
          totalRecords: activeJob.records.length,
          startedAt:    activeJob.startedAt,
          finishedAt:   new Date().toISOString(),
          config:       activeJob.config,
        }
        set((s) => ({
          activeJob: s.activeJob ? { ...s.activeJob, status: 'error', error } : null,
          history:   [entry, ...s.history.slice(0, 49)],
        }))
      },

      stopJob: () => {
        const { activeJob } = get()
        if (!activeJob) return
        const sourceNode = activeJob.config.nodes.find(
          (n) => n.type === 'browser-source' || n.type === 'http-source' || n.type === 'api-source',
        )
        const entry: JobHistoryEntry = {
          id:           crypto.randomUUID(),
          workflowId:   activeJob.workflowId,
          workflowName: activeJob.workflowName,
          sourceUrl:    (sourceNode?.data as { url?: string })?.url,
          status:       'stopped',
          totalRecords: activeJob.records.length,
          startedAt:    activeJob.startedAt,
          finishedAt:   new Date().toISOString(),
          config:       activeJob.config,
        }
        set((s) => ({
          activeJob: s.activeJob ? { ...s.activeJob, status: 'stopped' } : null,
          history:   [entry, ...s.history.slice(0, 49)],
        }))
      },

      clearActive:   () => set({ activeJob: null }),
      deleteHistory: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
      clearHistory:  () => set({ history: [] }),
    }),
    {
      name:       'dataflow-jobs',
      storage:    electronPersistStorage,
      partialize: (s) => ({ history: s.history }),
    },
  ),
)
