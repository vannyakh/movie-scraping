import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Sidebar from './Sidebar'
import { useIpcEvents } from '@/hooks/useIpcEvents'

export default function Layout() {
  useIpcEvents()

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0f1a]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: { background: '#12141e', border: '1px solid #1e2235', color: '#f1f5f9' },
        }}
      />
    </div>
  )
}
