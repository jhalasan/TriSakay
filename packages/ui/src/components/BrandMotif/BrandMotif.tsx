import { View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface BrandMotifProps extends ViewProps {
  /** Diameter of the motif's bounding box. */
  size?: number;
  /** Ring tint — pass a single color for a monochrome echo, not the logo itself. */
  color?: string;
  /** Chevron tint, if it should differ from the ring (e.g. the verified-driver badge's white ring / brand-green chevron). Defaults to `color`. */
  chevronColor?: string;
  opacity?: number;
}

/**
 * An abstracted echo of the brand mark's silhouette — a ring open at the
 * bottom, with a chevron closing the gap — NOT a redraw of the literal logo
 * (no tricycle glyph). Used mostly as a low-opacity decorative watermark
 * (splash hero, PulseBeacon, EmptyState), so the mark itself stays exclusive
 * to the real lockup/mark images — the one exception is the walkthrough's
 * verified-driver badge, which needs this exact silhouette at full opacity
 * with the ring and chevron in two different tones (`chevronColor`).
 */
export function BrandMotif({
  size = 220,
  color = '#FFFFFF',
  chevronColor,
  opacity = 0.08,
  style,
  ...viewProps
}: BrandMotifProps) {
  return (
    <View style={style} {...viewProps}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Ring, open at the bottom ~70deg to leave room for the chevron. */}
        <Path
          d="M 22 46 A 28 28 0 1 1 78 46"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          opacity={opacity}
        />
        {/* Chevron closing the gap, echoing the mark's checkmark base. */}
        <Path
          d="M 28 58 L 50 80 L 72 58"
          stroke={chevronColor ?? color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}
