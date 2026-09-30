import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily, radius } from '../../theme';
import { BrandMotif } from '../BrandMotif';
import { GradientSurface } from '../GradientSurface';

export interface NavyBandHeaderProps {
  /** Row title (17/24 bold white). Omit for a band whose content is all in `children`. */
  title?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  /** Right-aligned slot in the title row (a status pill, a "Skip" link). */
  right?: React.ReactNode;
  /** md: 17/24 bold (trip details) · lg: 22/28 extrabold (ratings, legal) · xl: 28/34 extrabold (complaints home). */
  titleSize?: 'md' | 'lg' | 'xl';
  /** Safe-area top inset — this component takes no dependency on `react-native-safe-area-context`; the screen supplies it. */
  topInset?: number;
  /** Extra bottom padding so the first card can pull up into the band (`marginTop: -40…-42`). Sets padding-bottom 58. */
  overlapBottom?: boolean;
  /** Overrides the default bottom padding (20). Ignored when `overlapBottom` is set. */
  paddingBottom?: number;
  /** The `0 12 30 rgba(0,46,96,.22)` shadow, for a band that sits over a scrolling list. */
  elevated?: boolean;
  /** Hides the watermark motif (the compact rate-driver header). */
  hideMotif?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * The trip-records handoff's navy hero band (README §2): 135° navy gradient,
 * 30px bottom corners, a low-opacity brand motif and an optional back tile /
 * title / right slot row, with `children` below. The diagonal stripe texture
 * is decoration and is skipped, as the README allows.
 */
export function NavyBandHeader({
  title,
  onBack,
  backAccessibilityLabel = 'Go back',
  right,
  titleSize = 'md',
  topInset = 0,
  overlapBottom = false,
  paddingBottom = 20,
  elevated = false,
  hideMotif = false,
  style,
  children,
}: NavyBandHeaderProps) {
  const hasRow = !!onBack || !!title || !!right;
  return (
    // The shadow lives on this wrapper: the gradient surface clips (overflow hidden + rounded corners), and a shadow on a clipped view is dropped on Android.
    <View style={[styles.shadowWrap, elevated && styles.elevated]}>
      <GradientSurface token="hero" direction="diagonal" style={styles.band}>
        {!hideMotif && (
          <BrandMotif size={170} color={colors.white} opacity={0.12} style={styles.motif} pointerEvents="none" />
        )}
        <View style={[styles.content, { paddingTop: topInset + 6, paddingBottom: overlapBottom ? 58 : paddingBottom }, style]}>
          {hasRow && (
            <View style={styles.row}>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={backAccessibilityLabel}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  onPress={onBack}
                  style={({ pressed }) => [styles.backTile, pressed && styles.backTilePressed]}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.white} />
                </Pressable>
              ) : null}
              {title ? (
                <Text style={[styles.title, titleSize === 'lg' && styles.titleLg, titleSize === 'xl' && styles.titleXl]} numberOfLines={1} accessibilityRole="header">
                  {title}
                </Text>
              ) : (
                <View style={styles.spacer} />
              )}
              {right ? <View style={styles.rightSlot}>{right}</View> : null}
            </View>
          )}
          {children}
        </View>
      </GradientSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { borderBottomLeftRadius: radius.heroBottom, borderBottomRightRadius: radius.heroBottom },
  elevated: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  band: { borderBottomLeftRadius: radius.heroBottom, borderBottomRightRadius: radius.heroBottom },
  motif: { position: 'absolute', top: -30, right: -34 },
  content: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTilePressed: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 24, color: colors.white },
  titleLg: { fontFamily: fontFamily.extrabold, fontSize: 22, lineHeight: 28 },
  titleXl: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  spacer: { flex: 1 },
  // Centres the right slot on the title row (a pill is otherwise pinned to the top by its own alignSelf).
  rightSlot: { alignSelf: 'center' },
});
