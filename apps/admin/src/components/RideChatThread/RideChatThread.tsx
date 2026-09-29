import { useState } from 'react';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { ErrorBanner } from '../ErrorBanner';
import { Badge } from '../Badge';
import { DocumentImage } from '../DocumentImage';
import { viewRideMessages, type AdminRideMessage } from '../../services/rideChat';
import { formatDateTime } from '../../lib/format';
import styles from './RideChatThread.module.css';

export interface RideChatThreadProps {
  rideRequestId: string;
}

const KIND_LABEL: Record<AdminRideMessage['kind'], string> = {
  text: '',
  quick_reply: 'Quick reply',
  image: 'Photo',
  system: 'System',
};

/**
 * S1 (UAT_PANELIST_REVIEW_ADRALES.md) — the PSO case-view of a ride's chat
 * thread, deferred by C1's own migration. Embedded in both Complaints.tsx
 * and EmergencyAlerts.tsx's detail Modal, since either can be the qualifying
 * link admin_view_ride_messages() checks for. A reason is required before
 * the RPC will return anything (L16) — this component never lets "View
 * chat thread" submit with a blank reason, though the RPC enforces that
 * itself regardless of what this does.
 */
export function RideChatThread({ rideRequestId }: RideChatThreadProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminRideMessage[] | null>(null);

  async function handleView() {
    if (!reason.trim()) return;
    setLoading(true);
    setError(null);
    const { data, error: viewError } = await viewRideMessages(rideRequestId, reason);
    setLoading(false);
    if (viewError) {
      setError(viewError);
      return;
    }
    setMessages(data);
  }

  if (!open) {
    return (
      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Chat thread</div>
        <span className={styles.hint}>Only accessible from a complaint or emergency alert linked to this ride — every view is logged.</span>
        <Button variant="outline" tone="neutral" size="sm" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>
          View chat thread
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.subsection}>
      <div className={styles.subsectionTitle}>Chat thread</div>

      {messages === null && (
        <>
          <Textarea
            label="Reason for viewing this thread"
            hint="Required — recorded in the audit log alongside your name and the timestamp."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Verifying the passenger's harassment complaint against this driver."
            rows={2}
          />
          <ErrorBanner message={error} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="solid" tone="primary" size="sm" loading={loading} disabled={!reason.trim()} onClick={handleView}>
              {loading ? 'Loading…' : 'View thread'}
            </Button>
            <Button variant="outline" tone="neutral" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {messages !== null && (
        <>
          <Badge label={`${messages.length} message${messages.length === 1 ? '' : 's'} · logged as viewed`} tone="neutral" />
          {messages.length === 0 && <span className={styles.hint}>No messages were ever sent on this ride.</span>}
          {messages.length > 0 && (
            <div className={styles.messageList}>
              {messages.map((m) => (
                <div key={m.id} className={styles.message}>
                  <div className={styles.messageMeta}>
                    <span className={styles.messageSender}>{m.senderName ?? 'Unknown'}</span>
                    {m.senderRole && <Badge label={m.senderRole === 'driver' ? 'Driver' : 'Passenger'} tone="neutral" />}
                    {KIND_LABEL[m.kind] && <Badge label={KIND_LABEL[m.kind]} tone="neutral" />}
                    <span className={styles.messageTime}>{formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.kind === 'image' && m.imagePath ? (
                    <DocumentImage bucket="ride-chat" path={m.imagePath} alt="Shared photo" height={140} />
                  ) : (
                    <span className={styles.messageBody}>{m.body}</span>
                  )}
                  {m.containsMaskedPhone && <span className={styles.hint}>Contained a masked phone number.</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
