import { View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface BrandMotifProps extends ViewProps {
  /** Diameter of the motif's bounding box. */
  size?: number;
  /** Tint — pass a single color; this is a monochrome echo, not the logo itself. */
  color?: string;
  opacity?: number;
}

/**
 * An abstracted echo of the brand mark's silhouette — a ring open at the
 * bottom, with a chevron closing the gap — NOT a redraw of the literal
 * logo (no tricycle glyph, no two-tone color). Used only as a low-opacity
 * decorative watermark (splash hero, PulseBeacon, EmptyState) so the mark
 * itself stays exclusive to the real lockup/mark images.
 */
export function BrandMotif({
  size = 220,
  color = '#FFFFFF',
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
          stroke={color}
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
