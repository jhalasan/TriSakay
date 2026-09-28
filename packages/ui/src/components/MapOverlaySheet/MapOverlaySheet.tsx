import { useCallback } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, motion, spacing } from '../../theme';
import { styles } from './MapOverlaySheet.styles';

// Reanimated's own Easing, NOT the shared `motion.easing` token (that one is
// built from core react-native's Easing for core-RN Animated consumers —
// its functions aren't worklet-safe and crash if a Reanimated withTiming
// call, which runs as a UI-thread worklet, tries to invoke one). Same curve
// as motion.easing.out, sourced compatibly instead.
const SNAP_EASING = Easing.bezier(0.16, 1, 0.3, 1);

// Hoisted to plain strings so the worklet below captures two primitives
// rather than the whole `colors` object.
const HANDLE_COLOR = colors.lineStrong;
const HANDLE_COLOR_PRESSED = colors.inkSoft;

export interface MapOverlaySheetProps {
  children: React.ReactNode;
  /** Bounds the sheet's height for content that can grow (e.g. a results list) — otherwise it sizes to its content. */
  maxHeight?: number;
  /**
   * Pixels of bottom safe-area inset to add on top of the sheet's own
   * padding. Required from the call site rather than read internally: an
   * absolutely positioned child's containing block is its ancestor's full
   * padding box, so a `SafeAreaView`'s bottom padding does NOT constrain
   * this sheet the way it would a normal in-flow child — pass
   * `useSafeAreaInsets().bottom` explicitly instead.
   */
  bottomInset?: number;
  /**
   * A shared value this sheet writes its live height into, so a call site can
   * keep map chrome (e.g. OsmMap's recenter button, via its `bottomInsetValue`)
   * sitting just above the sheet as it is dragged, collapsed and expanded.
   * Owned by the caller — seed it with the sheet's approximate expanded height
   * so that chrome is already in the right place before the first layout pass.
   */
  heightValue?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fixed height around `children`: the sheet's own top padding, the handle's
 * touch area, and the gap between them (everything `sheet`/`handleTouchArea`
 * add besides content and bottom padding, which varies with `bottomInset`).
 * Kept as a token-derived constant, not a measurement, since it never
 * changes at runtime.
 */
const CHROME_HEIGHT = spacing.md + (spacing.sm * 2 + 4) + spacing.md;

/** How tall the sheet stays collapsed — exactly enough to show the handle and nothing else, maximizing how much map is revealed. */
const PEEK_HEIGHT = spacing.md + spacing.sm * 2 + 4;

/** A flick faster than this (px/s) snaps in that direction regardless of how far the sheet was dragged. */
const FLING_VELOCITY = 500;

/**
 * A panel that floats over the bottom of a full-bleed map, rather than
 * pushing the map into the remaining flex space the way a normal in-flow
 * layout would. Always `position: absolute` against its nearest positioned
 * ancestor — that ancestor must be the full-screen container the map also
 * fills.
 *
 * The handle is draggable: dragging down collapses the sheet to a small
 * peek (just the handle, maximizing map visibility) and dragging up
 * restores it, snapping to whichever end is closer (or in the flung
 * direction) on release. Purely a height animation on this component —
 * screens don't opt in or configure it.
 *
 * `children`'s own layout height is tracked continuously (not just once at
 * mount) — several call sites render content that resolves asynchronously
 * after the first paint (e.g. confirm.tsx's fare card), so the "expanded"
 * target has to keep up with real content growth or it would clip once
 * that content arrives.
 */
export function MapOverlaySheet({ children, maxHeight, bottomInset = 0, heightValue, style }: MapOverlaySheetProps) {
  const reducedMotion = useReducedMotion();
  // 0 means "not yet measured" — the sheet renders at its natural auto
  // height (exactly today's behavior) until the first layout pass reports
  // it, then height becomes explicitly controlled for dragging.
  const naturalHeight = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const dragStartHeight = useSharedValue(0);
  const collapsed = useSharedValue(false);
  /** 0 = resting, 1 = the handle is under a finger. */
  const handlePressed = useSharedValue(0);

  const paddingBottom = styles.sheet.paddingBottom + bottomInset;

  // Mirrored rather than handed out as `sheetHeight` itself so this component
  // keeps sole ownership of its own animation. Gated on a real measurement:
  // before the first layout pass `sheetHeight` is still 0 while the sheet is
  // actually rendering at its natural auto height, and publishing that 0 would
  // yank the caller's chrome to the screen's bottom edge for a frame.
  useAnimatedReaction(
    () => (naturalHeight.value === 0 ? null : sheetHeight.value),
    (height) => {
      if (height !== null && heightValue) heightValue.value = height;
    },
  );

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const isFirstMeasurement = naturalHeight.value === 0;
      let target = CHROME_HEIGHT + paddingBottom + event.nativeEvent.layout.height;
      if (maxHeight != null) target = Math.min(target, maxHeight);
      naturalHeight.value = target;
      if (collapsed.value) return; // stay at the peek height; the new size takes effect next time it's expanded
      sheetHeight.value =
        isFirstMeasurement || reducedMotion ? target : withTiming(target, { duration: motion.duration.settle, easing: SNAP_EASING });
    },
    [naturalHeight, sheetHeight, collapsed, paddingBottom, maxHeight, reducedMotion]
  );

  const panGesture = Gesture.Pan()
    // onBegin/onFinalize, not onStart/onEnd — a Pan only *starts* once the
    // finger has actually travelled, so the highlight would otherwise not
    // appear until the drag was already underway. These two fire on touch
    // down and on release (including a release that never became a drag),
    // which is exactly the pressed state.
    .onBegin(() => {
      handlePressed.value = withTiming(1, { duration: motion.duration.instant, easing: SNAP_EASING });
    })
    .onFinalize(() => {
      handlePressed.value = withTiming(0, { duration: motion.duration.quick, easing: SNAP_EASING });
    })
    .onStart(() => {
      dragStartHeight.value = sheetHeight.value;
    })
    .onUpdate((event) => {
      const next = dragStartHeight.value - event.translationY;
      sheetHeight.value = Math.min(naturalHeight.value, Math.max(PEEK_HEIGHT, next));
    })
    .onEnd((event) => {
      const midpoint = (PEEK_HEIGHT + naturalHeight.value) / 2;
      const expand =
        event.velocityY < -FLING_VELOCITY || (event.velocityY <= FLING_VELOCITY && sheetHeight.value > midpoint);
      collapsed.value = !expand;
      const target = expand ? naturalHeight.value : PEEK_HEIGHT;
      sheetHeight.value = reducedMotion
        ? target
        : withTiming(target, { duration: motion.duration.settle, easing: SNAP_EASING });
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: naturalHeight.value === 0 ? undefined : sheetHeight.value,
  }));

  // Darkens and widens the grip while it is held, so a tap that doesn't travel
  // far enough to move the sheet still confirms the handle is a live control.
  const animatedHandleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(handlePressed.value, [0, 1], [HANDLE_COLOR, HANDLE_COLOR_PRESSED]),
    transform: [{ scaleX: 1 + handlePressed.value * 0.15 }],
  }));

  return (
    <View style={styles.sheetShadowWrap}>
      <Animated.View
        style={[styles.sheet, { paddingBottom }, maxHeight != null && { maxHeight }, style, animatedSheetStyle]}
      >
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleTouchArea} hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.xl, right: spacing.xl }}>
            <Animated.View style={[styles.handle, animatedHandleStyle]} />
          </View>
        </GestureDetector>
        <View style={styles.content} onLayout={handleContentLayout}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
