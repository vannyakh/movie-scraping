import { useState, useMemo } from 'react'
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { PALETTE_GROUPS, PALETTE_NODES } from './nodes'
import { cn } from '@/lib/utils'

export function NodePalette() {
  const [query,    setQuery]    = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return PALETTE_NODES.filter(
      (n) => n.label.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q),
    )
  }, [query])

  const toggleGroup = (label: string) =>
    setCollapsed((s) => ({ ...s, [label]: !s[label] }))

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#12141e] border-r border-[#1e2235] overflow-hidden select-none">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="w-full bg-[#1a1d2e] border border-[#2a2e45] rounded-xl pl-8 pr-7 py-2 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/60 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {filtered ? (
          /* Search results */
          filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-[11px]">No matches</div>
          ) : (
            <div className="flex flex-col gap-1 pt-1">
              {filtered.map(({ type, label, icon: Icon, color, desc }) => (
                <PaletteItem key={type} type={type} label={label} icon={Icon} color={color} desc={desc} />
              ))}
            </div>
          )
        ) : (
          /* Grouped view */
          PALETTE_GROUPS.map(({ label: groupLabel, nodes }) => (
            <div key={groupLabel} className="mb-1">
              <button
                onClick={() => toggleGroup(groupLabel)}
                className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-[0.12em] hover:text-slate-400 transition-colors"
              >
                {collapsed[groupLabel]
                  ? <ChevronRight className="w-3 h-3" />
                  : <ChevronDown  className="w-3 h-3" />}
                {groupLabel}
              </button>
              {!collapsed[groupLabel] && (
                <div className="flex flex-col gap-0.5">
                  {nodes.map(({ type, label, icon: Icon, color, desc }) => (
                    <PaletteItem key={type} type={type} label={label} icon={Icon} color={color} desc={desc} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom tip */}
      <div className="shrink-0 px-3 py-2.5 border-t border-[#1e2235]">
        <p className="text-[9px] text-slate-700 leading-relaxed text-center">
          Drag onto canvas • Space = pan
        </p>
      </div>
    </aside>
  )
}

function PaletteItem({
  type, label, icon: Icon, color, desc,
}: { type: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string; desc: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/reactflow/type', type)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-grab active:cursor-grabbing',
        'border border-transparent',
        'hover:bg-[#1e2235] hover:border-[#2a2e45]',
        'active:scale-[0.97] transition-all duration-100',
      )}
    >
      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-3 h-3 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-300 truncate leading-tight">{label}</p>
        <p className="text-[9px] text-slate-600 truncate leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
