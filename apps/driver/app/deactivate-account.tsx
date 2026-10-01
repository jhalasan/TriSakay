import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconTile, colors } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { styles } from '../src/styles/deactivate-account.styles';

/** Driver counterpart of the passenger deactivation page: reversible, refused while a trip is in progress. */
export default function DeactivateAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const d = t.auth.deactivateAccount;
  const deactivateAccount = useAuthStore((state) => state.deactivateAccount);
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!understood || submitting) return;
    setSubmitting(true);
    setError(null);
    const failure = await deactivateAccount();
    setSubmitting(false);

    if (failure) {
      setError(failure || d.errorFallback);
      return;
    }

    router.dismiss();
  }

  const facts = [
    { icon: 'close' as const, tone: 'red' as const, title: t.accountMgmt.driverFactBookTitle, sub: d.factBookSub },
    { icon: 'checkmark' as const, tone: 'green' as const, title: d.factHistoryTitle, sub: d.factHistorySub },
    { icon: 'location' as const, tone: 'navy' as const, title: d.factReactivateTitle, sub: d.factReactivateSub },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={d.closeA11y} onPress={() => router.dismiss()} style={styles.closeTile}>
          <Ionicons name="close" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introTile}>
            <Ionicons name="alert-circle" size={26} color={colors.danger} />
          </View>
          <Text style={styles.title}>{d.title}</Text>
          <Text style={styles.sub}>{d.intro}</Text>
        </View>

        <View style={styles.facts}>
          {facts.map((fact, index) => (
            <View key={fact.title} style={[styles.factRow, index > 0 && styles.factDivider]}>
              <IconTile icon={fact.icon} tone={fact.tone} size={34} />
              <View style={styles.factBody}>
                <Text style={styles.factTitle}>{fact.title}</Text>
                <Text style={styles.factSub}>{fact.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: understood }}
          onPress={() => setUnderstood((value) => !value)}
          style={[styles.checkRow, understood && styles.checkRowChecked]}
        >
          <View style={[styles.box, understood && styles.boxChecked]}>
            {understood && <Ionicons name="checkmark" size={12} color={colors.white} />}
          </View>
          <Text style={styles.checkText}>{d.understand}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
        {error && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Button label={d.confirm} tone="danger" fullWidth disabled={!understood} loading={submitting} onPress={handleConfirm} />
        <Pressable accessibilityRole="button" onPress={() => router.dismiss()} style={styles.keepButton}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3} style={styles.keepText}>{d.keepAccount}</Text>
        </Pressable>
      </View>
    </View>
  );
}
