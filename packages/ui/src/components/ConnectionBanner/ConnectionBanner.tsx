import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export interface ConnectionBannerProps {
  offline: boolean;
  /** The device's top safe-area inset; the banner sits just under the status bar. */
  topInset: number;
  offlineLabel: string;
  /** Shown briefly once the connection returns. */
  onlineLabel: string;
}

const BACK_ONLINE_MS = 2500;
/** Kept under the height of the map screens' own top controls so it never covers them. */
const BANNER_HEIGHT = 26;

/**
 * A slim strip under the status bar that tells the user the connection dropped
 * (and, briefly, that it came back). For screens where the offline strip that
 * sits in the tab layout isn't shown, like the ride screens. It never takes
 * touches, so the SOS button and header controls beneath stay usable.
 */
export function ConnectionBanner({ offline, topInset, offlineLabel, onlineLabel }: ConnectionBannerProps) {
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      setShowBackOnline(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setShowBackOnline(true);
    const timer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_MS);
    return () => clearTimeout(timer);
  }, [offline]);

  if (!offline && !showBackOnline) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bar, { top: topInset, backgroundColor: offline ? colors.ink : colors.accentGreenPressed }]}
    >
      <View style={[styles.dot, { backgroundColor: offline ? '#F2B8B5' : colors.white }]} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2} style={styles.text}>
        {offline ? offlineLabel : onlineLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 1,
    paddingHorizontal: spacing.tight18,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...typography.bodyStrong, fontSize: 12, color: colors.white, flexShrink: 1 },
});
