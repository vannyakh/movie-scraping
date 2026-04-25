import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'

import Dashboard     from '@/pages/Dashboard'
import Projects      from '@/pages/Projects'
import ProjectCreate from '@/pages/ProjectCreate'
import ProjectDetail from '@/pages/ProjectDetail'
import TaskJobs      from '@/pages/TaskJobs'
import Results       from '@/pages/Results'
import History       from '@/pages/History'
import ProgressPage  from '@/pages/ProgressPage'
import Settings      from '@/pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Full-screen flow builder (no sidebar) */}
        <Route path="/projects/:id" element={<ProjectDetail />} />

        {/* Main layout with sidebar */}
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects"      element={<Projects />} />
          <Route path="projects/new"  element={<ProjectCreate />} />
          <Route path="task-jobs"     element={<TaskJobs />} />
          <Route path="progress"      element={<ProgressPage />} />
          <Route path="results"       element={<Results />} />
          <Route path="history"       element={<History />} />
          <Route path="settings"      element={<Settings />} />

          {/* Legacy redirects */}
          <Route path="new"  element={<Navigate to="/projects/new" replace />} />
          <Route path="flow" element={<Navigate to="/projects"     replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
