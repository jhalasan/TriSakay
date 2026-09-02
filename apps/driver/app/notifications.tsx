import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, colors } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTranslation } from '../src/hooks/useTranslation';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import type { NotificationItem } from '../src/types/notification';
import { interpolate } from '../src/utils/interpolate';
import { styles } from '../src/styles/notifications.styles';

type FilterMode = 'all' | 'unread' | 'rides';

const TYPE_ICON: Record<NotificationItem['type'], keyof typeof Ionicons.glyphMap> = {
  ride_status: 'location',
  payment_status: 'checkmark-circle',
  discount_status: 'pricetag',
  complaint_status: 'chatbubble-ellipses',
  verification_status: 'shield-checkmark',
  franchise_expiring: 'alert-circle',
  emergency_alert: 'warning',
};

const TYPE_TONE: Record<NotificationItem['type'], { bg: string; fg: string; accent: string }> = {
  ride_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
  payment_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
  discount_status: { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed, accent: colors.accentGreen },
  verification_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
  complaint_status: { bg: colors.dangerSoft, fg: colors.dangerPressed, accent: colors.danger },
  franchise_expiring: { bg: colors.dangerSoft, fg: colors.dangerPressed, accent: colors.danger },
  emergency_alert: { bg: colors.dangerSoft, fg: colors.dangerPressed, accent: colors.danger },
};

export default function NotificationsScreen() {
  const t = useTranslation();
  const items = useNotificationsStore((state) => state.items);
  const error = useNotificationsStore((state) => state.error);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const markRead = useNotificationsStore((state) => state.markRead);
  const [filter, setFilter] = useState<FilterMode>('all');

  const FILTERS: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: t.driver.notifications.filterAll },
    { mode: 'unread', label: t.driver.notifications.filterUnread },
    { mode: 'rides', label: t.driver.notifications.filterRides },
  ];

  function formatRelativeTime(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return t.driver.notifications.justNow;
    if (minutes < 60) {
      return interpolate(minutes === 1 ? t.driver.notifications.minuteAgo : t.driver.notifications.minutesAgo, { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return interpolate(hours === 1 ? t.driver.notifications.hourAgo : t.driver.notifications.hoursAgo, { count: hours });
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return interpolate(days === 1 ? t.driver.notifications.dayAgo : t.driver.notifications.daysAgo, { count: days });
    }
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  function NotificationCard({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
    const tone = item.read ? { bg: colors.fill, fg: colors.inkSoft, accent: 'transparent' } : TYPE_TONE[item.type];

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.title}
        onPress={onPress}
        style={[styles.card, !item.read && { borderLeftColor: tone.accent }, item.read && styles.cardRead]}
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

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.read);
    if (filter === 'rides') return items.filter((item) => item.type === 'ride_status');
    return items;
  }, [items, filter]);

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

      <View style={styles.taglineRow}>
        <Text style={styles.tagline}>{t.driver.notifications.tagline}</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{interpolate(t.driver.notifications.newCount, { count: unreadCount })}</Text>
          </View>
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(({ mode, label }) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={interpolate(t.driver.notifications.filterAccessibilityLabel, { label })}
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
        ListEmptyComponent={<EmptyState title={t.driver.notifications.emptyTitle} message={t.driver.notifications.emptyMessage} />}
        renderItem={({ item }) => (
          <NotificationCard item={item} onPress={() => (!item.read ? void markRead(item.id) : undefined)} />
        )}
      />
    </View>
  );
}
