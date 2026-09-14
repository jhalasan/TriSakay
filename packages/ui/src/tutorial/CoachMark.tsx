import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { clampArrowLeft } from './geometry';
import { styles } from './CoachMark.styles';
import type { TutorialRect, TutorialStep } from './types';

const RECT_TRANSITION_MS = 280;
const RECT_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const PULSE_MS = 1800;

export interface CoachMarkProps {
  step: number;
  total: number;
  tutorialStep: TutorialStep;
  rect: TutorialRect & { radius: number };
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}

/** One coach-mark step: the four-box dim, spotlight rect, pulse ring, and tooltip. */
export function CoachMark({ step, total, tutorialStep, rect, onSkip, onBack, onNext }: CoachMarkProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const x = useSharedValue(rect.x);
  const y = useSharedValue(rect.y);
  const width = useSharedValue(rect.width);
  const height = useSharedValue(rect.height);
  const radius = useSharedValue(rect.radius);

  useEffect(() => {
    const config = reducedMotion ? { duration: 0 } : { duration: RECT_TRANSITION_MS, easing: RECT_EASING };
    x.value = withTiming(rect.x, config);
    y.value = withTiming(rect.y, config);
    width.value = withTiming(rect.width, config);
    height.value = withTiming(rect.height, config);
    radius.value = withTiming(rect.radius, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect.x, rect.y, rect.width, rect.height, rect.radius, reducedMotion]);

  const pulseScale = useSharedValue(reducedMotion ? 1 : 0.96);
  const pulseOpacity = useSharedValue(reducedMotion ? 0 : 0.7);

  useEffect(() => {
    if (reducedMotion) return;
    pulseScale.value = withRepeat(withTiming(1.04, { duration: PULSE_MS, easing: Easing.out(Easing.ease) }), -1, false);
    pulseOpacity.value = withRepeat(withTiming(0, { duration: PULSE_MS, easing: Easing.out(Easing.ease) }), -1, false);
  }, [reducedMotion, pulseScale, pulseOpacity]);

  const dimTopStyle = useAnimatedStyle(() => ({ height: y.value }));
  const dimBottomStyle = useAnimatedStyle(() => ({ top: y.value + height.value }));
  const dimLeftStyle = useAnimatedStyle(() => ({ top: y.value, height: height.value, width: x.value }));
  const dimRightStyle = useAnimatedStyle(() => ({
    top: y.value,
    height: height.value,
    left: x.value + width.value,
  }));
  const spotlightStyle = useAnimatedStyle(() => ({
    top: y.value,
    left: x.value,
    width: width.value,
    height: height.value,
    borderRadius: radius.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    top: y.value - 6,
    left: x.value - 6,
    width: width.value + 12,
    height: height.value + 12,
    borderRadius: radius.value + 6,
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Measured once the tooltip has actually rendered — before that, 0, which
  // skips clamping below (an unmeasured tooltip renders at its natural
  // top/bottom position, no different from before this existed).
  const [tooltipHeight, setTooltipHeight] = useState(0);

  // A target's real (now-correctly-measured) position can sit low enough on
  // screen that "16px below the spotlight" pushes the tooltip's Skip/Back/
  // Next row past the bottom edge — entirely off-screen and untappable.
  // Clamp the tooltip's top to always leave both it and a safety margin on
  // screen, rather than trusting the step's declared 'above'/'below'
  // preference unconditionally.
  const TOOLTIP_MARGIN = 16;
  const SAFE_EDGE_MARGIN = 20;
  const idealTop = tutorialStep.tip === 'below' ? rect.y + rect.height + TOOLTIP_MARGIN : rect.y - TOOLTIP_MARGIN - tooltipHeight;
  const maxTop = screenHeight - tooltipHeight - SAFE_EDGE_MARGIN;
  const clampedTop = tooltipHeight > 0 ? Math.min(Math.max(idealTop, SAFE_EDGE_MARGIN), Math.max(maxTop, SAFE_EDGE_MARGIN)) : idealTop;
  const tooltipVerticalStyle = { top: clampedTop };
  // The arrow sits on the tooltip's near edge to the spotlight: its top edge
  // when the tooltip is below the rect, its bottom edge when above. Purely
  // decorative (which way it points) — independent of any clamping above.
  const arrowAnchorStyle = tutorialStep.tip === 'below' ? { top: -7 } : { bottom: -7 };
  const arrowLeft = clampArrowLeft(rect.x + rect.width / 2, 16, screenWidth);

  const isFirst = step === 1;
  const isLast = step === total;

  return (
    <View style={styles.coachMarkFill} pointerEvents="box-none">
      <Animated.View style={[styles.dimBox, styles.dimTop, dimTopStyle]} pointerEvents="auto" />
      <Animated.View style={[styles.dimBox, styles.dimBottom, dimBottomStyle]} pointerEvents="auto" />
      <Animated.View style={[styles.dimBox, styles.dimLeft, dimLeftStyle]} pointerEvents="auto" />
      <Animated.View style={[styles.dimBox, styles.dimRight, dimRightStyle]} pointerEvents="auto" />
      <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none" />
      <Animated.View style={[styles.spotlightRect, spotlightStyle]} pointerEvents="none" />

      <View
        style={[styles.tooltip, tooltipVerticalStyle]}
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
      >
        <View style={[styles.tooltipArrow, arrowAnchorStyle, { left: arrowLeft }]} />
        <View style={styles.tooltipHeaderRow}>
          <View style={styles.tooltipChip}>
            <Text style={styles.tooltipChipText}>
              {step} of {total}
            </Text>
          </View>
        </View>
        <Text style={styles.tooltipTitle}>{tutorialStep.title}</Text>
        <Text style={styles.tooltipBody}>{tutorialStep.body}</Text>

        <View style={styles.tooltipTrack}>
          <View style={[styles.tooltipTrackFill, { width: `${(step / total) * 100}%` }]} />
        </View>

        <View style={styles.tooltipControls}>
          <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={8}>
            <Text style={styles.tooltipSkip}>Skip tour</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityElementsHidden={isFirst}
            importantForAccessibility={isFirst ? 'no-hide-descendants' : 'auto'}
            onPress={isFirst ? undefined : onBack}
            hitSlop={8}
            style={isFirst && styles.tooltipBackHidden}
          >
            <Text style={styles.tooltipBack}>Back</Text>
          </Pressable>
          <View style={styles.tooltipSpacer} />
          <Pressable accessibilityRole="button" onPress={onNext} style={styles.tooltipNextButton}>
            <Text style={styles.tooltipNextLabel}>{isLast ? 'Done' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
