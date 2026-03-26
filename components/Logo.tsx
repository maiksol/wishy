import styles from './Logo.module.css'

export default function Logo() {
  return (
    <div className={styles.logo}>
      <div className={styles.markWrapper}>
        <div className={styles.mark}>
          <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path
              d="M18 3 C18 3 19.5 13 25 18 C19.5 23 18 33 18 33 C18 33 16.5 23 11 18 C16.5 13 18 3 18 3Z"
              fill="white"
            />
            <path
              d="M3 18 C3 18 13 16.5 18 11 C23 16.5 33 18 33 18 C33 18 23 19.5 18 25 C13 19.5 3 18 3 18Z"
              fill="white"
            />
          </svg>
        </div>
        <span className={styles.dot} aria-hidden="true" />
      </div>
      <span className={styles.wordmark}>
        wishy<span className={styles.accent}>✦</span>
      </span>
    </div>
  )
}
