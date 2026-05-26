import { memo, useState } from 'react'
import { useReactFlow, BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'

export const CustomEdge = memo(function CustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [hovered, setHovered] = useState(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.4,
  })

  const isActive = hovered || selected
  const color    = selected ? '#818cf8' : hovered ? '#a5b4fc' : '#6366f1'

  return (
    <>
      {/* Glow layer (active only) */}
      {isActive && (
        <BaseEdge
          path={edgePath}
          style={{ stroke: color, strokeWidth: 8, opacity: 0.15, filter: 'blur(4px)' }}
        />
      )}

      {/* Main path */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke:      color,
          strokeWidth: isActive ? 2.5 : 1.5,
          transition:  'stroke 0.2s, stroke-width 0.2s',
          opacity:     0.9,
        }}
      />

      {/* Wide invisible hit area for hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Delete button */}
      <EdgeLabelRenderer>
        <div
          style={{
            position:  'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity:    isActive ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            onClick={() => deleteElements({ edges: [{ id }] })}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-[#12141e] border border-red-500/60 text-red-400 hover:bg-red-950 hover:border-red-400 shadow-lg transition-all"
            title="Delete connection"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
})
