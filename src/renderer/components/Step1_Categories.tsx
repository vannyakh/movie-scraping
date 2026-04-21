import type { ScraperProgress } from '../../lib/ipc'
import ProgressBar from './ProgressBar'
import styles from './StepCard.module.css'

interface Props {
  progress: ScraperProgress | null
  active: boolean
  done: boolean
}

export default function Step1_Categories({ progress, active, done }: Props) {
  const isStep = progress?.step === 1
  const count = isStep ? progress.current : done ? '✓' : '—'

  return (
    <div className={styles.card} data-active={active} data-done={done}>
      <div className={styles.stepNum}>Step 1</div>
      <div className={styles.stepName}>Categories</div>
      <div className={styles.stepStat}>{count}</div>
      <div className={styles.stepDesc}>
        {active ? (progress?.message ?? 'Collecting categories…') : done ? 'Complete' : 'Waiting'}
      </div>
      {active && (
        <div className={styles.barWrap}>
          <ProgressBar value={isStep && progress.total > 0 ? 60 : 0} />
        </div>
      )}
    </div>
  )
}
