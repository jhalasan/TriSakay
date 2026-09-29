import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_KEY = 'chatTipDismissedAt';
const SHOWN_COUNT_KEY = 'chatTipShownCount';
const MAX_SHOWN = 3;

/** Part C §C3 — the chat privacy tip shows on the first 3 chats, or until the driver dismisses it, whichever comes first. */
export function useChatPrivacyTip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dismissedAt, countRaw] = await Promise.all([AsyncStorage.getItem(DISMISSED_KEY), AsyncStorage.getItem(SHOWN_COUNT_KEY)]);
        if (cancelled || dismissedAt) return;
        const count = countRaw ? parseInt(countRaw, 10) : 0;
        if (count < MAX_SHOWN) {
          setVisible(true);
          await AsyncStorage.setItem(SHOWN_COUNT_KEY, String(count + 1));
        }
      } catch {
        // Fail-open: no tip shown is a harmless default, never worth crashing the chat screen over.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    setVisible(false);
    AsyncStorage.setItem(DISMISSED_KEY, new Date().toISOString()).catch(() => {});
  }

  return { visible, dismiss };
}
