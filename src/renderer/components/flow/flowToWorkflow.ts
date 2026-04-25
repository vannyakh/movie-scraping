import type { Node, Edge } from '@xyflow/react'
import type { WorkflowConfig } from '../../../lib/ipc'

const INPUT_TYPES  = new Set(['browser-source', 'http-source', 'api-source'])
const OUTPUT_TYPES = new Set(['file-export', 'webhook'])

/** Convert the React Flow graph into a WorkflowConfig for the main-process engine. */
export function flowToWorkflow(
  nodes: Node[],
  edges: Edge[],
  workflowId: string,
  projectId?: string,
): WorkflowConfig | null {
  const hasInput  = nodes.some((n) => INPUT_TYPES.has(n.type ?? ''))
  const hasOutput = nodes.some((n) => OUTPUT_TYPES.has(n.type ?? ''))
  if (!hasInput || !hasOutput) return null

  const sourceNode = nodes.find((n) => INPUT_TYPES.has(n.type ?? ''))
  const sourceUrl  = (sourceNode?.data as { url?: string })?.url
  if (!sourceUrl?.trim()) return null

  const exportNode = nodes.find((n) => n.type === 'file-export')
  if (exportNode && !(exportNode.data as { outputDir?: string }).outputDir?.trim()) return null

  return {
    workflowId,
    projectId,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type!, data: n.data as Record<string, unknown> })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  }
}

/** Returns true when the graph has the minimum config to run. */
export function isFlowValid(nodes: Node[], edges: Edge[]): boolean {
  return flowToWorkflow(nodes, edges, 'check') !== null
}
