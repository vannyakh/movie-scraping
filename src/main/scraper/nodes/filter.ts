import type { DataRecord } from '@shared/ipc-types'
import type { EngineContext } from '../engine'

interface Condition { id: string; field: string; operator: string; value: string }
interface FilterData { conditions?: Condition[]; logic?: 'AND' | 'OR' }

function evaluate(record: DataRecord, cond: Condition): boolean {
  const val = record[cond.field]
  const str = val != null ? String(val) : ''
  const cv  = cond.value

  switch (cond.operator) {
    case 'exists':      return val != null && val !== ''
    case 'notExists':   return val == null || val === ''
    case 'equals':      return str === cv
    case 'notEquals':   return str !== cv
    case 'contains':    return str.toLowerCase().includes(cv.toLowerCase())
    case 'startsWith':  return str.startsWith(cv)
    case 'endsWith':    return str.endsWith(cv)
    case 'gt':          return Number(val) > Number(cv)
    case 'lt':          return Number(val) < Number(cv)
    case 'gte':         return Number(val) >= Number(cv)
    case 'lte':         return Number(val) <= Number(cv)
    default:            return true
  }
}

export async function executeFilter(
  config: Record<string, unknown>,
  inputs: DataRecord[],
  ctx: EngineContext,
): Promise<DataRecord[]> {
  const d = config as FilterData
  const conditions = (d.conditions ?? []).filter((c) => c.field.trim())
  const logic      = d.logic ?? 'AND'

  if (!conditions.length) { ctx.onLog('filter: no conditions — passing through'); return inputs }

  const filtered = inputs.filter((record) =>
    logic === 'AND'
      ? conditions.every((c) => evaluate(record, c))
      : conditions.some((c) => evaluate(record, c)),
  )

  ctx.onLog(`filter: ${inputs.length} → ${filtered.length} records (${logic})`)
  return filtered
}
