import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, elevation, radius, typography } from '@trisakay/ui';
import { LabelChip, MapPin, RoadBand, RoutePath, useMapScale } from '../MapGround';
import { useReducedMotionEntering } from '../useReducedMotionEntering';

/** Walkthrough step 1: pickup → drop-off route, plus the illustrative "Where to?" search bar. */
export function WalkthroughRouteIllustration() {
  const scale = useMapScale();
  const entering = useReducedMotionEntering(() =>
    FadeIn.duration(550).delay(100).withInitialValues({ opacity: 0, transform: [{ translateY: -scale(22) }] }),
  );

  return (
    <>
      <RoadBand left={104} width={20} top={0} bottom={0} />
      <RoadBand top={206} height={26} left={0} right={0} />
      <RoadBand bottom={100} height={14} left={0} right={0} />
      <RoutePath points={[{ x: 114, y: 303 }, { x: 114, y: 122 }, { x: 292, y: 122 }]} />
      <MapPin x={114} y={303} tone="navy" delayMs={100} />
      <LabelChip x={99} y={334} label="Pickup" delayMs={950} />
      <MapPin x={292} y={122} tone="green" delayMs={1150} />
      <LabelChip x={237} y={140} label="Drop-off" delayMs={1400} />

      <Animated.View
        entering={entering}
        style={[
          styles.searchBar,
          elevation.chip,
          { left: scale(24), right: scale(24), borderRadius: radius.md, paddingVertical: scale(13), paddingHorizontal: scale(14) },
        ]}
      >
        <Ionicons name="search" size={19} color={colors.inkFaint} />
        <Text style={[typography.body, styles.searchLabel]}>Where to?</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
  },
  searchLabel: {
    color: colors.inkFaint,
  },
});
