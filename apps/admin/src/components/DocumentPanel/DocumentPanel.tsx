import { useState } from 'react';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { DocumentImage } from '../DocumentImage';
import { TextField } from '../TextField';
import type { VerificationStatus } from '../../types/driver';
import styles from './DocumentPanel.module.css';

/** README §06 evidence-tile chip wording — distinct from the generic titleCaseLabel(status) used elsewhere. */
const STATUS_CHIP: Record<VerificationStatus, { label: string; tone: 'neutral' | 'success' | 'warn' | 'danger' }> = {
  unsubmitted: { label: 'Not reviewed', tone: 'neutral' },
  pending: { label: 'Reviewing', tone: 'warn' },
  approved: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

/** Per document review controls, shown to PSO Supervisor and Administrator only. */
export interface DocumentReview {
  /** True while the case is already decided, or another action is running. */
  disabled?: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

/** README §06 "Evidence (centre)" — one bordered tile per doc_type. */
export interface DocumentPanelProps {
  label: string;
  status: VerificationStatus;
  storagePath: string;
  /** The reason given when this document was rejected. */
  remarks?: string;
  review?: DocumentReview;
}

export function DocumentPanel({ label, status, storagePath, remarks, review }: DocumentPanelProps) {
  const chip = STATUS_CHIP[status];
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  function submitReject() {
    if (!review || !reason.trim()) return;
    review.onReject(reason.trim());
    setRejecting(false);
    setReason('');
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Badge label={chip.label} tone={chip.tone} />
      </div>
      <DocumentImage bucket="driver-docs" path={storagePath} alt={label} height={120} />
      {status === 'rejected' && remarks ? <p className={styles.reason}>Reason: {remarks}</p> : null}
      {review && !rejecting ? (
        <div className={styles.actions}>
          <Button variant="outline" tone="neutral" size="sm" disabled={review.disabled || status === 'approved'} onClick={review.onApprove}>
            Mark OK
          </Button>
          <Button variant="outline" tone="danger" size="sm" disabled={review.disabled || status === 'rejected'} onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      ) : null}
      {review && rejecting ? (
        <div className={styles.rejectForm}>
          <TextField
            label="Reason for the driver"
            hint="Tell the driver what is wrong, for example: photo is blurry."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Plate number is cut off"
          />
          <div className={styles.actions}>
            <Button variant="ghost" tone="neutral" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button variant="solid" tone="danger" size="sm" disabled={!reason.trim()} onClick={submitReject}>
              Reject document
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
