import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, motion } from '../../theme';
import { recordsPalette } from '../../theme/recordsPalette';
import type { PasswordRule } from '../PasswordChecklist';

export interface PasswordStrengthMeterProps {
  rules: PasswordRule[];
  labels: { weak: string; fair: string; strong: string };
}

type Strength = 'weak' | 'fair' | 'strong';

/** Same buckets as the admin portal's forced password change: all rules met = strong, all but one = fair, otherwise weak. */
function strengthOf(rules: PasswordRule[]): Strength {
  const met = rules.filter((rule) => rule.met).length;
  if (met >= rules.length) return 'strong';
  if (met === rules.length - 1 && met > 0) return 'fair';
  return 'weak';
}

const FILL: Record<Strength, { fraction: number; color: string; text: string }> = {
  weak: { fraction: 0.2, color: colors.danger, text: colors.danger },
  fair: { fraction: 0.6, color: recordsPalette.amberBorder, text: recordsPalette.amberIcon },
  strong: { fraction: 1, color: colors.accentGreen, text: colors.accentGreen },
};

/**
 * The password strength bar from the admin web's "Set your own password" screen,
 * for the mobile signups: a track that fills red, amber then green with a
 * Weak / Fair / Strong word, over a live list of the rules.
 */
export function PasswordStrengthMeter({ rules, labels }: PasswordStrengthMeterProps) {
  const strength = strengthOf(rules);
  const { fraction, color, text } = FILL[strength];
  const progress = useRef(new Animated.Value(fraction)).current;
  const metCount = rules.filter((rule) => rule.met).length;

  useEffect(() => {
    // width can't use the native driver; a 180 ms bar on a form field is cheap.
    Animated.timing(progress, { toValue: fraction, duration: 180, easing: motion.easing.out, useNativeDriver: false }).start();
  }, [fraction, progress]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: rules.length, now: metCount }}>
          <Animated.View
            style={[styles.fill, { backgroundColor: color, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
        <Text style={[styles.label, { color: text }]}>{labels[strength]}</Text>
      </View>
      <View style={styles.rules}>
        {rules.map((rule) => (
          <View key={rule.label} style={styles.rule} accessible accessibilityLabel={rule.label} accessibilityState={{ checked: rule.met }}>
            <Ionicons name={rule.met ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={rule.met ? colors.accentGreen : colors.inkFaint} />
            <Text style={[styles.ruleText, rule.met && styles.ruleTextMet]}>{rule.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 5, borderRadius: 2.5, backgroundColor: colors.lineSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2.5 },
  label: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.semibold },
  rules: { gap: 5 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontFamily: fontFamily.regular, color: colors.inkSoft },
  ruleTextMet: { color: colors.ink },
});
