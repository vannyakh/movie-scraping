import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'

export interface FlowSnapshot { nodes: Node[]; edges: Edge[] }

const MAX_HISTORY = 60

/**
 * Undo/redo history for a React Flow canvas.
 * Stores snapshots in refs to avoid triggering re-renders on push.
 */
export function useFlowHistory() {
  const past   = useRef<FlowSnapshot[]>([])
  const future = useRef<FlowSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncFlags = () => {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  const push = useCallback((snap: FlowSnapshot) => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), snap]
    future.current = []
    syncFlags()
  }, [])

  const undo = useCallback((current: FlowSnapshot, restore: (s: FlowSnapshot) => void) => {
    const prev = past.current[past.current.length - 1]
    if (!prev) return
    future.current = [current, ...future.current.slice(0, MAX_HISTORY - 1)]
    past.current   = past.current.slice(0, -1)
    restore(prev)
    syncFlags()
  }, [])

  const redo = useCallback((current: FlowSnapshot, restore: (s: FlowSnapshot) => void) => {
    const next = future.current[0]
    if (!next) return
    past.current   = [...past.current.slice(-(MAX_HISTORY - 1)), current]
    future.current = future.current.slice(1)
    restore(next)
    syncFlags()
  }, [])

  return { push, undo, redo, canUndo, canRedo }
}
