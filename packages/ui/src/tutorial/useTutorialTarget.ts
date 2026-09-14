import { useCallback, useEffect, useRef } from 'react';
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

  const measure = useCallback(() => {
    // `measure()` (legacy pageX/pageY), not `measureInWindow()` — confirmed
    // live on device that measureInWindow() returns a consistently wrong Y
    // for a view nested inside GradientSurface > Pressable > ScrollView on
    // this Android/Fabric build (off by a fixed ~90dp, reproducible across
    // every retry/delay, so not a timing race — a genuinely wrong answer
    // from that specific native code path). measure()'s pageX/pageY compute
    // the same conceptual window-absolute position through different native
    // code and don't have the same bug.
    ref.current?.measure((x, y, width, height, pageX, pageY) => {
      if (width > 0 && height > 0) registerTarget(id, { x: pageX, y: pageY, width, height });
    });
  }, [id, registerTarget]);

  const onLayout = useCallback(() => {
    // Deferred one frame: calling measure synchronously inside onLayout can
    // report a stale/incorrect rect on Android — the native layout commit
    // this onLayout fired for isn't always fully flushed yet at that exact
    // instant. Waiting a frame lets it settle first.
    requestAnimationFrame(measure);
  }, [measure]);

  // onLayout only fires when THIS view's position relative to its own
  // immediate parent changes — not when an ancestor further up (e.g. a hero
  // header whose height depends on data that loads after first paint:
  // avatar image, trip stats) grows and shifts this view's absolute window
  // position while its local offset within its own parent stays identical.
  // Re-measuring on a couple of delays after mount catches that without
  // needing a full "remeasure everything whenever anything layouts"
  // architecture — belt-and-suspenders alongside the measure() switch above.
  useEffect(() => {
    const timers = [setTimeout(measure, 400), setTimeout(measure, 1200)];
    return () => timers.forEach(clearTimeout);
  }, [measure]);

  // `collapsable={false}` — without it, Android's view-flattening optimization
  // can drop a plain wrapper View (one with no background/border of its own)
  // from the native tree entirely, so `measureInWindow` above either measures
  // the wrong (surviving ancestor) view or never fires correctly. This is why
  // every coach mark's spotlight/tooltip used to land in the wrong place on
  // Android specifically — iOS never flattens views, so it only ever showed
  // up on device, not in review.
  return { ref, onLayout, collapsable: false as const };
}
