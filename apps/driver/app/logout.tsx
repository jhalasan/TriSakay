import { useRouter } from 'expo-router';
import { ConfirmModal } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { useDriverStore } from '../src/store/useDriverStore';
import { useRequestsStore } from '../src/store/useRequestsStore';

export default function LogoutScreen() {
  const router = useRouter();
  const t = useTranslation();
  const logout = useAuthStore((state) => state.logout);

  async function handleConfirm() {
    // Must run before logout(): the offline write needs the still-live
    // session, and going offline is what the enforce/clear-location
    // triggers key off of server-side.
    await useDriverStore.getState().setAvailable(false);
    useRequestsStore.getState().unsubscribe();
    await logout();
    router.dismiss();
  }

  return (
    <ConfirmModal
      visible
      title={t.driver.logout.title}
      message={t.driver.logout.message}
      cancelLabel={t.common.cancel}
      confirmLabel={t.driver.logout.confirm}
      destructive
      onCancel={() => router.dismiss()}
      onConfirm={handleConfirm}
    />
  );
}
