import { promises as fs } from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import type { LogCallback, MovieData, ScraperConfig, ScraperResult } from '@shared/ipc-types'

function toCsv(movies: MovieData[]): string {
  const headers = ['Title','Category','Year','Rating','Duration','Director','Cast','Description','URL','Poster','VideoURL','Subtitles']
  const esc     = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows    = movies.map((m) =>
    [m.title,m.category,m.year,m.rating,m.duration,m.director,m.cast,m.description,m.url,m.poster,m.videoUrl,m.subtitles].map(esc).join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

export async function saveResults(
  movies: MovieData[], config: ScraperConfig, onLog: LogCallback,
): Promise<ScraperResult> {
  const { outputDir, exportJson = true, exportExcel = true, exportCsv = true } = config
  await fs.mkdir(outputDir, { recursive: true })
  const stamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const result: ScraperResult = { totalMovies: movies.length, movies }

  if (exportJson) {
    result.jsonPath = path.join(outputDir, `movies-${stamp}.json`)
    await fs.writeFile(result.jsonPath, JSON.stringify(movies, null, 2), 'utf-8')
    onLog(`✓ JSON  → ${result.jsonPath}`)
  }
  if (exportCsv) {
    result.csvPath = path.join(outputDir, `movies-${stamp}.csv`)
    await fs.writeFile(result.csvPath, toCsv(movies), 'utf-8')
    onLog(`✓ CSV   → ${result.csvPath}`)
  }
  if (exportExcel) {
    result.excelPath = path.join(outputDir, `movies-${stamp}.xlsx`)
    const wb    = new ExcelJS.Workbook()
    wb.creator  = 'MovieScraping'; wb.created = new Date()
    const sheet = wb.addWorksheet('Movies')
    sheet.columns = [
      { header: 'Title',       key: 'title',       width: 42 },
      { header: 'Category',    key: 'category',    width: 20 },
      { header: 'Year',        key: 'year',        width: 8  },
      { header: 'Rating',      key: 'rating',      width: 10 },
      { header: 'Duration',    key: 'duration',    width: 12 },
      { header: 'Director',    key: 'director',    width: 26 },
      { header: 'Cast',        key: 'cast',        width: 52 },
      { header: 'Description', key: 'description', width: 80 },
      { header: 'URL',         key: 'url',         width: 60 },
      { header: 'Poster',      key: 'poster',      width: 60 },
      { header: 'Video URL',   key: 'videoUrl',    width: 80 },
      { header: 'Subtitles',   key: 'subtitles',   width: 40 },
    ]
    const hRow = sheet.getRow(1)
    hRow.font  = { bold: true, color: { argb: 'FFFFFFFF' } }
    hRow.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1f2937' } }
    for (const m of movies) sheet.addRow(m)
    await wb.xlsx.writeFile(result.excelPath)
    onLog(`✓ Excel → ${result.excelPath}`)
  }
  return result
}
