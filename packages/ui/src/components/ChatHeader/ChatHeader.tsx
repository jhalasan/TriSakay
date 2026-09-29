import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { colors } from '../../theme';
import { styles } from './ChatHeader.styles';

export type ChatHeaderDotTone = 'green' | 'blue' | 'greenRing' | 'blueSquare' | 'neutral';

export interface ChatHeaderSwitcherOption {
  id: string;
  label: string;
  unreadCount: number;
}

export interface ChatHeaderProps {
  name: string;
  avatarUrl?: string | null;
  /** Status-line dot + text (Part C §C2's per-state table — the screen picks the copy/tone). */
  statusDot: ChatHeaderDotTone;
  statusText: string;
  onBack: () => void;
  /** Passenger only — hidden once the ride has ended. */
  plate?: string | null;
  plateLabel?: string;
  /** Driver only, ≥2 active passengers (Part C §C2's passenger switcher, C6). */
  switcher?: {
    options: ChatHeaderSwitcherOption[];
    activeId: string;
    onSelect: (id: string) => void;
  };
  /** Safe-area top inset — this component takes no dependency on `react-native-safe-area-context`; the screen supplies it, same as every other screen-level surface in this app. */
  topInset: number;
}

function DotIcon({ tone }: { tone: ChatHeaderDotTone }) {
  if (tone === 'blueSquare') return <View style={styles.dotSquare} />;
  if (tone === 'greenRing') return <View style={styles.dotRing} />;
  const color = tone === 'green' ? colors.accentGreen : tone === 'blue' ? colors.accentBlue : colors.lineStrong;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

/** Chat thread header — trip context (name, live status, plate) plus the driver's passenger switcher. Replaces `ScreenHeader` + a plain avatar on both chat screens (Part C §C2). */
export function ChatHeader({ name, avatarUrl, statusDot, statusText, onBack, plate, plateLabel, switcher, topInset }: ChatHeaderProps) {
  return (
    <View style={[styles.container, { paddingTop: topInset + 10 }]}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Avatar name={name} source={avatarUrl ? { uri: avatarUrl } : undefined} size="md" />
        <View style={styles.textColumn}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <View style={styles.statusRow}>
            <DotIcon tone={statusDot} />
            <Text numberOfLines={1} style={styles.statusText}>
              {statusText}
            </Text>
          </View>
        </View>
        {plate && (
          <View style={styles.plateTag}>
            <Text style={styles.plateLabel}>{plateLabel}</Text>
            <Text numberOfLines={1} style={styles.plateValue}>
              {plate}
            </Text>
          </View>
        )}
      </View>
      {switcher && switcher.options.length >= 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll} contentContainerStyle={styles.switcher}>
          {switcher.options.map((option) => {
            const active = option.id === switcher.activeId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.switcherSegment, active && styles.switcherSegmentActive]}
                onPress={() => switcher.onSelect(option.id)}
              >
                <Text numberOfLines={1} style={[styles.switcherLabel, active && styles.switcherLabelActive]}>
                  {option.label}
                </Text>
                {option.unreadCount > 0 && (
                  <View style={styles.switcherBadge}>
                    <Text style={styles.switcherBadgeText}>{option.unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
