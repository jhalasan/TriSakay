import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, ListRow, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { styles } from './profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');

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
            onPress={() => setIsEditing((prev) => !prev)}
          />
        </View>

        <View style={styles.identity}>
          <Avatar name={name} size="xl" />
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
