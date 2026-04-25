import fs   from 'node:fs'
import path from 'node:path'
import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface FileExportData {
  outputDir?:   string
  exportJson?:  boolean
  exportExcel?: boolean
  exportCsv?:   boolean
  filename?:    string
}

function recordsToCsv(records: DataRecord[]): string {
  if (!records.length) return ''
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r)))).filter((k) => !k.startsWith('_'))
  const escape = (v: unknown) => {
    const s = v != null ? String(v) : ''
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const rows = [
    keys.join(','),
    ...records.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ]
  return rows.join('\n')
}

export async function executeFileExport(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as FileExportData

  if (!inputs.length) { ctx.onLog('file-export: no records to export'); return [] }

  const outputDir = d.outputDir?.trim()
  if (!outputDir) {
    ctx.onLog('file-export: no output directory configured — skipping write')
    return [{ _outputPaths: {}, _skipped: true, _reason: 'no outputDir' }]
  }

  const baseFilename = (d.filename?.trim() || 'output') + '_' + new Date().toISOString().split('T')[0]

  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  } catch (err) {
    ctx.onLog(`file-export: could not create directory ${outputDir}: ${err}`)
    throw err
  }

  // Filter out internal fields
  const exportRecords = inputs.map((r) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) {
      if (!k.startsWith('_')) out[k] = v
    }
    return out
  })

  const outputPaths: Record<string, string> = {}

  if (d.exportJson !== false && (d.exportJson || true)) {
    const filePath = path.join(outputDir, `${baseFilename}.json`)
    fs.writeFileSync(filePath, JSON.stringify(exportRecords, null, 2), 'utf-8')
    outputPaths['json'] = filePath
    ctx.onLog(`file-export: wrote ${filePath}`)
  }

  if (d.exportCsv) {
    const filePath = path.join(outputDir, `${baseFilename}.csv`)
    fs.writeFileSync(filePath, recordsToCsv(exportRecords as DataRecord[]), 'utf-8')
    outputPaths['csv'] = filePath
    ctx.onLog(`file-export: wrote ${filePath}`)
  }

  if (d.exportExcel) {
    try {
      const ExcelJS = await import('exceljs')
      const wb  = new ExcelJS.default.Workbook()
      const ws  = wb.addWorksheet('Data')
      const keys = Array.from(new Set(exportRecords.flatMap((r) => Object.keys(r))))
      ws.columns = keys.map((k) => ({ header: k, key: k, width: 20 }))
      exportRecords.forEach((r) => ws.addRow(r as Record<string, unknown>))
      const filePath = path.join(outputDir, `${baseFilename}.xlsx`)
      await wb.xlsx.writeFile(filePath)
      outputPaths['xlsx'] = filePath
      ctx.onLog(`file-export: wrote ${filePath}`)
    } catch (err) {
      ctx.onLog(`file-export: Excel export failed: ${err}`)
    }
  }

  ctx.onLog(`file-export: done. Exported ${exportRecords.length} records.`)
  ctx.onProgress(1, 1, 1, 1, `Exported ${exportRecords.length} records`)

  return [{ _outputPaths: outputPaths, _count: exportRecords.length }]
}
