import { useState, useMemo } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type VisibilityState, type SortingState,
} from '@tanstack/react-table'
import { Search, ChevronLeft, ChevronRight, Download, Eye, EyeOff, ExternalLink, Database } from 'lucide-react'
import { useScrapingStore } from '@/store/scrapingStore'
import { downloadBlob, moviesToCsv, cn } from '@/lib/utils'
import type { MovieData } from '../../../src/lib/ipc'

const ALL_COLS: { key: keyof MovieData; label: string; width: number }[] = [
  { key: 'title',       label: 'Title',       width: 240 },
  { key: 'category',    label: 'Category',    width: 120 },
  { key: 'year',        label: 'Year',        width: 70  },
  { key: 'rating',      label: 'Rating',      width: 80  },
  { key: 'duration',    label: 'Duration',    width: 90  },
  { key: 'director',    label: 'Director',    width: 160 },
  { key: 'cast',        label: 'Cast',        width: 200 },
  { key: 'description', label: 'Description', width: 300 },
]

function truncate(s?: string, n = 60) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default function Results() {
  const { activeJob, history } = useScrapingStore()

  // Prefer active job movies, fall back to most recent history
  const movies: MovieData[] = useMemo(() => {
    if (activeJob && activeJob.movies.length > 0) return activeJob.movies
    const latest = history.find((h) => h.movies.length > 0)
    return latest?.movies ?? []
  }, [activeJob, history])

  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting]           = useState<SortingState>([])
  const [colVis, setColVis]             = useState<VisibilityState>({})
  const [showColMenu, setShowColMenu]   = useState(false)
  const [selectedRow, setSelectedRow]   = useState<MovieData | null>(null)

  const columns = useMemo<ColumnDef<MovieData>[]>(() => [
    ...ALL_COLS.map(({ key, label, width }) => ({
      accessorKey: key,
      header: label,
      size: width,
      cell: (info: { getValue: () => unknown }) => (
        <span className="text-sm text-slate-300">{truncate(info.getValue() as string, key === 'description' ? 80 : 60)}</span>
      ),
    })),
    {
      id: 'actions',
      header: '',
      size: 40,
      cell: ({ row }: { row: { original: MovieData } }) => (
        <button
          onClick={(e) => { e.stopPropagation(); window.open(row.original.url, '_blank') }}
          className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ], [])

  const table = useReactTable({
    data: movies,
    columns,
    state:    { globalFilter, sorting, columnVisibility: colVis },
    onGlobalFilterChange:    setGlobalFilter,
    onSortingChange:         setSorting,
    onColumnVisibilityChange: setColVis,
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState:          { pagination: { pageSize: 25 } },
  })

  const exportCsv = () => {
    if (!movies.length) return
    downloadBlob(moviesToCsv(movies as unknown as { [k: string]: unknown }[]), 'movies.csv', 'text/csv')
  }

  const exportJson = () => {
    if (!movies.length) return
    downloadBlob(JSON.stringify(movies, null, 2), 'movies.json', 'application/json')
  }

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Database className="w-12 h-12 mb-4 opacity-30" />
        <div className="text-base font-medium mb-1">No data yet</div>
        <div className="text-sm">Start a scraping job to populate results</div>
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
            placeholder={`Search ${movies.length.toLocaleString()} movies…`}
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
            <div className="absolute right-0 top-full mt-1 bg-[#1a1d27] border border-[#2e3350] rounded-lg p-2 z-10 w-40 shadow-xl">
              {table.getAllLeafColumns().filter(c => c.id !== 'actions').map((col) => (
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
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-[#2e3350] whitespace-nowrap cursor-pointer select-none hover:text-slate-200"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => setSelectedRow(row.original)}
                className="border-b border-[#1e2235] hover:bg-[#1a1d27] transition-colors cursor-pointer"
              >
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
          {table.getFilteredRowModel().rows.length.toLocaleString()} rows
          {globalFilter ? ` (filtered from ${movies.length.toLocaleString()})` : ''}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#21253a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 px-2">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#21253a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="bg-[#1a1d27] border border-[#2e3350] text-slate-300 text-xs rounded px-2 py-1 outline-none"
        >
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {/* Row detail modal */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setSelectedRow(null)}>
          <div className="bg-[#1a1d27] border border-[#2e3350] rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base font-bold text-slate-100 pr-4">{selectedRow.title}</h2>
              <button onClick={() => setSelectedRow(null)} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['category','year','rating','duration','director'] as (keyof MovieData)[]).map(k => selectedRow[k] ? (
                <div key={k}>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{k}</div>
                  <div className="text-sm text-slate-200">{selectedRow[k]}</div>
                </div>
              ) : null)}
            </div>
            {selectedRow.cast && <div className="mb-3"><div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Cast</div><div className="text-sm text-slate-300">{selectedRow.cast}</div></div>}
            {selectedRow.description && <div className="mb-4"><div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Description</div><div className="text-sm text-slate-300 leading-relaxed">{selectedRow.description}</div></div>}
            <a href={selectedRow.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 truncate">
              <ExternalLink className="w-3 h-3 shrink-0" />{selectedRow.url}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
