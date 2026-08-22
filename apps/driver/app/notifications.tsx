import { FlatList, Text, View } from 'react-native';
import { EmptyState } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTranslation } from '../src/hooks/useTranslation';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import { styles } from '../src/styles/notifications.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const t = useTranslation();
  const items = useNotificationsStore((state) => state.items);
  const error = useNotificationsStore((state) => state.error);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t.driver.notifications.title}
        right={
          <Text style={styles.markReadText} onPress={markAllRead}>
            {t.driver.notifications.markAllRead}
          </Text>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title={t.driver.notifications.emptyTitle} message={t.driver.notifications.emptyMessage} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dotSlot}>{!item.read && <View style={styles.unreadDot} />}</View>
            <View style={styles.textSlot}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
