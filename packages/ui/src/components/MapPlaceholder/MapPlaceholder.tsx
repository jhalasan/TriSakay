import { Text, View, type DimensionValue } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../../theme';
import { styles } from './MapPlaceholder.styles';

/**
 * Stand-in for a real map view. Kept deliberately minimal in props (a
 * caption + a marker/route variant) so it can be swapped for an
 * OpenStreetMap-backed component later without touching call sites.
 */
export type MapPlaceholderVariant = 'pin' | 'route' | 'plain';

export interface MapPlaceholderProps {
  variant?: MapPlaceholderVariant;
  caption?: string;
  height?: DimensionValue;
}

const GRID_LINES = [
  { x1: '10%', y1: '0%', x2: '25%', y2: '100%' },
  { x1: '38%', y1: '0%', x2: '52%', y2: '100%' },
  { x1: '70%', y1: '0%', x2: '85%', y2: '100%' },
  { x1: '0%', y1: '30%', x2: '100%', y2: '22%' },
  { x1: '0%', y1: '68%', x2: '100%', y2: '76%' },
];

export function MapPlaceholder({ variant = 'plain', caption, height = 220 }: MapPlaceholderProps) {
  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height="100%">
        {GRID_LINES.map((line, i) => (
          <Line key={i} {...line} stroke={colors.line} strokeWidth={2} />
        ))}

        {variant === 'pin' && (
          <>
            <Circle cx="50%" cy="48%" r={16} fill={colors.accentBlueSoft} />
            <Circle cx="50%" cy="48%" r={7} fill={colors.accentBlue} />
          </>
        )}

        {variant === 'route' && (
          <>
            {/*
              A nested <Svg> with its own 0–100 viewBox, scaled independently
              per axis (preserveAspectRatio="none") to land on the same
              percentage points as the circles below — because the Path's `d`
              attribute cannot itself contain '%'. Android's native SVG path
              parser (unlike iOS/web) rejects that outright rather than just
              ignoring it, which is what actually crashed here.
            */}
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Path
                d="M 20 80 Q 45 20, 80 30"
                stroke={colors.accentBlue}
                strokeWidth={3}
                strokeDasharray="1, 10"
                strokeLinecap="round"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </Svg>
            <Circle cx="20%" cy="80%" r={6} fill={colors.accentGreen} />
            <Circle cx="80%" cy="30%" r={6} fill={colors.accentBlue} />
          </>
        )}
      </Svg>

      {caption && (
        <View style={styles.labelChip}>
          <Text style={styles.labelText}>{caption}</Text>
        </View>
      )}
    </View>
  );
}
