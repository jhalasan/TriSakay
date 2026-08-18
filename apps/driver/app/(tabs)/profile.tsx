import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from '@trisakay/services';
import { Avatar, BrandMotif, Card, GradientSurface, ListRow, StarRating, TextField, colors } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useVerificationStore } from '../../src/store/useVerificationStore';
import { styles } from '../../src/styles/tabs/profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const isVerified = useVerificationStore((state) => state.status === 'approved');

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

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
    await useAuthStore.getState().refreshProfile();
    setIsEditing(false);
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
          <View style={styles.avatarRing}>
            <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
          </View>
          {isEditing ? (
            <View style={styles.editFieldWrap}>
              <TextField value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
          ) : (
            <>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{name || 'Driver'}</Text>
                {isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.accentGreen} />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                )}
              </View>
              {ratingCount > 0 && rating !== null && (
                <View style={styles.ratingPill}>
                  <StarRating value={Math.round(rating)} size={14} />
                  <Text style={styles.ratingPillText}>
                    {rating.toFixed(1)} ({ratingCount})
                  </Text>
                </View>
              )}
            </>
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
            title="Complaints"
            leading={<Ionicons name="alert-circle-outline" size={20} color={colors.accentBlue} />}
            onPress={() => router.push('/complaints')}
            chevron
          />
          <ListRow
            title="Settings"
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
