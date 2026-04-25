import { Panel } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FlowControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const btn = cn(
    'w-8 h-8 flex items-center justify-center rounded-xl',
    'bg-[#12141e]/90 backdrop-blur-sm border border-[#1e2235]',
    'text-slate-500 hover:text-slate-100 hover:border-[#3a3e55] hover:bg-[#1a1d2e]',
    'transition-all duration-150 shadow-sm',
  )

  return (
    <Panel position="bottom-left" className="flex flex-col gap-1 ml-3 mb-3">
      <button onClick={() => fitView({ padding: 0.15, duration: 350 })} className={btn} title="Fit view (F)">
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => zoomIn({ duration: 200 })} className={btn} title="Zoom in (+)">
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => zoomOut({ duration: 200 })} className={btn} title="Zoom out (-)">
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
    </Panel>
  )
}
