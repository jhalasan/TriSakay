import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateAvatarUrl, updateProfile, uploadAvatar } from '@trisakay/services';
import { Avatar, Button, Card, ListRow, TextField, colors } from '@trisakay/ui';
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
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Button
            label={isEditing ? 'Done' : 'Edit'}
            size="sm"
            variant="outline"
            tone="neutral"
            loading={saving}
            onPress={handleToggleEdit}
          />
        </View>

        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarWrap}
            disabled={uploadingAvatar}
            onPress={handleChangeAvatar}
          >
            <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
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
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{user?.phone ?? '—'}</Text>
          </View>
        </Card>

        <Card style={styles.navGroup}>
          <ListRow title="Payment methods" onPress={() => router.push('/profile/payment-methods')} chevron />
          <ListRow title="Fare discount" onPress={() => router.push('/profile/apply-discount')} chevron />
          <ListRow
            title="Settings"
            onPress={() => router.push('/(tabs)/settings')}
            chevron
            divider={false}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
