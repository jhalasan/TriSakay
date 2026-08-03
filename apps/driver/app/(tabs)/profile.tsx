import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, ListRow, StarRating, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { styles } from '../../src/styles/tabs/profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleToggleEdit() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setSaving(true);
    const { updateProfile } = await import('@trisakay/services');
    const { error } = await updateProfile({ fullName: name });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error);
      return;
    }
    await useAuthStore.getState().refreshProfile();
    setIsEditing(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Button label={isEditing ? 'Done' : 'Edit'} size="sm" variant="outline" tone="neutral" loading={saving} onPress={handleToggleEdit} />
        </View>

        <View style={styles.identity}>
          <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
          {isEditing ? (
            <View style={styles.editFieldWrap}>
              <TextField value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
          ) : (
            <>
              <Text style={styles.name}>{name || 'Driver'}</Text>
              {ratingCount > 0 && rating !== null && <StarRating value={Math.round(rating)} size={18} />}
            </>
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
          <ListRow title="Documents & tricycle info" onPress={() => router.push('/profile/documents')} chevron />
          <ListRow title="Settings" onPress={() => router.push('/profile/settings')} chevron divider={false} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
