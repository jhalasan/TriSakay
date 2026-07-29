import { useRouter } from 'expo-router';
import { ConfirmModal } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useBookingStore } from '../src/store/useBookingStore';

export default function LogoutScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const resetBooking = useBookingStore((state) => state.reset);

  async function handleConfirm() {
    await logout();
    resetBooking();
    router.dismiss();
  }

  return (
    <ConfirmModal
      visible
      title="Log out?"
      message="You'll need to log in again to book a ride."
      cancelLabel="Cancel"
      confirmLabel="Log out"
      destructive
      onCancel={() => router.dismiss()}
      onConfirm={handleConfirm}
    />
  );
}
