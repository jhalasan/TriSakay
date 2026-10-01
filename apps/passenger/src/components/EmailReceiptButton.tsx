import { useState } from 'react';
import { Alert } from 'react-native';
import { emailTripReceipt } from '@trisakay/services';
import { maskEmail } from '@trisakay/shared';
import { Button } from '@trisakay/ui';
import { useTranslation } from '../hooks/useTranslation';
import { useAuthStore } from '../store/useAuthStore';

/** "Email me this receipt" — always goes to the account's own email; the server builds the receipt and enforces the send limits. */
export function EmailReceiptButton({ rideRequestId }: { rideRequestId: string }) {
  const t = useTranslation();
  const email = useAuthStore((state) => state.user?.email);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handlePress() {
    setSending(true);
    const { error } = await emailTripReceipt(rideRequestId);
    setSending(false);
    if (error) {
      Alert.alert(t.history.emailReceiptFailedTitle, error);
      return;
    }
    setSent(true);
  }

  return (
    <Button
      label={sent ? t.history.emailReceiptSent.replace('{email}', email ? maskEmail(email) : '') : t.history.emailReceiptButton}
      variant="outline"
      tone="neutral"
      fullWidth
      loading={sending}
      disabled={sent}
      onPress={handlePress}
    />
  );
}
