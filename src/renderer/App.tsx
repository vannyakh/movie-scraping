import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from '@/components/layout/Layout'

// Code-split each page so the initial bundle is as small as possible.
// The flow canvas (ReactFlow + DnD + heavy deps) only loads when needed.
const Dashboard     = lazy(() => import('@/pages/Dashboard'))
const Projects      = lazy(() => import('@/pages/Projects'))
const ProjectCreate = lazy(() => import('@/pages/ProjectCreate'))
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'))
const TaskJobs      = lazy(() => import('@/pages/TaskJobs'))
const Results       = lazy(() => import('@/pages/Results'))
const History       = lazy(() => import('@/pages/History'))
const ProgressPage  = lazy(() => import('@/pages/ProgressPage'))
const Settings      = lazy(() => import('@/pages/Settings'))

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Full-screen flow builder — no sidebar chrome */}
          <Route path="/projects/:id" element={<ProjectDetail />} />

          {/* App shell with sidebar */}
          <Route element={<Layout />}>
            <Route index           element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<ProjectCreate />} />
            <Route path="task-jobs"    element={<TaskJobs />} />
            <Route path="progress"     element={<ProgressPage />} />
            <Route path="results"      element={<Results />} />
            <Route path="history"      element={<History />} />
            <Route path="settings"     element={<Settings />} />

            {/* Legacy redirects */}
            <Route path="new"  element={<Navigate to="/projects/new" replace />} />
            <Route path="flow" element={<Navigate to="/projects"     replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
