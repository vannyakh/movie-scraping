import { useNavigate, useParams } from 'react-router-dom'
import { useProjectStore } from '@/store/projectStore'
import { FlowCanvas } from '@/components/flow/FlowCanvas'
import type { Node, Edge } from '@xyflow/react'

export default function ProjectDetail() {
  const { id }          = useParams<{ id: string }>()
  const navigate        = useNavigate()
  const getProject      = useProjectStore(s => s.getProject)
  const getFirstWorkflow = useProjectStore(s => s.getFirstWorkflow)
  const updateWorkflow   = useProjectStore(s => s.updateWorkflow)

  const project  = id ? getProject(id) : null
  const workflow = id ? getFirstWorkflow(id) : null

  if (!project || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 text-slate-500">
        <p className="text-sm">Project not found.</p>
        <button
          onClick={() => navigate('/projects')}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  const handleSave = (nodes: Node[], edges: Edge[]) => {
    updateWorkflow(project.id, workflow.id, { nodes, edges })
  }

  return (
    <FlowCanvas
      projectId={project.id}
      projectName={project.name}
      workflowId={workflow.id}
      workflowName={workflow.name}
      initialNodes={workflow.nodes}
      initialEdges={workflow.edges}
      onSave={handleSave}
    />
  )
}
