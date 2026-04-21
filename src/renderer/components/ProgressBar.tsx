import styles from './ProgressBar.module.css'

interface Props {
  value: number   // 0–100
  label?: string
}

export default function ProgressBar({ value, label }: Props) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.meta}>
          <span className={styles.label}>{label}</span>
          <span className={styles.pct}>{clamped}%</span>
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
