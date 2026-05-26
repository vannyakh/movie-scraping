/**
 * Renderer-side typed IPC wrapper.
 * Types come from `src/shared/ipc-types.ts` so they stay aligned with the main process.
 */

export type {
  DataRecord,
  WorkflowConfig,
  WorkflowNodeConfig,
  WorkflowEdgeConfig,
  JobProgress,
  JobResult,
  NodeStatus,
  NodeExecStatus,
  WorkflowStartResult,
  // Legacy
  ScraperConfig,
  ScraperProgress,
  ScraperResult,
  MovieData,
} from '@shared/ipc-types'

import type {
  DataRecord,
  WorkflowConfig,
  JobProgress,
  JobResult,
  NodeStatus,
  WorkflowStartResult,
  ScraperConfig,
  ScraperResult,
  MovieData,
} from '@shared/ipc-types'

declare global {
  interface Window {
    electronAPI: {
      // Generic workflow engine
      startWorkflow:    (config: WorkflowConfig)    => Promise<WorkflowStartResult>
      stopWorkflow:     ()                           => Promise<void>
      pauseWorkflow:    ()                           => Promise<void>
      resumeWorkflow:   ()                           => Promise<void>

      // AI
      generateWorkflow: (prompt: string)             => Promise<{ nodes: unknown[]; edges: unknown[] } | { __error: string; message: string } | null>
      fetchModels:      (provider: string, apiKey: string) => Promise<string[] | null>
      analyzeSelectors: (
        html:    string,
        fields:  Array<{ id: string; label: string; type?: string }>,
        pageUrl?: string,
      ) => Promise<{
        selectors:        Record<string, string>
        itemSelector?:    string
        paginationType?:  string
        nextPageSelector?: string
        urlPattern?:      string
      } | { __error: string; message: string }>

      // Node test runner
      testNode: (
        targetNodeId: string,
        allNodes:     unknown[],
        allEdges:     unknown[],
      ) => Promise<{ success: boolean; records: unknown[]; error?: string }>
      stopNodeTest:       () => Promise<void>
      onNodeTestLog:      (cb: (text: string) => void) => () => void
      onNodeTestComplete: (cb: (result: { success: boolean; records: unknown[]; error?: string }) => void) => () => void

      // Browser engine
      checkBrowserInstalled: () => Promise<boolean>
      installBrowser:        () => Promise<{ success: boolean; error?: string }>
      onBrowserInstallLog:   (cb: (payload: { text: string; done: boolean; success?: boolean }) => void) => () => void

      // Utilities
      openPath:     (filePath: string)               => Promise<void>
      selectFolder: ()                               => Promise<string | null>
      storeGet:     (key: string)                    => Promise<string | null>
      storeSet:     (key: string, value: string)     => Promise<void>
      storeRemove:  (key: string)                    => Promise<void>

      // Push events (generic)
      onProgress:   (cb: (p: JobProgress)    => void) => () => void
      onLog:        (cb: (msg: string)        => void) => () => void
      onBatch:      (cb: (r: DataRecord[])    => void) => () => void
      onComplete:   (cb: (r: JobResult)       => void) => () => void
      onError:      (cb: (err: string)        => void) => () => void
      onNodeStatus: (cb: (s: NodeStatus)      => void) => () => void
      onTrayQuickTask: (cb: (task: 'open-dashboard' | 'open-projects' | 'open-task-jobs' | 'open-settings') => void) => () => void

      // Legacy (kept for backward compat)
      startScraping:  (config: ScraperConfig) => Promise<{ success: boolean; error?: string } & Partial<ScraperResult>>
      stopScraping:   ()                      => Promise<void>
      pauseScraping:  ()                      => Promise<void>
      resumeScraping: ()                      => Promise<void>
      onMovieBatch:   (cb: (movies: MovieData[]) => void) => () => void
    }
  }
}

export const ipc = window.electronAPI
