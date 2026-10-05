import { useState } from 'react';
import { Button } from '../Button';
import { ErrorBanner } from '../ErrorBanner';
import { TextField } from '../TextField';
import { useToast } from '../Toast';
import styles from './PrintCaseButton.module.css';

export interface PrintCaseButtonProps {
  /** Offer "Include the chat thread". Only for a Supervisor or Admin, and only when the case has a ride. */
  offerChat: boolean;
  /** Records the print, builds the PDF and downloads it. Resolves with an error message when it could not. */
  onPrint: (options: { includeChat: boolean; chatReason: string }) => Promise<{ error: string | null; docNo?: string }>;
  /** Stops the button while the case's history is still loading, so the PDF is never printed half empty. */
  disabled?: boolean;
}

/** "Print case report (PDF)" with the optional, reason-gated chat thread. The database decides who may print; this only asks. */
export function PrintCaseButton({ offerChat, onPrint, disabled = false }: PrintCaseButtonProps) {
  const [includeChat, setIncludeChat] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handlePrint() {
    setBusy(true);
    setError(null);
    try {
      const result = await onPrint({ includeChat: offerChat && includeChat, chatReason: reason.trim() });
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast({ message: `Case report downloaded (${result.docNo}).` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {offerChat && (
        <label className={styles.chatOption}>
          <input type="checkbox" checked={includeChat} onChange={(e) => setIncludeChat(e.target.checked)} />
          <span>
            Include the ride&apos;s chat thread
            <span className={styles.chatNote}>The chat is private between the passenger and the driver. Including it is logged with your reason.</span>
          </span>
        </label>
      )}
      {offerChat && includeChat && (
        <TextField label="Reason for including the chat" placeholder="Why this thread is needed" value={reason} onChange={(e) => setReason(e.target.value)} />
      )}
      <ErrorBanner message={error} />
      <div>
        <Button variant="outline" tone="neutral" size="sm" loading={busy} disabled={disabled || (includeChat && !reason.trim())} onClick={handlePrint}>
          {busy ? 'Preparing PDF…' : 'Print case report (PDF)'}
        </Button>
      </div>
    </div>
  );
}
