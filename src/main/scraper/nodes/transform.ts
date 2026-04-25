import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface TransformData {
  renames?:  Array<{ from: string; to: string }>
  omit?:     string
  computed?: Array<{ id: string; label: string; expression: string }>
}

export async function executeTransform(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as TransformData
  const renames  = (d.renames  ?? []).filter((r) => r.from.trim() && r.to.trim())
  const omitSet  = new Set((d.omit ?? '').split(',').map((s) => s.trim()).filter(Boolean))
  const computed = (d.computed ?? []).filter((c) => c.label.trim() && c.expression.trim())

  if (!renames.length && !omitSet.size && !computed.length) {
    ctx.onLog('transform: no operations — passing through')
    return inputs
  }

  const transformed = inputs.map((record) => {
    const out: DataRecord = { ...record }

    // Apply renames
    for (const r of renames) {
      if (r.from in out) {
        out[r.to] = out[r.from]
        delete out[r.from]
      }
    }

    // Apply omits
    for (const key of omitSet) {
      delete out[key]
    }

    // Apply computed fields
    for (const comp of computed) {
      try {
        // Simple expression eval with access to `record` variable
        // eslint-disable-next-line no-new-func
        const fn = new Function('record', `try { return (${comp.expression}) } catch(e) { return null }`)
        out[comp.id] = fn(out) as unknown
      } catch {
        out[comp.id] = null
      }
    }

    return out
  })

  ctx.onLog(`transform: ${transformed.length} records processed`)
  return transformed
}
