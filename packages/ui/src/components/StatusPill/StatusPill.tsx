import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, radius } from '../../theme';
import { TONE_COLORS, type IconTileTone } from '../IconTile';

export interface StatusPillProps {
  label: string;
  /** green: Completed / Done / Paid / Closed · red: Cancelled · navy: Under review / Soon · neutral: anything else. */
  tone?: IconTileTone;
}

export function StatusPill({ label, tone = 'green' }: StatusPillProps) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' },
  label: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 16 },
});
