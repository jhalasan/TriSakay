import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateAvatarUrl, updateProfile, uploadAvatar } from '@trisakay/services';
import { Avatar, BrandMotif, Card, GradientSurface, ListRow, TextField, colors } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { styles } from '../../src/styles/tabs/profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleToggleEdit() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({ fullName: name });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error);
      return;
    }
    setIsEditing(false);
  }

  async function handleChangeAvatar() {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile picture.');
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
        Alert.alert('Could not upload photo', error ?? 'Please try again.');
        return;
      }
      const { error: profileError } = await updateAvatarUrl(publicUrl);
      if (profileError) {
        Alert.alert('Could not save photo', profileError);
        return;
      }
      await refreshProfile();
    } catch (err) {
      Alert.alert('Could not upload photo', err instanceof Error ? err.message : 'Please try again.');
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
            <Text style={styles.heroLabel}>Profile</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isEditing ? 'Save changes' : 'Edit profile'}
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
            accessibilityLabel="Change profile photo"
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
            <Text style={styles.name}>{name || 'Rider'}</Text>
          )}
        </View>

        <Card style={styles.detailsCard}>
          <View style={styles.detailCol}>
            <View style={styles.detailLabelRow}>
              <Ionicons name="mail-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.detailLabel}>Email</Text>
            </View>
            <Text style={styles.detailValue} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <View style={styles.detailLabelRow}>
              <Ionicons name="call-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.detailLabel}>Phone</Text>
            </View>
            <Text style={styles.detailValue}>{user?.phone ?? '—'}</Text>
          </View>
        </Card>

        <Card style={styles.navGroup}>
          <ListRow
            title="Payment methods"
            leading={<Ionicons name="card-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/profile/payment-methods')}
            chevron
          />
          <ListRow
            title="Fare discount"
            leading={<Ionicons name="pricetag-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/profile/apply-discount')}
            chevron
          />
          <ListRow
            title="Settings"
            leading={<Ionicons name="settings-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/(tabs)/settings')}
            chevron
            divider={false}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
