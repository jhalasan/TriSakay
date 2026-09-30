import { Ionicons } from '@expo/vector-icons';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

export type IconTileTone = 'navy' | 'green' | 'red' | 'neutral';

/** The handoff's tint pairs (README §2). Shared with StatusPill so a tone means one thing everywhere. */
export const TONE_COLORS: Record<IconTileTone, { bg: string; fg: string }> = {
  navy: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  green: { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed },
  red: { bg: colors.dangerSoft, fg: colors.dangerPressed },
  neutral: { bg: colors.fill, fg: colors.inkSoft },
};

export interface IconTileProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: IconTileTone;
  /** Tile edge in px (32–40 in the designs). The corner radius follows at size / 3.2. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** A rounded square with a centred glyph. Decorative: hidden from screen readers (the row it sits in carries the label). */
export function IconTile({ icon, tone = 'navy', size = 36, style }: IconTileProps) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, borderRadius: size / 3.2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}
