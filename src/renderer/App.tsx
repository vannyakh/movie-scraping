import '@xyflow/react/dist/style.css'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout         from '@/components/layout/Layout'
import Dashboard      from '@/pages/Dashboard'
import Projects       from '@/pages/Projects'
import ProjectCreate  from '@/pages/ProjectCreate'
import ProjectDetail  from '@/pages/ProjectDetail'
import ProgressPage   from '@/pages/ProgressPage'
import Results        from '@/pages/Results'
import HistoryPage    from '@/pages/History'
import Settings       from '@/pages/Settings'
import TaskJobs       from '@/pages/TaskJobs'

export default function App() {
  if (!window.electronAPI) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f1117] text-slate-400 text-sm">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div>Electron API unavailable.</div>
          <div className="text-xs mt-1 text-slate-500">Run the app with <code className="bg-[#21253a] px-1 rounded">pnpm dev</code></div>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        {/* Project detail is full-screen (no sidebar layout) */}
        <Route path="/projects/:id" element={<ProjectDetail />} />


        <Route element={<Layout />}>
          <Route index              element={<Dashboard />}     />
          <Route path="projects"    element={<Projects />}      />
          <Route path="projects/new" element={<ProjectCreate />} />
          <Route path="progress"    element={<ProgressPage />}  />
          <Route path="task-jobs"   element={<TaskJobs />}      />
          <Route path="results"     element={<Results />}       />
          <Route path="history"     element={<HistoryPage />}   />
          <Route path="settings"    element={<Settings />}      />
          {/* Legacy redirects */}
          <Route path="new"  element={<Navigate to="/projects/new" replace />} />
          <Route path="flow" element={<Navigate to="/projects"     replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
