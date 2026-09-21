import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal, colors } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { useBookingStore } from '../src/store/useBookingStore';

/** UAT P20: self-service account closure, routed the same way as /logout. */
export default function DeactivateAccountScreen() {
  const router = useRouter();
  const t = useTranslation();
  const deactivateAccount = useAuthStore((state) => state.deactivateAccount);
  const resetBooking = useBookingStore((state) => state.reset);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    const error = await deactivateAccount();
    setSubmitting(false);

    if (error) {
      Alert.alert(t.auth.deactivateAccount.title, error || t.auth.deactivateAccount.errorFallback);
      return;
    }

    resetBooking();
    router.dismiss();
  }

  return (
    <ConfirmModal
      visible
      title={t.auth.deactivateAccount.title}
      message={t.auth.deactivateAccount.message}
      cancelLabel={t.common.cancel}
      confirmLabel={t.auth.deactivateAccount.confirm}
      destructive
      confirmLoading={submitting}
      icon={<Ionicons name="warning" size={22} color={colors.dangerPressed} />}
      onCancel={() => router.dismiss()}
      onConfirm={handleConfirm}
    />
  );
}
