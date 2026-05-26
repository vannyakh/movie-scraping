import { useState, useMemo } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type VisibilityState, type SortingState,
} from '@tanstack/react-table'
import { Search, ChevronLeft, ChevronRight, Download, Eye, Database } from 'lucide-react'
import { useJobStore } from '@/store/jobStore'
import { downloadBlob } from '@/lib/utils'
import type { DataRecord } from '../../lib/ipc'

function truncate(s?: unknown, n = 60) {
  const str = typeof s === 'string' ? s : s != null ? JSON.stringify(s) : ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

export default function Results() {
  const { activeJob, history } = useJobStore()

  const records: DataRecord[] = useMemo(() => {
    if (activeJob && activeJob.records.length > 0) return activeJob.records
    const latest = history.find((h) => h.status === 'done')
    return latest ? [] : []
  }, [activeJob, history])

  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting]           = useState<SortingState>([])
  const [colVis, setColVis]             = useState<VisibilityState>({})
  const [showColMenu, setShowColMenu]   = useState(false)
  const [selectedRow, setSelectedRow]   = useState<DataRecord | null>(null)

  // Derive columns dynamically from the data
  const allKeys = useMemo(() => {
    const keys = new Set<string>()
    records.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)))
    return Array.from(keys).filter((k) => !k.startsWith('_'))
  }, [records])

  const columns = useMemo<ColumnDef<DataRecord>[]>(() => [
    ...allKeys.map((key) => ({
      accessorKey: key,
      header: key.charAt(0).toUpperCase() + key.slice(1),
      size: 180,
      cell: ({ getValue }: { getValue: () => unknown }) => (
        <span className="text-sm text-slate-300">{truncate(getValue())}</span>
      ),
    })),
  ], [allKeys])

  const table = useReactTable({
    data: records,
    columns,
    state:    { globalFilter, sorting, columnVisibility: colVis },
    onGlobalFilterChange:     setGlobalFilter,
    onSortingChange:          setSorting,
    onColumnVisibilityChange: setColVis,
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState:          { pagination: { pageSize: 25 } },
  })

  const exportCsv = () => {
    if (!records.length) return
    const keys = allKeys
    const rows = [
      keys.join(','),
      ...records.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(',')),
    ].join('\n')
    downloadBlob(rows, 'results.csv', 'text/csv')
  }

  const exportJson = () => {
    if (!records.length) return
    downloadBlob(JSON.stringify(records, null, 2), 'results.json', 'application/json')
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Database className="w-12 h-12 mb-4 opacity-30" />
        <div className="text-base font-medium mb-1">No results yet</div>
        <div className="text-sm">Run a workflow to see extracted data here</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-5 pb-3 border-b border-[#2e3350] shrink-0">
        <h1 className="text-lg font-bold text-slate-100 mr-2">Results</h1>
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={`Search ${records.length.toLocaleString()} records…`}
            className="w-full pl-8 pr-3 py-1.5 bg-[#0f1117] border border-[#2e3350] rounded-lg text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Column visibility */}
        <div className="relative">
          <button
            onClick={() => setShowColMenu(!showColMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d27] border border-[#2e3350] text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Columns
          </button>
          {showColMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1d27] border border-[#2e3350] rounded-lg p-2 z-10 w-48 shadow-xl max-h-64 overflow-y-auto">
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#21253a] rounded cursor-pointer">
                  <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} className="accent-indigo-500" />
                  <span className="text-sm text-slate-300">{(col.columnDef as { header?: string }).header ?? col.id}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d27] border border-[#2e3350] text-slate-300 hover:text-white rounded-lg text-sm transition-colors">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <button onClick={exportJson} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d27] border border-[#2e3350] text-slate-300 hover:text-white rounded-lg text-sm transition-colors">
          <Download className="w-3.5 h-3.5" /> JSON
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#13151f] z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} style={{ width: header.getSize() }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-[#2e3350] whitespace-nowrap cursor-pointer select-none hover:text-slate-200"
                    onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} onClick={() => setSelectedRow(row.original)}
                className="border-b border-[#1e2235] hover:bg-[#1a1d27] transition-colors cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5 max-w-[300px] overflow-hidden">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-[#2e3350] shrink-0 bg-[#13151f]">
        <span className="text-xs text-slate-400">
          {table.getFilteredRowModel().rows.length.toLocaleString()} records
          {globalFilter ? ` (filtered from ${records.length.toLocaleString()})` : ''}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#21253a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 px-2">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#21253a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <select value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="bg-[#1a1d27] border border-[#2e3350] text-slate-300 text-xs rounded px-2 py-1 outline-none">
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {/* Row detail modal */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setSelectedRow(null)}>
          <div className="bg-[#1a1d27] border border-[#2e3350] rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base font-bold text-slate-100 pr-4">Record Detail</h2>
              <button onClick={() => setSelectedRow(null)} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3">
              {Object.entries(selectedRow)
                .filter(([k]) => !k.startsWith('_'))
                .map(([key, val]) => (
                  <div key={key}>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{key}</div>
                    <div className="text-sm text-slate-200 break-all">
                      {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '')}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
