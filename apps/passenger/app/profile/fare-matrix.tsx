import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getFareConfig, type FareConfig } from '@trisakay/services';
import { Card, Spinner } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { styles } from '../../src/styles/profile/fare-matrix.styles';

export default function FareMatrixScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<FareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFareConfig().then((result) => {
      if (cancelled) return;
      setConfig(result.data);
      setError(result.data ? null : (result.error ?? 'Could not load the fare matrix.'));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Fare matrix" />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Fare matrix" />
      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {config && (
          <>
            <Card style={styles.card}>
              <Text style={styles.ordinanceLabel}>Regulated under</Text>
              <Text style={styles.ordinanceValue}>{config.ordinanceRef ?? 'City tricycle fare ordinance'}</Text>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>Regular fare</Text>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>First {config.baseKm} km</Text>
                <Text style={styles.ruleValue}>₱{config.baseFare.toFixed(2)}</Text>
              </View>
              <View style={styles.ruleDivider} />
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>Every km after</Text>
                <Text style={styles.ruleValue}>+₱{config.ratePerKm.toFixed(2)}/km</Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>Discounted fare</Text>
              <Text style={styles.bodyText}>
                Approved Senior Citizen, PWD, and student riders get {config.discountRatePercent}% off
                the regular fare, applied automatically once approved.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/profile/apply-discount')}
              >
                <Text style={styles.discountLink}>Apply for a fare discount</Text>
              </Pressable>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>How your fare is estimated</Text>
              <Text style={styles.bodyText}>
                The fare is charged per seat booked and based on the road distance between pickup
                and drop-off, following the rule above.
              </Text>
            </Card>

            <Text style={styles.disclaimer}>
              The displayed route and distance are estimates. Actual tricycle routes may differ,
              which can affect the final fare confirmed at drop-off.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
