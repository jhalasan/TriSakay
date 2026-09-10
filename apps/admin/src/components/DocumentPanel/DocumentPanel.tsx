import { Badge } from '../Badge';
import { DocumentImage } from '../DocumentImage';
import type { VerificationStatus } from '../../types/driver';
import styles from './DocumentPanel.module.css';

/** README §06 evidence-tile chip wording — distinct from the generic titleCaseLabel(status) used elsewhere. */
const STATUS_CHIP: Record<VerificationStatus, { label: string; tone: 'neutral' | 'success' | 'warn' | 'danger' }> = {
  unsubmitted: { label: 'Not reviewed', tone: 'neutral' },
  pending: { label: 'Reviewing', tone: 'warn' },
  approved: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

/** README §06 "Evidence (centre)" — one bordered tile per doc_type. */
export interface DocumentPanelProps {
  label: string;
  status: VerificationStatus;
  storagePath: string;
}

export function DocumentPanel({ label, status, storagePath }: DocumentPanelProps) {
  const chip = STATUS_CHIP[status];
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Badge label={chip.label} tone={chip.tone} />
      </div>
      <DocumentImage bucket="driver-docs" path={storagePath} alt={label} height={120} />
    </div>
  );
}
