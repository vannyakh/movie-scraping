import { HelpCircle } from 'lucide-react'
import { PALETTE_GROUPS } from './nodes'

export function NodePalette() {
  return (
    <aside className="w-52 shrink-0 flex flex-col bg-[#13151f] border-r border-[#2e3350] overflow-y-auto">
      <div className="p-3 border-b border-[#2e3350]">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nodes</p>
        <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">Drag onto canvas</p>
      </div>

      <div className="flex flex-col gap-0.5 p-2 flex-1">
        {PALETTE_GROUPS.map(({ label, nodes }) => (
          <div key={label} className="mb-2">
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1 mb-1.5">{label}</p>
            {nodes.map(({ type, label: nodeLabel, icon: Icon, color, desc }) => (
              <div
                key={type}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/reactflow/type', type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1d27] border border-[#2e3350] cursor-grab active:cursor-grabbing hover:border-[#3d4470] hover:bg-[#1e2133] transition-all select-none group mb-1"
              >
                <div className={`w-5 h-5 rounded ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-300 leading-tight group-hover:text-slate-100 transition-colors truncate">
                    {nodeLabel}
                  </p>
                  <p className="text-[9px] text-slate-600 leading-tight mt-0.5 truncate">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="p-2.5 border-t border-[#2e3350]">
        <div className="rounded-lg bg-indigo-600/8 border border-indigo-500/15 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Tips</p>
          </div>
          <ul className="text-[9px] text-indigo-200/60 space-y-0.5 leading-relaxed">
            <li>• Drag nodes onto canvas</li>
            <li>• Hover → Setup / Preview</li>
            <li>• Hover edge → × to delete</li>
            <li>• Delete key removes selected</li>
            <li>• Space bar = pan mode</li>
          </ul>
        </div>
      </div>
    </aside>
  )
}
