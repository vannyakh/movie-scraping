import { useEffect } from 'react'
import { useJobStore } from '@/store/jobStore'

/**
 * Subscribes to all IPC push events from the main process and wires them
 * into the job store. Should be mounted once at a high-level layout component.
 */
export function useIpcEvents() {
  const store = useJobStore()

  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribers = [
      window.electronAPI.onProgress((p)    => store.updateProgress(p)),
      window.electronAPI.onLog((msg)        => store.appendLog(msg)),
      window.electronAPI.onBatch((records)  => store.appendRecords(records)),
      window.electronAPI.onComplete((r)     => store.completeJob(r)),
      window.electronAPI.onError((err)      => store.failJob(err)),
      window.electronAPI.onNodeStatus((s)   => store.updateNodeStatus(s)),
    ]

    return () => unsubscribers.forEach((off) => off())
    // store reference is stable; re-subscribing on store change would be wrong
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
