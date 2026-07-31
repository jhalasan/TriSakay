import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { gradients, type GradientToken } from '../../theme';

export interface GradientSurfaceProps extends ViewProps {
  /** Named stop pair from theme/gradients.ts. */
  token?: GradientToken;
  /** 'diagonal' echoes the logo's own two-tone split; 'vertical' reads as a hero band. */
  direction?: 'diagonal' | 'vertical';
}

/**
 * The one place gradient logic lives. Screens pass a token name; this
 * renders an absolutely-filled SVG rect behind whatever children are
 * layered on top (pass children through normally — this does not clip).
 *
 * Built on react-native-svg (already a project dependency) rather than
 * adding expo-linear-gradient, per the redesign skill's "work with the
 * existing stack" rule.
 */
export function GradientSurface({
  token = 'hero',
  direction = 'vertical',
  style,
  children,
  ...viewProps
}: GradientSurfaceProps) {
  const [from, to] = gradients[token];
  const id = `gradientSurface-${token}-${direction}`;
  const end = direction === 'diagonal' ? { x2: '100%', y2: '100%' } : { x2: '0%', y2: '100%' };

  return (
    <View style={[styles.container, style]} {...viewProps}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" {...end}>
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
