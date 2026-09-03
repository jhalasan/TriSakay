import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSavedPlacesStore } from '../../src/store/useSavedPlacesStore';
import { SHORTCUT_ICON_TONE, DEFAULT_SHORTCUT_TONE } from '../../src/utils/savedPlaceIconTone';
import type { SavedPlaceIcon, SavedPlaceRow } from '@trisakay/services';
import { styles } from '../../src/styles/saved-places/manage.styles';

export default function ManageSavedPlacesScreen() {
  const router = useRouter();
  const t = useTranslation();
  const items = useSavedPlacesStore((state) => state.items);
  const loading = useSavedPlacesStore((state) => state.loading);
  const error = useSavedPlacesStore((state) => state.error);
  const load = useSavedPlacesStore((state) => state.load);
  const remove = useSavedPlacesStore((state) => state.remove);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function performDelete(id: string) {
    const { error: deleteError } = await remove(id);
    if (deleteError) Alert.alert(t.home.savedPlacesErrorTitle, deleteError);
  }

  function handleDelete(item: SavedPlaceRow) {
    Alert.alert(t.home.deleteSavedPlaceTitle, t.home.deleteSavedPlaceMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void performDelete(item.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t.savedPlacesManagement.title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>{t.savedPlacesManagement.intro}</Text>
        {loading && items.length === 0 ? (
          <Spinner size="small" />
        ) : error ? (
          <EmptyState title={t.home.savedPlacesErrorTitle} message={t.home.savedPlacesErrorMessage} />
        ) : items.length === 0 ? (
          <EmptyState title={t.savedPlacesManagement.emptyTitle} message={t.savedPlacesManagement.emptyMessage} />
        ) : (
          items.map((item) => {
            const tone = SHORTCUT_ICON_TONE[item.icon] ?? DEFAULT_SHORTCUT_TONE;
            return (
              <View key={item.id} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: tone.bg }]}>
                  <Ionicons name={item.icon as SavedPlaceIcon} size={20} color={tone.icon} />
                </View>
                <View style={styles.textSlot}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.address} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.savedPlacesManagement.removeAccessibilityLabel.replace('{label}', item.label)}
                  style={styles.removeButton}
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            );
          })
        )}
        <Pressable
          accessibilityRole="button"
          style={styles.addRow}
          onPress={() => router.push('/booking/set-pickup')}
        >
          <Ionicons name="add" size={18} color={colors.accentBlue} />
          <Text style={styles.addRowLabel}>{t.savedPlacesManagement.addFromMap}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
