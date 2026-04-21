/**
 * Legacy standalone Flow Builder page.
 * Accessible via the /flow route (redirected to /projects in App.tsx).
 * Kept as a thin wrapper so the file still resolves during builds.
 */
import { FlowCanvas } from '@/components/flow/FlowCanvas'

export default function FlowBuilder() {
  return <FlowCanvas />
}
