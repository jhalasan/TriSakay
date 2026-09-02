import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateAvatarUrl, updateProfile, uploadAvatar, type DiscountCategory } from '@trisakay/services';
import { Avatar, BrandMotif, Card, GradientSurface, ListRow, TextField, colors } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePassengerStats } from '../../src/hooks/usePassengerStats';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/tabs/profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const { stats } = usePassengerStats();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const CATEGORY_LABEL: Record<DiscountCategory, string> = {
    senior_citizen: t.accountPages.categorySeniorFull,
    pwd: t.accountPages.categoryPwd,
    student: t.accountPages.categoryStudent,
  };

  async function handleToggleEdit() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({ fullName: name, phone });
    setSaving(false);
    if (error) {
      Alert.alert(t.profile.couldNotSaveTitle, error);
      return;
    }
    setIsEditing(false);
  }

  async function handleChangeAvatar() {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.profile.photoPermissionTitle, t.profile.photoPermissionMessage);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      // `fetch(uri).arrayBuffer()` on a local picker URI is unreliable on RN
      // (silently empty on some Android setups) — reading through `File` is
      // the platform-native path for local file bytes.
      const bytes = await new File(result.assets[0].uri).arrayBuffer();
      const { publicUrl, error } = await uploadAvatar({ userId: user.id, data: bytes });
      if (!publicUrl) {
        Alert.alert(t.profile.couldNotUploadPhotoTitle, error ?? t.profile.tryAgainFallback);
        return;
      }
      const { error: profileError } = await updateAvatarUrl(publicUrl);
      if (profileError) {
        Alert.alert(t.profile.couldNotSavePhotoTitle, profileError);
        return;
      }
      await refreshProfile();
    } catch (err) {
      Alert.alert(t.profile.couldNotUploadPhotoTitle, err instanceof Error ? err.message : t.profile.tryAgainFallback);
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroShadowWrap}>
          <GradientSurface token="hero" direction="diagonal" style={styles.heroPanel}>
            <BrandMotif size={230} color={colors.white} opacity={0.12} style={styles.motif} />
            <SafeAreaView edges={['top']}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroEyebrow}>{t.profile.eyebrow}</Text>
                  <Text style={styles.heroTitle}>{t.profile.title}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isEditing ? t.profile.save : t.profile.edit}
                  style={styles.editButton}
                  disabled={saving}
                  onPress={handleToggleEdit}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={14} color={colors.white} />
                  )}
                  <Text style={styles.editButtonLabel}>{isEditing ? t.profile.save : t.profile.edit}</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </GradientSurface>
        </View>

        <View style={styles.content}>
          <View style={styles.identity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              style={styles.avatarWrap}
              disabled={uploadingAvatar}
              onPress={handleChangeAvatar}
            >
              <View style={styles.avatarRing}>
                <View style={styles.avatarInnerRing}>
                  <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
                </View>
              </View>
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={14} color={colors.white} />
                )}
              </View>
            </Pressable>
            {isEditing ? (
              <View style={styles.editFieldWrap}>
                <TextField value={name} onChangeText={setName} autoCapitalize="words" />
              </View>
            ) : (
              <>
                <Text style={styles.name}>{name || t.profile.riderFallback}</Text>
                {stats && (
                  <View style={styles.ridesRow}>
                    <Text style={styles.ridesText}>
                      {stats.trips} {t.profile.ridesSuffix}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {stats?.discount ? (
            <GradientSurface solid={colors.accentGreen} style={styles.discountBanner}>
              <BrandMotif size={100} color={colors.white} opacity={0.14} style={styles.discountBannerMotif} />
              <View style={[styles.discountIconTile, styles.discountIconTileActive]}>
                <Ionicons name="pricetag" size={20} color={colors.white} />
              </View>
              <View style={styles.discountTextSlot}>
                <Text style={styles.discountTitle}>
                  {CATEGORY_LABEL[stats.discount.category]} {t.profile.discountActiveSuffix}
                </Text>
                <Text style={styles.discountSubtitle}>
                  {stats.discount.ratePercent}% {t.accountPages.fareDiscountBannerSuffix}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.white} />
            </GradientSurface>
          ) : (
            <Pressable
              accessibilityRole="button"
              style={[styles.discountBanner, styles.discountBannerNeutral]}
              onPress={() => router.push('/profile/apply-discount')}
            >
              <View style={[styles.discountIconTile, styles.discountIconTileNeutral]}>
                <Ionicons name="pricetag-outline" size={20} color={colors.accentBluePressed} />
              </View>
              <View style={styles.discountTextSlot}>
                <Text style={[styles.discountTitle, styles.discountTitleNeutral]}>{t.profile.applyForDiscountTitle}</Text>
                <Text style={[styles.discountSubtitle, styles.discountSubtitleNeutral]}>
                  {t.accountPages.fareDiscountBannerSubtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </Pressable>
          )}

          <Card variant="raised" style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconTile}>
                <Ionicons name="mail-outline" size={16} color={colors.accentBluePressed} />
              </View>
              <View style={styles.detailTextSlot}>
                <Text style={styles.detailLabel}>{t.profile.email}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
              </View>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <View style={styles.detailIconTile}>
                <Ionicons name="call-outline" size={16} color={colors.accentBluePressed} />
              </View>
              {isEditing ? (
                <View style={styles.detailEditWrap}>
                  <TextField
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder={t.profile.phonePlaceholder}
                  />
                </View>
              ) : (
                <View style={styles.detailTextSlot}>
                  <Text style={styles.detailLabel}>{t.profile.phone}</Text>
                  <Text style={styles.detailValue}>{user?.phone ?? '—'}</Text>
                </View>
              )}
            </View>
          </Card>

          <View>
            <Text style={styles.sectionLabel}>{t.profile.eyebrow}</Text>
            <Card variant="raised" style={styles.navGroup}>
              <ListRow
                title={t.profile.paymentMethods}
                leading={
                  <View style={styles.navIconTile}>
                    <Ionicons name="card-outline" size={18} color={colors.accentBluePressed} />
                  </View>
                }
                onPress={() => router.push('/profile/payment-methods')}
                chevron
              />
              <ListRow
                title={t.profile.fareMatrix}
                leading={
                  <View style={styles.navIconTile}>
                    <Ionicons name="receipt-outline" size={18} color={colors.accentBluePressed} />
                  </View>
                }
                onPress={() => router.push('/profile/fare-matrix')}
                chevron
              />
              <ListRow
                title={t.profile.settingsRow}
                leading={
                  <View style={styles.navIconTile}>
                    <Ionicons name="settings-outline" size={18} color={colors.accentBluePressed} />
                  </View>
                }
                onPress={() => router.push('/(tabs)/settings')}
                chevron
                divider={false}
              />
            </Card>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
