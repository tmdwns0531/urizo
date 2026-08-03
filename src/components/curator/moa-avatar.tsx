import styles from "./curator-widget.module.css";

export function MoaAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`${styles.avatar} ${compact ? styles.avatarCompact : ""}`}
      aria-hidden="true"
    >
      <span className={styles.antenna}>
        <span className={styles.star}>★</span>
      </span>
      <span className={styles.robotHead}>
        <span className={styles.robotEarLeft} />
        <span className={styles.robotEarRight} />
        <span className={styles.robotScreen}>
          <span className={styles.robotEyes}>
            <span />
            <span />
          </span>
          <span className={styles.robotMouth} />
        </span>
      </span>
      <span className={styles.robotBody}>
        <span className={styles.robotButtonCoral} />
        <span className={styles.robotButtonBlue} />
      </span>
    </span>
  );
}
