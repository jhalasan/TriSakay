import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal, colors } from '@trisakay/ui';
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
      icon={<Ionicons name="warning" size={22} color={colors.dangerPressed} />}
      onCancel={() => router.dismiss()}
      onConfirm={handleConfirm}
    />
  );
}
