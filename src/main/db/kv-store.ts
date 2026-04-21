import { flushPersist, getDatabase } from './database'

export async function kvGet(key: string): Promise<string | null> {
  const database = await getDatabase()
  const stmt = database.prepare('SELECT value FROM persist_kv WHERE key = ?')
  stmt.bind([key])
  const has = stmt.step()
  let out: string | null = null
  if (has) {
    const row = stmt.get() as unknown[]
    const v = row[0]
    out = typeof v === 'string' ? v : v != null ? String(v) : null
  }
  stmt.free()
  return out
}

export async function kvSet(key: string, value: string): Promise<void> {
  const database = await getDatabase()
  database.run('INSERT OR REPLACE INTO persist_kv (key, value) VALUES (?, ?)', [key, value])
  await flushPersist()
}

export async function kvRemove(key: string): Promise<void> {
  const database = await getDatabase()
  database.run('DELETE FROM persist_kv WHERE key = ?', [key])
  await flushPersist()
}
