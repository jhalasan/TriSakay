import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateAvatarUrl, updateProfile, uploadAvatar } from '@trisakay/services';
import { Avatar, BrandMotif, Card, GradientSurface, ListRow, StarRating, TextField, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useVerificationStore } from '../../src/store/useVerificationStore';
import { styles } from '../../src/styles/tabs/profile.styles';

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
          <BrandMotif size={180} color={colors.white} opacity={0.1} style={styles.motif} />
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>{t.driver.profile.title}</Text>
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
                <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={16} color={colors.white} />
              )}
            </Pressable>
          </View>
        </GradientSurface>

        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.driver.profile.changePhoto}
            style={styles.avatarWrap}
            disabled={uploadingAvatar}
            onPress={handleChangeAvatar}
          >
            <View style={styles.avatarRing}>
              <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
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
              <View style={styles.nameRow}>
                <Text style={styles.name}>{name || t.driver.profile.driverFallback}</Text>
                {isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.accentGreen} />
                    <Text style={styles.verifiedBadgeText}>{t.driver.profile.verified}</Text>
                  </View>
                )}
              </View>
              {ratingCount > 0 && rating !== null && (
                <Pressable
                  style={styles.ratingPill}
                  onPress={() => router.push('/ratings')}
                  accessibilityRole="button"
                  accessibilityLabel={t.driver.profile.viewMyRatings}
                >
                  <StarRating value={Math.round(rating)} size={14} />
                  <Text style={styles.ratingPillText}>
                    {rating.toFixed(1)} ({ratingCount})
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Ionicons name="mail-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.detailLabel}>{t.driver.profile.email}</Text>
            </View>
            <Text style={styles.detailValue} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Ionicons name="call-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.detailLabel}>{t.driver.profile.phone}</Text>
            </View>
            {isEditing ? (
              <TextField
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder={t.driver.profile.phonePlaceholder}
              />
            ) : (
              <Text style={styles.detailValue}>{user?.phone ?? '—'}</Text>
            )}
          </View>
        </Card>

        <Card style={styles.navGroup}>
          <ListRow
            title={t.driver.profile.myRatings}
            leading={<Ionicons name="star-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/ratings')}
            chevron
          />
          <ListRow
            title={t.driver.profile.complaints}
            leading={<Ionicons name="alert-circle-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/complaints')}
            chevron
          />
          <ListRow
            title={t.driver.profile.settings}
            leading={<Ionicons name="settings-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/profile/settings')}
            chevron
            divider={false}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
