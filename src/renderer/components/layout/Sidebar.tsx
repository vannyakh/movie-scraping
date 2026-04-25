import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, Activity, Database,
  History, Settings, Workflow, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJobStore } from '@/store/jobStore'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects'  },
  { to: '/task-jobs', icon: Activity,        label: 'Jobs'      },
  { to: '/results',   icon: Database,        label: 'Results'   },
  { to: '/history',   icon: History,         label: 'History'   },
]

export default function Sidebar() {
  const activeJob = useJobStore((s) => s.activeJob)
  const navigate  = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const isRunning = activeJob?.status === 'running' || activeJob?.status === 'paused'

  return (
    <aside
      className={cn(
        'shrink-0 flex flex-col h-screen bg-[#13151f] border-r border-[#2e3350] select-none transition-all duration-300 overflow-hidden',
        collapsed ? 'w-[64px]' : 'w-[220px]',
      )}
    >
      {/* Logo + toggle */}
      <div className="flex items-center px-3 py-5 gap-2">
        <div
          className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <Workflow className="w-4 h-4 text-white" />
        </div>

        {!collapsed && (
          <span
            className="font-bold text-[15px] text-slate-100 tracking-tight flex-1 cursor-pointer truncate"
            onClick={() => navigate('/')}
          >
            DataFlow
          </span>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'ml-auto shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors',
            collapsed && 'mx-auto ml-0',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen  className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      <div className="mx-3 h-px bg-[#2e3350]" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => {
          const showDot = to === '/task-jobs' && isRunning
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive: navActive }) =>
                cn(
                  'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all group',
                  collapsed && 'justify-center',
                  navActive
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
                )
              }
            >
              {({ isActive: navActive }) => (
                <>
                  <Icon className={cn('w-4 h-4 shrink-0', navActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{label}</span>
                      {showDot && (
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      )}
                      {navActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                    </>
                  )}
                  {collapsed && showDot && (
                    <span className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Active job status pill */}
      {isRunning && activeJob && !collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-lg bg-[#1a1d27] border border-[#2e3350]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            <div className="text-xs text-slate-400 font-medium truncate">
              {activeJob.workflowName ?? 'Running job'}
            </div>
          </div>
          <div className="text-xs text-slate-500 truncate">
            {activeJob.progress?.message ?? 'Initializing…'}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#2e3350] rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{
                  width: activeJob.progress
                    ? `${Math.round((activeJob.progress.current / Math.max(activeJob.progress.total, 1)) * 100)}%`
                    : '0%',
                }}
              />
            </div>
            <span className="text-xs text-indigo-400 font-mono w-8 text-right">
              {activeJob.records.length}
            </span>
          </div>
        </div>
      )}

      {isRunning && activeJob && collapsed && (
        <div className="mx-auto mb-3 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1d27] border border-[#2e3350]">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
      )}

      {/* Settings */}
      <div className="mx-2 mb-4">
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all',
              collapsed && 'justify-center',
              isActive
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
            )
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  )
}
