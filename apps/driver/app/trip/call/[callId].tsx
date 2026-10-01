import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CallScreenView } from '../../../src/components/CallScreenView';

export default function DriverCallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const router = useRouter();

  // Opened from a notification on a cold start there is nothing to go back to; splash re-resolves where to land.
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/splash');
  }, [router]);

  return <CallScreenView callId={callId} onClose={close} />;
}
