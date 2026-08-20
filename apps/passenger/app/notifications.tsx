import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, colors } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import type { NotificationItem } from '../src/types/notification';
import { styles } from '../src/styles/notifications.styles';

type FilterMode = 'all' | 'unread' | 'rides';

const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: 'all', label: 'All' },
  { mode: 'unread', label: 'Unread' },
  { mode: 'rides', label: 'Rides' },
];

const TYPE_ICON: Record<NotificationItem['type'], keyof typeof Ionicons.glyphMap> = {
  ride_status: 'location',
  payment_status: 'checkmark-circle',
  discount_status: 'pricetag',
  complaint_status: 'chatbubble-ellipses',
  verification_status: 'shield-checkmark',
  franchise_expiring: 'alert-circle',
  emergency_alert: 'warning',
};

const TYPE_TONE: Record<NotificationItem['type'], { bg: string; fg: string }> = {
  ride_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  payment_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  discount_status: { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed },
  verification_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  complaint_status: { bg: colors.dangerSoft, fg: colors.dangerPressed },
  franchise_expiring: { bg: colors.dangerSoft, fg: colors.dangerPressed },
  emergency_alert: { bg: colors.dangerSoft, fg: colors.dangerPressed },
};

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function NotificationCard({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const tone = TYPE_TONE[item.type];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      style={[styles.card, !item.read && styles.cardUnread]}
    >
      <View style={[styles.iconBadge, { backgroundColor: tone.bg }]}>
        <Ionicons name={TYPE_ICON[item.type]} size={18} color={tone.fg} />
      </View>
      <View style={styles.textSlot}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.date}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const items = useNotificationsStore((state) => state.items);
  const error = useNotificationsStore((state) => state.error);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const markRead = useNotificationsStore((state) => state.markRead);
  const [filter, setFilter] = useState<FilterMode>('all');

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.read);
    if (filter === 'rides') return items.filter((item) => item.type === 'ride_status');
    return items;
  }, [items, filter]);

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

      <View style={styles.taglineRow}>
        <Text style={styles.tagline}>Stay updated with your ride activities</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>
              {unreadCount} new
            </Text>
          </View>
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(({ mode, label }) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${label}`}
            onPress={() => setFilter(mode)}
            style={[styles.filterChip, filter === mode && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === mode && styles.filterChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="You're all caught up" message="No notifications yet." />}
        renderItem={({ item }) => (
          <NotificationCard item={item} onPress={() => (!item.read ? void markRead(item.id) : undefined)} />
        )}
      />
    </View>
  );
}
