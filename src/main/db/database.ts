import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import type { Database as SqlJsDatabase } from 'sql.js'

const require = createRequire(import.meta.url)

let db: SqlJsDatabase | null = null
let initDb: Promise<SqlJsDatabase> | null = null

let persistChain = Promise.resolve()

function wasmBinaryPath(): string {
  // sql.js "exports" blocks `sql.js/package.json`; `./dist/*` is exported.
  return require.resolve('sql.js/dist/sql-wasm.wasm')
}

export function sqliteFilePath(): string {
  return path.join(app.getPath('userData'), 'movie-scraping.sqlite')
}

export function flushPersist(): Promise<void> {
  persistChain = persistChain.then(() => {
    if (!db) return
    const file = sqliteFilePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const data = db.export()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, Buffer.from(data))
    fs.renameSync(tmp, file)
  })
  return persistChain
}

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db
  if (!initDb) {
    initDb = (async () => {
      const initSqlJs = (await import('sql.js')).default
      const wasmFile = fs.readFileSync(wasmBinaryPath())
      const wasmBinary = wasmFile.buffer.slice(
        wasmFile.byteOffset,
        wasmFile.byteOffset + wasmFile.byteLength,
      )
      const SQL = await initSqlJs({ wasmBinary })
      const file = sqliteFilePath()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      let instance: SqlJsDatabase
      if (fs.existsSync(file) && fs.statSync(file).size > 0) {
        const raw = fs.readFileSync(file)
        instance = new SQL.Database(Uint8Array.from(raw))
      } else {
        instance = new SQL.Database()
      }
      instance.run(`
        CREATE TABLE IF NOT EXISTS persist_kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        )
      `)
      db = instance
      return instance
    })()
  }
  return initDb
}

export async function closeDatabase(): Promise<void> {
  await flushPersist()
  db?.close()
  db = null
  initDb = null
}
