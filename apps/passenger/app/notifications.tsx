import { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, colors } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import { useTranslation } from '../src/hooks/useTranslation';
import type { NotificationItem } from '../src/types/notification';
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
  settlement_notice: 'wallet',
};

const TYPE_TONE: Record<NotificationItem['type'], { bg: string; fg: string; accent: string }> = {
  ride_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
  payment_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
  discount_status: { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed, accent: colors.accentGreen },
  verification_status: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
  complaint_status: { bg: colors.dangerSoft, fg: colors.dangerPressed, accent: colors.danger },
  franchise_expiring: { bg: colors.dangerSoft, fg: colors.dangerPressed, accent: colors.danger },
  emergency_alert: { bg: colors.dangerSoft, fg: colors.dangerPressed, accent: colors.danger },
  settlement_notice: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed, accent: colors.accentBlue },
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function NotificationCard({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const tone = TYPE_TONE[item.type];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      style={[styles.card, !item.read && { borderLeftColor: tone.accent }]}
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
  const t = useTranslation();
  const items = useNotificationsStore((state) => state.items);
  const error = useNotificationsStore((state) => state.error);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const markRead = useNotificationsStore((state) => state.markRead);
  const [filter, setFilter] = useState<FilterMode>('all');

  const FILTERS: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: t.notifications.filterAll },
    { mode: 'unread', label: t.notifications.filterUnread },
    { mode: 'rides', label: t.notifications.filterRides },
  ];

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.read);
    if (filter === 'rides') return items.filter((item) => item.type === 'ride_status');
    return items;
  }, [items, filter]);

  const sections = useMemo(() => {
    const today = startOfDay(new Date());
    const grouped: { title: string; data: NotificationItem[] }[] = [];
    for (const item of filteredItems) {
      const diffDays = Math.round((today - startOfDay(new Date(item.createdAt))) / 86400000);
      const label =
        diffDays === 0
          ? t.notifications.today
          : diffDays === 1
            ? t.notifications.yesterday
            : new Date(item.createdAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' });
      const lastGroup = grouped[grouped.length - 1];
      if (lastGroup && lastGroup.title === label) {
        lastGroup.data.push(item);
      } else {
        grouped.push({ title: label, data: [item] });
      }
    }
    return grouped;
  }, [filteredItems, t]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t.notifications.title}
        right={
          <Text style={styles.markReadText} onPress={markAllRead}>
            {t.notifications.markAllRead}
          </Text>
        }
      />

      <View style={styles.taglineRow}>
        <Text style={styles.tagline}>{t.notifications.tagline}</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>
              {unreadCount} {t.notifications.newSuffix}
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

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<EmptyState title={t.notifications.emptyTitle} message={t.notifications.emptyMessage} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <NotificationCard item={item} onPress={() => (!item.read ? void markRead(item.id) : undefined)} />
        )}
      />
    </View>
  );
}
