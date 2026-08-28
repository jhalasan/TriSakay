import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Pattern, Rect, Stop } from 'react-native-svg';
import { gradients, type GradientToken } from '../../theme';

export interface GradientSurfaceProps extends ViewProps {
  /** Named stop pair from theme/gradients.ts. Ignored when `solid` is set. */
  token?: GradientToken;
  /** 'diagonal' echoes the logo's own two-tone split; 'vertical' reads as a hero band. */
  direction?: 'diagonal' | 'vertical';
  /** Overlays the redesign's woven-texture pattern (135° repeating diagonal stripes) on top of the fill. */
  texture?: boolean;
  /** Stripe opacity when `texture` is set — spec uses 0.05–0.07 depending on the surface. */
  textureOpacity?: number;
  /** Flat brand color instead of a two-stop gradient (e.g. the CTA card's solid `#477434`). When set, `token` is ignored for the fill and no gradient `Defs` are created. */
  solid?: string;
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
  texture = false,
  textureOpacity = 0.05,
  solid,
  style,
  children,
  ...viewProps
}: GradientSurfaceProps) {
  const [from, to] = gradients[token];
  const id = `gradientSurface-${token}-${direction}`;
  const patternId = `${id}-texture`;
  const end = direction === 'diagonal' ? { x2: '100%', y2: '100%' } : { x2: '0%', y2: '100%' };

  return (
    <View style={[styles.container, style]} {...viewProps}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          {!solid && (
            <LinearGradient id={id} x1="0%" y1="0%" {...end}>
              <Stop offset="0%" stopColor={from} />
              <Stop offset="100%" stopColor={to} />
            </LinearGradient>
          )}
          {texture && (
            <Pattern id={patternId} patternUnits="userSpaceOnUse" width={14} height={14} patternTransform="rotate(135)">
              <Line x1="0" y1="0" x2="0" y2="14" stroke="#FFFFFF" strokeWidth={2} strokeOpacity={textureOpacity} />
            </Pattern>
          )}
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={solid ?? `url(#${id})`} />
        {texture && <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${patternId})`} />}
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
