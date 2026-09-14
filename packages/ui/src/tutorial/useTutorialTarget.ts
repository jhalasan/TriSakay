import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useTutorial } from './TutorialProvider';

/**
 * Registers the measured window-absolute rect of whatever plain `<View>` (or
 * ref-forwarding host component, e.g. `Pressable`) this is spread onto:
 *
 *   const target = useTutorialTarget('greeting-header');
 *   <View {...target} style={styles.heroShadowWrap}>…</View>
 *
 * Never spread onto a non-forwardRef composite component (GradientSurface,
 * Card) — wrap it in a plain View instead, since `ref` would silently do
 * nothing there. The overlay falls back to the step table's design-frame
 * rect for any id that never reports (see TutorialOverlay.tsx).
 */
export function useTutorialTarget(id: string) {
  const ref = useRef<View>(null);
  const { registerTarget } = useTutorial();

  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) registerTarget(id, { x, y, width, height });
    });
  }, [id, registerTarget]);

  return { ref, onLayout };
}
