import { useState, useEffect, useRef, useCallback } from 'react'
import { ipc } from '../../lib/ipc'
import type { ScraperConfig, ScraperProgress, ScraperResult } from '../../lib/ipc'
import Step1_Categories from '../components/Step1_Categories'
import Step2_List from '../components/Step2_List'
import Step3_Detail from '../components/Step3_Detail'
import ProgressBar from '../components/ProgressBar'
import styles from './Dashboard.module.css'

type Status = 'idle' | 'running' | 'done' | 'error' | 'stopped'

const DEFAULT_CONFIG: ScraperConfig = {
  baseUrl: 'https://example-movie-site.com',
  outputDir: '',
  headless: true,
  maxMoviesPerCategory: 50,
}

export default function Dashboard() {
  const [config, setConfig] = useState<ScraperConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<ScraperProgress | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<ScraperResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const logEndRef = useRef<HTMLDivElement>(null)

  const appendLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-499), msg])
  }, [])

  useEffect(() => {
    const offs = [
      ipc.onProgress((p) => setProgress(p)),
      ipc.onLog((msg) => appendLog(msg)),
      ipc.onComplete((r) => {
        setResult(r)
        setStatus('done')
      }),
      ipc.onError((err) => {
        setErrorMsg(err)
        setStatus('error')
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [appendLog])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleStart = async () => {
    setLogs([])
    setProgress(null)
    setResult(null)
    setErrorMsg('')
    setStatus('running')
    await ipc.startScraping(config)
  }

  const handleStop = async () => {
    await ipc.stopScraping()
    setStatus('stopped')
  }

  const overallPct =
    progress == null
      ? 0
      : progress.step === 1
        ? 10
        : progress.step === 2
          ? 10 + (progress.current / Math.max(progress.total, 1)) * 35
          : 45 + (progress.current / Math.max(progress.total, 1)) * 55

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎬</span>
            <span className={styles.logoText}>MovieScraping</span>
          </div>
          {status === 'running' && (
            <span className={styles.badge} data-running>● Running</span>
          )}
          {status === 'done' && (
            <span className={styles.badge} data-done>✓ Complete</span>
          )}
          {status === 'error' && (
            <span className={styles.badge} data-error>✕ Error</span>
          )}
          {status === 'stopped' && (
            <span className={styles.badge} data-stopped>■ Stopped</span>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {/* ── Config panel ── */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Configuration</h2>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label htmlFor="baseUrl">Target URL</label>
              <input
                id="baseUrl"
                type="url"
                value={config.baseUrl}
                onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
                disabled={status === 'running'}
                placeholder="https://movie-site.com"
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="outputDir">Output Folder</label>
              <input
                id="outputDir"
                type="text"
                value={config.outputDir}
                onChange={(e) => setConfig((c) => ({ ...c, outputDir: e.target.value }))}
                disabled={status === 'running'}
                placeholder="C:\Users\You\Desktop\output"
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="maxMovies">Max Movies / Category</label>
              <input
                id="maxMovies"
                type="number"
                min={1}
                value={config.maxMoviesPerCategory ?? ''}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    maxMoviesPerCategory: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                disabled={status === 'running'}
                placeholder="Unlimited"
              />
            </div>
            <div className={styles.formField}>
              <label>Browser Mode</label>
              <div className={styles.toggleRow}>
                <button
                  className={styles.toggleBtn}
                  data-active={config.headless}
                  onClick={() => setConfig((c) => ({ ...c, headless: true }))}
                  disabled={status === 'running'}
                >
                  Headless
                </button>
                <button
                  className={styles.toggleBtn}
                  data-active={!config.headless}
                  onClick={() => setConfig((c) => ({ ...c, headless: false }))}
                  disabled={status === 'running'}
                >
                  Visible
                </button>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            {status !== 'running' ? (
              <button className={styles.btnPrimary} onClick={handleStart}>
                ▶ Start Scraping
              </button>
            ) : (
              <button className={styles.btnDanger} onClick={handleStop}>
                ■ Stop
              </button>
            )}
          </div>
        </section>

        {/* ── Overall progress bar ── */}
        {(status === 'running' || status === 'done') && (
          <ProgressBar value={Math.round(overallPct)} label="Overall progress" />
        )}

        {/* ── Step cards ── */}
        <div className={styles.steps}>
          <Step1_Categories
            progress={progress}
            active={status === 'running' && progress?.step === 1}
            done={progress != null && progress.step > 1}
          />
          <Step2_List
            progress={progress}
            active={status === 'running' && progress?.step === 2}
            done={progress != null && progress.step > 2}
          />
          <Step3_Detail
            progress={progress}
            active={status === 'running' && progress?.step === 3}
            done={status === 'done'}
          />
        </div>

        {/* ── Error banner ── */}
        {status === 'error' && (
          <div className={styles.errorBox}>
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {/* ── Success screen ── */}
        {status === 'done' && result && (
          <section className={styles.card} data-success>
            <h2 className={styles.sectionTitle}>✓ Scraping Complete</h2>
            <p className={styles.statLine}>
              <strong>{result.totalMovies}</strong> movies saved
            </p>
            <div className={styles.fileLinks}>
              <button
                className={styles.fileBtn}
                onClick={() => ipc.openPath(result.jsonPath)}
              >
                📄 Open JSON
              </button>
              <button
                className={styles.fileBtn}
                onClick={() => ipc.openPath(result.excelPath)}
              >
                📊 Open Excel
              </button>
            </div>
          </section>
        )}

        {/* ── Log console ── */}
        {logs.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Log</h2>
            <div className={styles.logBox}>
              {logs.map((line, i) => (
                <div key={i} className={styles.logLine}>{line}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
