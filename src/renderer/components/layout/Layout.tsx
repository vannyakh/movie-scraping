import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Sidebar from './Sidebar'
import { useJobStore } from '@/store/jobStore'

export default function Layout() {
  const store = useJobStore()

  /* Wire up all IPC push events once at the layout level */
  useEffect(() => {
    if (!window.electronAPI) return

    const offs = [
      window.electronAPI.onProgress((p)    => store.updateProgress(p)),
      window.electronAPI.onLog((msg)        => store.appendLog(msg)),
      window.electronAPI.onBatch((records)  => store.appendRecords(records)),
      window.electronAPI.onComplete((result) => store.completeJob(result)),
      window.electronAPI.onError((err)      => store.failJob(err)),
      window.electronAPI.onNodeStatus((s)   => store.updateNodeStatus(s)),
    ]

    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f1117]">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: { background: '#21253a', border: '1px solid #2e3350', color: '#f1f5f9' },
        }}
      />
    </div>
  )
}
