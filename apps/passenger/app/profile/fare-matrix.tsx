import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getFareConfig, type FareConfig } from '@trisakay/services';
import { BrandMotif, Card, GradientSurface, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/fare-matrix.styles';

export default function FareMatrixScreen() {
  const router = useRouter();
  const t = useTranslation();
  const [config, setConfig] = useState<FareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFareConfig().then((result) => {
      if (cancelled) return;
      setConfig(result.data);
      setError(result.data ? null : (result.error ?? t.accountPages.couldNotLoadFareMatrix));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.accountPages.fareMatrixTitle} />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.accountPages.fareMatrixTitle} />
      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {config && (
          <>
            <View style={styles.ordinanceShadowWrap}>
              <GradientSurface token="hero" direction="diagonal" style={styles.ordinanceCard}>
                <BrandMotif size={150} color={colors.white} opacity={0.12} style={styles.ordinanceMotif} />
                <Text style={styles.ordinanceLabel}>{t.accountPages.regulatedUnder}</Text>
                <Text style={styles.ordinanceValue}>{config.ordinanceRef ?? t.accountPages.defaultOrdinance}</Text>
              </GradientSurface>
            </View>

            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{t.accountPages.regularFare}</Text>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>
                  {t.accountPages.firstKmPrefix} {config.baseKm} {t.accountPages.kmSuffix}
                </Text>
                <Text style={styles.ruleValue}>₱{config.baseFare.toFixed(2)}</Text>
              </View>
              <View style={styles.ruleDivider} />
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>{t.accountPages.everyKmAfter}</Text>
                <Text style={styles.ruleValue}>
                  +₱{config.ratePerKm.toFixed(2)}
                  {t.accountPages.perKmSuffix}
                </Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.discountHeaderRow}>
                <View style={styles.discountIconTile}>
                  <Ionicons name="pricetag" size={16} color={colors.accentGreenPressed} />
                </View>
                <Text style={styles.sectionLabel}>{t.accountPages.discountedFare}</Text>
              </View>
              <Text style={styles.bodyText}>
                {t.accountPages.discountedFareBodyPrefix}{' '}
                <Text style={styles.discountPercentText}>{config.discountRatePercent}%</Text>{' '}
                {t.accountPages.discountedFareBodySuffix}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/profile/apply-discount')}>
                <Text style={styles.discountLink}>{t.accountPages.applyForFareDiscount}</Text>
              </Pressable>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{t.accountPages.howFareEstimated}</Text>
              <Text style={styles.bodyText}>{t.accountPages.howFareEstimatedBody}</Text>
            </Card>

            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} style={styles.noticeIcon} />
              <Text style={styles.noticeText}>{t.accountPages.routeEstimateNotice}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
