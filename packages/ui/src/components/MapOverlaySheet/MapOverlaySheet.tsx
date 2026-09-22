import { useCallback } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion, spacing } from '../../theme';
import { styles } from './MapOverlaySheet.styles';

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
export function MapOverlaySheet({ children, maxHeight, bottomInset = 0, style }: MapOverlaySheetProps) {
  const reducedMotion = useReducedMotion();
  // 0 means "not yet measured" — the sheet renders at its natural auto
  // height (exactly today's behavior) until the first layout pass reports
  // it, then height becomes explicitly controlled for dragging.
  const naturalHeight = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const dragStartHeight = useSharedValue(0);
  const collapsed = useSharedValue(false);

  const paddingBottom = styles.sheet.paddingBottom + bottomInset;

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const isFirstMeasurement = naturalHeight.value === 0;
      let target = CHROME_HEIGHT + paddingBottom + event.nativeEvent.layout.height;
      if (maxHeight != null) target = Math.min(target, maxHeight);
      naturalHeight.value = target;
      if (collapsed.value) return; // stay at the peek height; the new size takes effect next time it's expanded
      sheetHeight.value =
        isFirstMeasurement || reducedMotion ? target : withTiming(target, { duration: motion.duration.settle, easing: motion.easing.out });
    },
    [naturalHeight, sheetHeight, collapsed, paddingBottom, maxHeight, reducedMotion]
  );

  const panGesture = Gesture.Pan()
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
        : withTiming(target, { duration: motion.duration.settle, easing: motion.easing.out });
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: naturalHeight.value === 0 ? undefined : sheetHeight.value,
  }));

  return (
    <View style={styles.sheetShadowWrap}>
      <Animated.View
        style={[styles.sheet, { paddingBottom }, maxHeight != null && { maxHeight }, style, animatedSheetStyle]}
      >
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleTouchArea} hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.xl, right: spacing.xl }}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <View style={styles.content} onLayout={handleContentLayout}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
