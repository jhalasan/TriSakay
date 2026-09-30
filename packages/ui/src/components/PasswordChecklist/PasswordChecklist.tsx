import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '../../theme';

export interface PasswordRule {
  label: string;
  met: boolean;
}

export interface PasswordChecklistProps {
  rules: PasswordRule[];
}

/** Strength bar (one green segment per rule met) over a live checklist card. */
export function PasswordChecklist({ rules }: PasswordChecklistProps) {
  const metCount = rules.filter((rule) => rule.met).length;
  return (
    <View style={styles.wrap}>
      <View style={styles.bar} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: rules.length, now: metCount }}>
        {rules.map((rule, index) => (
          <View key={rule.label} style={[styles.segment, { backgroundColor: index < metCount ? colors.accentGreen : colors.line }]} />
        ))}
      </View>
      <View style={styles.card}>
        {rules.map((rule) => (
          <View key={rule.label} style={styles.row} accessible accessibilityLabel={rule.label} accessibilityState={{ checked: rule.met }}>
            {rule.met ? (
              <View style={styles.metDisc}>
                <Ionicons name="checkmark" size={11} color={colors.white} />
              </View>
            ) : (
              <View style={styles.unmetDisc} />
            )}
            <Text style={[styles.text, rule.met ? styles.textMet : styles.textUnmet]}>{rule.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  bar: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 2.5 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metDisc: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accentGreen, alignItems: 'center', justifyContent: 'center' },
  unmetDisc: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.line },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
  textMet: { fontFamily: fontFamily.semibold, color: colors.ink },
  textUnmet: { fontFamily: fontFamily.regular, color: colors.inkSoft },
});
