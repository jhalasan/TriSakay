import { FlatList, Text, View } from 'react-native';
import { EmptyState } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import { styles } from './notifications.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const items = useNotificationsStore((state) => state.items);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notifications"
        right={
          <Text style={styles.markReadText} onPress={markAllRead}>
            Mark all read
          </Text>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="You're all caught up" message="No notifications yet." />}
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
