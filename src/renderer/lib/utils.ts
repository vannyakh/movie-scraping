import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatElapsed(startIso: string) {
  const ms = Date.now() - new Date(startIso).getTime()
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  const h  = Math.floor(m / 60)
  if (h > 0)  return `${h}h ${m % 60}m`
  if (m > 0)  return `${m}m ${s % 60}s`
  return `${s}s`
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function moviesToCsv(movies: { [k: string]: unknown }[]) {
  const headers = ['title','category','year','rating','duration','director','cast','description','url']
  const escape  = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows    = movies.map(m => headers.map(h => escape(m[h])).join(','))
  return [headers.join(','), ...rows].join('\n')
}
