import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { colors } from '@trisakay/ui';
import { useMapScale } from './useMapScale';

export interface MapGroundProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Base of every illustration in the first-run flow: a flat ground fill plus
 * a 38px grid — one SVG `<Pattern>` node rather than dozens of hairline
 * `View`s (see the handoff's porting notes). Absolutely-positioned children
 * (road bands, route lines, pins, chips) are layered on top by the caller.
 */
export function MapGround({ style, children }: MapGroundProps) {
  const scale = useMapScale();
  const tile = scale(38);

  return (
    <View style={[styles.ground, style]}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <Pattern id="mapGrid" width={tile} height={tile} patternUnits="userSpaceOnUse">
            <Path d={`M ${tile} 0 L 0 0 0 ${tile}`} stroke={colors.line} strokeWidth={1} fill="none" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#mapGrid)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // No `flex`/dimensions here on purpose: mixing `flex: 1` with a caller's
  // explicit `height` (e.g. the walkthrough's fixed-height map band) fights
  // on web, where `flex-basis: 0` from the shorthand wins over `height` in
  // the flex main axis. Callers size this themselves — `flex: 1` for a
  // full-bleed screen (splash), an explicit `height` for a band (walkthrough).
  ground: {
    backgroundColor: colors.fill,
    overflow: 'hidden',
  },
});
