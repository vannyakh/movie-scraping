import type { ScraperProgress } from '../../lib/ipc'
import ProgressBar from './ProgressBar'
import styles from './StepCard.module.css'

interface Props {
  progress: ScraperProgress | null
  active: boolean
  done: boolean
}

export default function Step3_Detail({ progress, active, done }: Props) {
  const isStep = progress?.step === 3
  const pct =
    isStep && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : done
        ? 100
        : 0

  return (
    <div className={styles.card} data-active={active} data-done={done}>
      <div className={styles.stepNum}>Step 3</div>
      <div className={styles.stepName}>Detail Pages</div>
      <div className={styles.stepStat}>
        {isStep ? `${progress.current} / ${progress.total}` : done ? '✓' : '—'}
      </div>
      <div className={styles.stepDesc}>
        {active
          ? (progress?.message ?? 'Fetching details…')
          : done
            ? 'Complete'
            : 'Waiting'}
      </div>
      {(active || done) && (
        <div className={styles.barWrap}>
          <ProgressBar value={pct} />
        </div>
      )}
    </div>
  )
}
