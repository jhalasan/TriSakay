import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '../../theme';
import { IconTile, type IconTileTone } from '../IconTile';

export type SelectTileAccent = 'green' | 'red' | 'navy';

const ACCENT: Record<SelectTileAccent, { border: string; shadow: string | null }> = {
  green: { border: colors.accentGreen, shadow: colors.accentGreen },
  red: { border: colors.danger, shadow: null },
  navy: { border: colors.accentBlue, shadow: colors.accentBlue },
};

export interface SelectTileProps {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
  /** Selected accent: green for positive rating tags, red for negative ones, navy for complaint categories. */
  accent?: SelectTileAccent;
  /** Icon-tile tint while NOT selected. Defaults to neutral. */
  idleTone?: IconTileTone;
  /** Multi-select tiles are checkboxes; single-select ones are radios. */
  role?: 'checkbox' | 'radio';
}

/** A selectable icon + label tile (rating tags, complaint categories) with a check badge when selected. */
export function SelectTile({
  label,
  icon,
  selected,
  onPress,
  accent = 'navy',
  idleTone = 'neutral',
  role = 'checkbox',
}: SelectTileProps) {
  const { border, shadow } = ACCENT[accent];
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.slot}
    >
      <View
        style={[
          styles.tile,
          selected && { borderWidth: 1.5, borderColor: border },
          selected && shadow ? { shadowColor: shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 3 } : null,
        ]}
      >
        <IconTile icon={icon} size={34} tone={selected ? accentTone(accent) : idleTone} />
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
      {selected && (
        <View style={[styles.badge, { backgroundColor: border }]} pointerEvents="none">
          <Ionicons name="checkmark" size={10} color={colors.white} />
        </View>
      )}
    </Pressable>
  );
}

function accentTone(accent: SelectTileAccent): IconTileTone {
  return accent;
}

const styles = StyleSheet.create({
  slot: { flex: 1, minHeight: 44 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  label: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: colors.ink },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
