/** Shared between main (scraper), preload typings, and renderer `ipc.ts`. */

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

export interface ScraperProgress {
  step:    1 | 2 | 3
  label:   string
  current: number
  total:   number
  message: string
}

export interface ScraperResult {
  jsonPath?:   string
  excelPath?:  string
  csvPath?:    string
  totalMovies: number
  movies:      MovieData[]
}

export type ProgressCallback   = (p: ScraperProgress) => void
export type LogCallback        = (msg: string) => void
export type MovieBatchCallback = (movies: MovieData[]) => void

export type StartResult =
  | ({ success: true } & ScraperResult)
  | { success: false; error: string }
