import { createContext, useContext } from 'react'
import type { NodeExecStatus } from '../../../../lib/ipc'

// ─── Node Detail Context ──────────────────────────────────────────────────────
// Allows any node component to open the config panel for a given node ID.

export type OpenDetailFn = (nodeId: string, tab?: 'config' | 'preview') => void

export const NodeDetailContext = createContext<OpenDetailFn | null>(null)
export const NodeDetailProvider = NodeDetailContext.Provider

export function useOpenDetail(): OpenDetailFn | null {
  return useContext(NodeDetailContext)
}

// ─── Node Status Context ──────────────────────────────────────────────────────
// Provides real-time execution status for each node during a workflow run.

export const NodeStatusContext = createContext<Record<string, NodeExecStatus>>({})
export const NodeStatusProvider = NodeStatusContext.Provider

export function useNodeStatus(nodeId: string): NodeExecStatus | null {
  const map = useContext(NodeStatusContext)
  return map[nodeId] ?? null
}
