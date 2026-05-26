/** Shared between main (engine), preload, and renderer. */

// ─── Generic types ────────────────────────────────────────────────────────────

export interface DataRecord {
  [key: string]: unknown
}

export interface WorkflowNodeConfig {
  id:   string
  type: string
  data: Record<string, unknown>
}

export interface WorkflowEdgeConfig {
  id:     string
  source: string
  target: string
}

export interface WorkflowConfig {
  workflowId:  string
  projectId?:  string
  nodes:       WorkflowNodeConfig[]
  edges:       WorkflowEdgeConfig[]
}

export type NodeExecStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface NodeStatus {
  nodeId:       string
  status:       NodeExecStatus
  recordCount?: number
  startedAt?:   string
  completedAt?: string
  error?:       string
}

export interface JobProgress {
  nodeId?:    string
  step:       number
  totalSteps: number
  message:    string
  current:    number
  total:      number
}

export interface JobResult {
  records:      DataRecord[]
  totalRecords: number
  outputPaths?: Record<string, string>
}

export type WorkflowStartResult =
  | { success: true;  result: JobResult }
  | { success: false; error: string }

export type ProgressCallback    = (p: JobProgress)  => void
export type LogCallback         = (msg: string)      => void
export type BatchCallback       = (r: DataRecord[])  => void
export type NodeStatusCallback  = (s: NodeStatus)    => void

// ─── Legacy types (kept for compatibility with stored project data) ───────────

export interface MovieData {
  title:        string
  url:          string
  category:     string
  year?:        string
  rating?:      string
  duration?:    string
  director?:    string
  cast?:        string
  description?: string
  poster?:      string
  videoUrl?:    string
  subtitles?:   string
}

export interface ScraperConfig {
  baseUrl:               string
  outputDir:             string
  headless:              boolean
  maxMoviesPerCategory?: number
  maxPagesPerCategory?:  number
  delayMs?:              number
  userAgent?:            string
  exportJson?:           boolean
  exportExcel?:          boolean
  exportCsv?:            boolean
  selectors?: {
    categories?: string
    movieList?:  string
    nextPage?:   string
    detail?: {
      title?:       string
      year?:        string
      rating?:      string
      duration?:    string
      director?:    string
      description?: string
      cast?:        string
      poster?:      string
    }
  }
}

export type ScraperProgress   = { step: 1 | 2 | 3; label: string; current: number; total: number; message: string }
export type ScraperResult     = { movies: MovieData[]; totalMovies: number; jsonPath?: string; excelPath?: string; csvPath?: string }
export type MovieBatchCallback = (movies: MovieData[]) => void
export type StartResult = WorkflowStartResult
