import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from '@/components/layout/Layout'

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

function TrayQuickTaskBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!window.electronAPI) return

    return window.electronAPI.onTrayQuickTask((task) => {
      if (task === 'open-dashboard') navigate('/')
      if (task === 'open-projects') navigate('/projects')
      if (task === 'open-task-jobs') navigate('/task-jobs')
      if (task === 'open-settings') navigate('/settings')
    })
  }, [navigate])

  return null
}

export default function App() {
  return (
    <HashRouter>
      <TrayQuickTaskBridge />
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
