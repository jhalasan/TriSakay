import styles from './Toggle.module.css';

/** Wireframe kit §Part 0 "Toggle" (.track) — on/off switch, knob position via a modifier class. */
export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <label className={styles.row}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles.track} ${checked ? styles.on : styles.off}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
    </label>
  );
}
