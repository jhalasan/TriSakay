import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme';
import { styles } from './MapSearchBar.styles';

export interface MapSearchBarProps {
  /** Renders a leading back chevron when provided. */
  onBack?: () => void;
  /**
   * Static label mode (e.g. "Where to?") — the whole bar becomes a single
   * tap target. Ignored when `children` is passed.
   */
  label?: string;
  onPress?: () => void;
  /** Only meaningful in label mode — dims the bar and drops the tap handler. */
  disabled?: boolean;
  /**
   * A live control (e.g. a `TextField`) in place of the static label —
   * for screens where the bar itself is the input, not a navigation trigger.
   */
  children?: React.ReactNode;
  /** Right-hand slot — notification bell, avatar, etc. Never made pressable itself. */
  trailing?: React.ReactNode;
  /** Announced only in label mode, while the bar's tap action is temporarily unavailable (e.g. a missing permission). */
  accessibilityHint?: string;
  /**
   * `floating` (default) is the standalone pill with its own background and
   * shadow. `flat` strips that chrome so the bar can be embedded inside
   * another surface (e.g. a `Card`) instead of floating directly over the
   * map — use this whenever the bar sits on a background that already
   * guarantees contrast, rather than on map tiles of unpredictable color.
   */
  variant?: 'floating' | 'flat';
  style?: StyleProp<ViewStyle>;
}

/**
 * The floating rounded bar that replaces a normal in-flow header on
 * full-bleed map screens. Positioning (top offset, safe-area inset,
 * horizontal margin) is the call site's job — this only owns the bar's own
 * look, since that varies per screen (a bare label vs. a live search field)
 * more than its placement does.
 */
export function MapSearchBar({
  onBack,
  label,
  onPress,
  children,
  trailing,
  disabled = false,
  accessibilityHint,
  variant = 'floating',
  style,
}: MapSearchBarProps) {
  return (
    <View
      style={[
        styles.bar,
        variant === 'flat' ? styles.barFlat : styles.barFloating,
        disabled && styles.barDisabled,
        style,
      ]}
    >
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      )}
      <View style={styles.contentSlot}>
        {children ?? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={accessibilityHint}
            disabled={disabled}
            onPress={onPress}
            style={styles.labelPressable}
          >
            <Ionicons name="search" size={18} color={colors.inkSoft} />
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        )}
      </View>
      {trailing && <View style={styles.trailingSlot}>{trailing}</View>}
    </View>
  );
}
