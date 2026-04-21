import type { LogCallback } from '@shared/ipc-types'

export class ScrapeController {
  private _aborted = false
  private _paused  = false

  abort()  { this._aborted = true; this._paused = false }
  pause()  { this._paused  = true }
  resume() { this._paused  = false }

  get aborted() { return this._aborted }
  get paused()  { return this._paused  }

  async checkPause(onLog: LogCallback) {
    if (!this._paused) return
    onLog('⏸ Paused — waiting for resume…')
    while (this._paused && !this._aborted) await sleep(250)
    if (!this._aborted) onLog('▶ Resumed')
  }

  throwIfAborted(msg = 'Scraping stopped by user.') {
    if (this._aborted) throw new Error(msg)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms))
}
