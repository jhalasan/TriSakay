import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { applyForDiscount, getFareDiscountRate, getMyDiscount } from '@trisakay/services';
import type { DiscountCategory, PassengerDiscount } from '@trisakay/services';
import { Badge, BrandMotif, Button, Card, GradientSurface, SegmentedControl, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/apply-discount.styles';

export default function ApplyDiscountScreen() {
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PassengerDiscount | null>(null);
  const [discountRatePercent, setDiscountRatePercent] = useState<number | null>(null);
  const [category, setCategory] = useState<DiscountCategory>('senior_citizen');
  const [frontPhotoUri, setFrontPhotoUri] = useState<string | null>(null);
  const [backPhotoUri, setBackPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const CATEGORY_OPTIONS: { label: string; value: DiscountCategory }[] = [
    { label: t.accountPages.categorySenior, value: 'senior_citizen' },
    { label: t.accountPages.categoryPwd, value: 'pwd' },
    { label: t.accountPages.categoryStudent, value: 'student' },
  ];
  const CATEGORY_LABEL: Record<DiscountCategory, string> = {
    senior_citizen: t.accountPages.categorySeniorFull,
    pwd: t.accountPages.categoryPwd,
    student: t.accountPages.categoryStudent,
  };

  function refresh() {
    return getMyDiscount().then((result) => setExisting(result.data));
  }

  const { refreshing, onRefresh } = usePullToRefresh(refresh);

  useEffect(() => {
    let cancelled = false;
    Promise.all([refresh(), getFareDiscountRate().then((result) => setDiscountRatePercent(result.discountRatePercent))])
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePickPhoto(side: 'front' | 'back') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.accountPages.permissionNeededTitle, t.accountPages.permissionNeededMessage);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    if (side === 'front') setFrontPhotoUri(result.assets[0].uri);
    else setBackPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!user) return;
    if (!frontPhotoUri || !backPhotoUri) {
      setFormError(t.accountPages.photoRequiredError);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const { error } = await applyForDiscount({
      userId: user.id,
      category,
      frontUri: frontPhotoUri,
      backUri: backPhotoUri,
    });
    if (error) {
      setSubmitting(false);
      setFormError(error);
      return;
    }
    await refresh();
    setSubmitting(false);
    setFrontPhotoUri(null);
    setBackPhotoUri(null);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.accountPages.fareDiscountTitle} />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.accountPages.fareDiscountTitle} />
        <View style={styles.content}>
          <Card style={[styles.card, styles.statusCard]}>
            <Badge
              label={existing.status === 'approved' ? t.accountPages.statusApproved : t.accountPages.statusPendingReview}
              tone={existing.status === 'approved' ? 'green' : 'blue'}
            />
            <Text style={styles.statusTitle}>{CATEGORY_LABEL[existing.category]}</Text>
            <Text style={styles.statusNote}>
              {existing.status === 'approved' ? t.accountPages.statusApprovedNote : t.accountPages.statusPendingNote}
            </Text>
          </Card>
        </View>
      </View>
    );
  }

  const idSlot = (
    side: 'front' | 'back',
    uri: string | null,
    onPress: () => void
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uri ? `Change ${side} ID photo` : `Add ${side} ID photo`}
      style={[styles.idSlot, uri ? styles.idSlotFilled : styles.idSlotEmpty]}
      onPress={onPress}
    >
      <Ionicons name="card-outline" size={34} color={uri ? colors.accentBluePressed : colors.inkSoft} style={{ opacity: uri ? 0.55 : 1 }} />
      <View style={styles.idSlotTextSlot}>
        <Text style={styles.idSlotTitle}>
          {uri
            ? side === 'front'
              ? t.accountPages.idFrontCapturedTitle
              : t.accountPages.idBackCapturedTitle
            : side === 'front'
              ? t.accountPages.idFrontEmptyTitle
              : t.accountPages.idBackEmptyTitle}
        </Text>
        <Text style={styles.idSlotSubtitle}>{uri ? t.accountPages.idCapturedSubtitle : t.accountPages.idEmptySubtitle}</Text>
      </View>
      {uri ? (
        <View style={styles.idSlotCheck}>
          <Ionicons name="checkmark" size={12} color={colors.white} />
        </View>
      ) : (
        <Ionicons name="camera-outline" size={20} color={colors.inkSoft} />
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.accountPages.fareDiscountTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
      >
        <GradientSurface solid={colors.accentGreen} style={styles.banner}>
          <BrandMotif size={130} color={colors.white} opacity={0.14} style={styles.bannerMotif} />
          <View style={styles.bannerIconTile}>
            <Ionicons name="pricetag" size={22} color={colors.white} />
          </View>
          <View style={styles.bannerTextSlot}>
            <Text style={styles.bannerTitle}>
              {discountRatePercent ?? 20}% {t.accountPages.fareDiscountBannerSuffix}
            </Text>
            <Text style={styles.bannerSubtitle}>{t.accountPages.fareDiscountBannerSubtitle}</Text>
          </View>
        </GradientSurface>

        <Text style={styles.intro}>{t.accountPages.fareDiscountIntro}</Text>

        {existing?.status === 'rejected' && (
          <Card style={[styles.card, styles.statusCard]}>
            <Badge label={t.accountPages.statusRejectedBadge} tone="danger" />
            {existing.remarks && (
              <>
                <Text style={styles.remarksLabel}>{t.accountPages.reviewerNote}</Text>
                <Text style={styles.remarksBody}>{existing.remarks}</Text>
              </>
            )}
            <Text style={styles.statusNote}>{t.accountPages.submitNewApplicationNote}</Text>
          </Card>
        )}

        <View>
          <Text style={styles.sectionLabel}>{t.complaints.category}</Text>
          <SegmentedControl options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </View>

        <View style={styles.idSlotsWrap}>
          <View>
            <Text style={styles.sectionLabel}>{t.accountPages.idFront}</Text>
            {idSlot('front', frontPhotoUri, () => handlePickPhoto('front'))}
          </View>
          <View>
            <Text style={styles.sectionLabel}>{t.accountPages.idBack}</Text>
            {idSlot('back', backPhotoUri, () => handlePickPhoto('back'))}
          </View>
        </View>

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <Button label={t.accountPages.submitApplication} fullWidth loading={submitting} onPress={handleSubmit} />

        <Text style={styles.disclaimer}>{t.accountPages.discountDisclaimer}</Text>
      </ScrollView>
    </View>
  );
}
