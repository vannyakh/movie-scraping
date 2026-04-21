import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function findWindowsSignTool() {
  const base = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const kitsBin = join(base, 'Windows Kits', '10', 'bin')
  if (!existsSync(kitsBin)) return null
  let versions = []
  try {
    versions = readdirSync(kitsBin, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d+\.\d+\.\d+/u.test(d.name))
      .map((d) => d.name)
  } catch {
    return null
  }
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  for (const ver of versions) {
    const candidate = join(kitsBin, ver, process.arch === 'ia32' ? 'x86' : 'x64', 'signtool.exe')
    if (existsSync(candidate)) return candidate
  }
  return null
}

if (process.platform === 'win32' && !process.env.SIGNTOOL_PATH) {
  const signtool = findWindowsSignTool()
  if (signtool) process.env.SIGNTOOL_PATH = signtool
}

const args = process.argv.slice(2)
const result = spawnSync('electron-builder', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(result.status === null ? 1 : result.status)
