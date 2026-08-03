import { useRouter } from 'expo-router';
import { ConfirmModal } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useDriverStore } from '../src/store/useDriverStore';
import { useRequestsStore } from '../src/store/useRequestsStore';

export default function LogoutScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  async function handleConfirm() {
    await logout();
    useRequestsStore.getState().stopSimulatingArrivals();
    useDriverStore.getState().setAvailable(false);
    router.dismiss();
  }

  return (
    <ConfirmModal
      visible
      title="Log out?"
      message="You'll need to log in again to go online."
      cancelLabel="Cancel"
      confirmLabel="Log out"
      destructive
      onCancel={() => router.dismiss()}
      onConfirm={handleConfirm}
    />
  );
}
