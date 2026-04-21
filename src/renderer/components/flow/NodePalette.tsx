import { HelpCircle } from 'lucide-react'
import { PALETTE_NODES } from './nodes'

export function NodePalette() {
  return (
    <aside className="w-48 shrink-0 flex flex-col bg-[#13151f] border-r border-[#2e3350] overflow-y-auto">
      <div className="p-3 border-b border-[#2e3350]">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nodes</p>
        <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">Drag onto canvas</p>
      </div>

      <div className="flex flex-col gap-1.5 p-2">
        {PALETTE_NODES.map(({ type, label, icon: Icon, color, desc }) => (
          <div
            key={type}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('application/reactflow/type', type)
              e.dataTransfer.effectAllowed = 'move'
            }}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-[#1a1d27] border border-[#2e3350] cursor-grab active:cursor-grabbing hover:border-[#3d4470] hover:bg-[#1e2133] transition-all select-none group"
          >
            <div className={`w-6 h-6 rounded-md ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-3 h-3 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-300 leading-tight group-hover:text-slate-100 transition-colors">
                {label}
              </p>
              <p className="text-[9px] text-slate-600 leading-tight mt-0.5 truncate">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto p-2.5 border-t border-[#2e3350]">
        <div className="rounded-lg bg-indigo-600/8 border border-indigo-500/15 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Tips</p>
          </div>
          <ul className="text-[9px] text-indigo-200/60 space-y-0.5 leading-relaxed">
            <li>• Drag nodes to canvas</li>
            <li>• Hover → Setup / Preview</li>
            <li>• Hover edge → × to remove</li>
            <li>• Delete key removes selected</li>
          </ul>
        </div>
      </div>
    </aside>
  )
}
