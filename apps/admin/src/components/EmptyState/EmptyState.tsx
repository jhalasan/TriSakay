import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return <div className={styles.wrap}>{message}</div>;
}
