import { Badge } from '../Badge';
import { DocumentImage } from '../DocumentImage';
import type { VerificationStatus } from '../../types/driver';
import { titleCaseLabel } from '../../lib/format';
import styles from './DocumentPanel.module.css';

const STATUS_TONE: Record<VerificationStatus, 'neutral' | 'success' | 'warn' | 'danger'> = {
  unsubmitted: 'neutral',
  pending: 'warn',
  approved: 'success',
  rejected: 'danger',
};

/** Wireframe screen 4 "Driver & tricycle verification" — one labelled document box per doc_type. */
export interface DocumentPanelProps {
  label: string;
  status: VerificationStatus;
  storagePath: string;
}

export function DocumentPanel({ label, status, storagePath }: DocumentPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Badge label={titleCaseLabel(status)} tone={STATUS_TONE[status]} />
      </div>
      <DocumentImage bucket="driver-docs" path={storagePath} alt={label} height={120} />
    </div>
  );
}
