import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateAvatarUrl, updateProfile, uploadAvatar } from '@trisakay/services';
import { Avatar, BrandMotif, GradientSurface, TextField, colors } from '@trisakay/ui';
import { useDriverUnit } from '../../src/hooks/useDriverUnit';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useVerificationStore } from '../../src/store/useVerificationStore';
import { interpolate } from '../../src/utils/interpolate';
import { styles } from '../../src/styles/tabs/profile.styles';

function formatExpiryDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

/**
 * expo-file-system's `File` class is a no-op stub on web — fetch(uri) is the
 * fallback there since the picker's URI is a blob: URL fetch reads fine; on
 * native File is the reliable path (fetch is flaky on some Android setups).
 */
async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export default function ProfileScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const isVerified = useVerificationStore((state) => state.status === 'approved');
  const driverUnit = useDriverUnit();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleToggleEdit() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({ fullName: name, phone });
    setSaving(false);
    if (error) {
      Alert.alert(t.driver.profile.couldNotSaveTitle, error);
      return;
    }
    await refreshProfile();
    setIsEditing(false);
  }

  async function handleChangeAvatar() {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.driver.profile.permissionNeededTitle, t.driver.profile.permissionNeededMessage);
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
      const bytes = await readFileBytes(result.assets[0].uri);
      const { publicUrl, error } = await uploadAvatar({ userId: user.id, data: bytes });
      if (!publicUrl) {
        Alert.alert(t.driver.profile.couldNotUploadPhotoTitle, error ?? t.driver.profile.pleaseTryAgain);
        return;
      }
      const { error: profileError } = await updateAvatarUrl(publicUrl);
      if (profileError) {
        Alert.alert(t.driver.profile.couldNotSavePhotoTitle, profileError);
        return;
      }
      await refreshProfile();
    } catch (err) {
      Alert.alert(t.driver.profile.couldNotUploadPhotoTitle, err instanceof Error ? err.message : t.driver.profile.pleaseTryAgain);
    } finally {
      setUploadingAvatar(false);
    }
  }

  const tricycleLine =
    driverUnit?.plateNo && driverUnit?.bodyNo
      ? `${driverUnit.plateNo} · ${t.driver.dashboard.bodyNoPrefix} ${driverUnit.bodyNo}`
      : driverUnit?.plateNo || (driverUnit?.bodyNo ? `${t.driver.dashboard.bodyNoPrefix} ${driverUnit.bodyNo}` : null);

  const statusLine =
    ratingCount > 0 && rating !== null
      ? interpolate(isVerified ? t.driver.profile.verifiedDriverRating : t.driver.profile.ratingOnly, {
          rating: rating.toFixed(1),
          count: ratingCount,
        })
      : isVerified
        ? t.driver.profile.verified
        : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroShadow}>
          <GradientSurface token="hero" direction="diagonal" texture textureOpacity={0.05} style={styles.heroBand}>
            <BrandMotif size={230} color={colors.white} opacity={0.12} style={styles.motif} />
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroEyebrow}>{t.driver.profile.accountEyebrow}</Text>
                <Text style={styles.heroTitle}>{t.driver.profile.title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isEditing ? t.driver.profile.saveChanges : t.driver.profile.editProfile}
                style={styles.editButton}
                disabled={saving}
                onPress={handleToggleEdit}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={14} color={colors.white} />
                )}
                <Text style={styles.editButtonText}>{isEditing ? t.driver.profile.saveChanges : t.driver.profile.edit}</Text>
              </Pressable>
            </View>
          </GradientSurface>
        </View>

        <View style={styles.content}>
          <View style={styles.identity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.driver.profile.changePhoto}
              style={styles.avatarWrap}
              disabled={uploadingAvatar}
              onPress={handleChangeAvatar}
            >
              <View style={styles.avatarRing}>
                <View style={styles.avatarRingBorder}>
                  <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
                </View>
              </View>
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={15} color={colors.white} />
                )}
              </View>
            </Pressable>
            {isEditing ? (
              <View style={styles.editFieldWrap}>
                <TextField value={name} onChangeText={setName} autoCapitalize="words" />
              </View>
            ) : (
              <>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{name || t.driver.profile.driverFallback}</Text>
                </View>
                {statusLine && (
                  <Pressable
                    style={styles.statusRow}
                    onPress={() => router.push('/ratings')}
                    accessibilityRole="button"
                    accessibilityLabel={t.driver.profile.viewMyRatings}
                  >
                    <Ionicons name="shield-checkmark" size={13} color={colors.accentGreen} />
                    <Text style={styles.statusText}>{statusLine}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconTile}>
                <Ionicons name="mail-outline" size={16} color={colors.accentBluePressed} />
              </View>
              <View style={styles.detailTextSlot}>
                <Text style={styles.detailLabel}>{t.driver.profile.email}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIconTile}>
                <Ionicons name="call-outline" size={16} color={colors.accentBluePressed} />
              </View>
              {isEditing ? (
                <View style={styles.editFieldInlineWrap}>
                  <TextField
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder={t.driver.profile.phonePlaceholder}
                  />
                </View>
              ) : (
                <View style={styles.detailTextSlot}>
                  <Text style={styles.detailLabel}>{t.driver.profile.phone}</Text>
                  <Text style={styles.detailValue}>{user?.phone ?? '—'}</Text>
                </View>
              )}
            </View>
            {tricycleLine && (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <View style={styles.detailIconTile}>
                  <Ionicons name="document-text-outline" size={16} color={colors.accentBluePressed} />
                </View>
                <View style={styles.detailTextSlot}>
                  <Text style={styles.detailLabel}>{t.driver.profile.tricycle}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {tricycleLine}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {driverUnit?.verificationStatus === 'approved' && (
            <View style={styles.franchiseCardShadow}>
              <Pressable
                style={styles.franchiseCard}
                onPress={() => router.push('/profile/settings')}
                accessibilityRole="button"
                accessibilityLabel={t.driver.profile.franchiseVerified}
              >
                <View style={styles.franchiseRow}>
                  <View style={styles.franchiseIconTile}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.white} />
                  </View>
                  <View style={styles.franchiseTextSlot}>
                    <Text style={styles.franchiseTitle}>{t.driver.profile.franchiseVerified}</Text>
                    <Text style={styles.franchiseSubtitle}>
                      {driverUnit.mtopExpiryDate
                        ? interpolate(t.driver.profile.franchiseClearedWithDate, { date: formatExpiryDate(driverUnit.mtopExpiryDate) })
                        : t.driver.profile.franchiseClearedNoDate}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.white} />
                </View>
              </Pressable>
            </View>
          )}

          <View>
            <Text style={styles.sectionLabel}>{t.driver.profile.accountSection}</Text>
            <View style={styles.navGroup}>
              <Pressable style={styles.detailRow} onPress={() => router.push('/ratings')} accessibilityRole="button">
                <View style={styles.navIconTile}>
                  <Ionicons name="star-outline" size={18} color={colors.accentBluePressed} />
                </View>
                <Text style={[styles.detailValue, { flex: 1, marginTop: 0 }]}>{t.driver.profile.myRatings}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
              </Pressable>
              <Pressable style={styles.detailRow} onPress={() => router.push('/complaints')} accessibilityRole="button">
                <View style={styles.navIconTile}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accentBluePressed} />
                </View>
                <Text style={[styles.detailValue, { flex: 1, marginTop: 0 }]}>{t.driver.profile.complaints}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
              </Pressable>
              <Pressable
                style={[styles.detailRow, styles.detailRowLast]}
                onPress={() => router.push('/profile/settings')}
                accessibilityRole="button"
              >
                <View style={styles.navIconTile}>
                  <Ionicons name="settings-outline" size={18} color={colors.accentBluePressed} />
                </View>
                <Text style={[styles.detailValue, { flex: 1, marginTop: 0 }]}>{t.driver.profile.settings}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
