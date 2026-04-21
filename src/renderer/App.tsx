import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout       from '@/components/layout/Layout'
import Dashboard    from '@/pages/Dashboard'
import NewScraping  from '@/pages/NewScraping'
import ProgressPage from '@/pages/ProgressPage'
import Results      from '@/pages/Results'
import HistoryPage  from '@/pages/History'
import Settings     from '@/pages/Settings'
import FlowBuilder  from '@/pages/FlowBuilder'

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
        <Route element={<Layout />}>
          <Route index         element={<Dashboard />}    />
          <Route path="new"      element={<NewScraping />}  />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="results"  element={<Results />}      />
          <Route path="history"  element={<HistoryPage />}  />
          <Route path="settings" element={<Settings />}     />
          <Route path="flow"     element={<FlowBuilder />}  />
        </Route>
      </Routes>
    </HashRouter>
  )
}
