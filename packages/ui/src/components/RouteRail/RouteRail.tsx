import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors, fontFamily } from '../../theme';

export interface RouteRailStop {
  name: string;
  /** Small uppercase caption above the name ("PICKUP", "DROPPED OFF"). Omit for a names-only rail. */
  label?: string;
  /** Right-aligned time, lined up with the name. */
  time?: string;
}

export interface RouteRailProps {
  pickup: RouteRailStop;
  dropoff: RouteRailStop;
  /** `compact` is the complaint step-1 trip card: 8px dots and a solid line. */
  variant?: 'default' | 'compact';
  /** Gap between the two stops (16 on trip details, 14 on trip complete). */
  gap?: number;
}

const DASH = 4;

/** The dashed line between the dots. Measures its own height and lays out 4-on / 4-off dashes (RN's dashed borders are unreliable on Android). */
function DashedLine() {
  const [height, setHeight] = useState(0);
  const count = Math.max(0, Math.floor((height + DASH) / (DASH * 2)));
  return (
    <View style={styles.dashHost} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
}

/** A stop marker: a filled dot (pickup, circle) or square (drop-off) with an optional 4px soft ring drawn by a wrapper view. */
function Dot({ size, shape, color, ring }: { size: number; shape: 'circle' | 'square'; color: string; ring: string | null }) {
  const inner = { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : size / 4, backgroundColor: color };
  if (!ring) return <View style={inner} />;
  const outer = size + 8;
  return (
    <View
      style={{
        width: outer,
        height: outer,
        borderRadius: shape === 'circle' ? outer / 2 : outer / 4,
        backgroundColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
        // The rail column is 14 wide; the 20px ring overhangs 3px each side, which is intended.
        marginHorizontal: -3,
        marginTop: -4,
      }}
    >
      <View style={inner} />
    </View>
  );
}

function StopText({ stop }: { stop: RouteRailStop }) {
  return (
    <View style={styles.stopBody}>
      <View style={styles.stopText}>
        {stop.label ? <Text style={styles.label}>{stop.label}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>
          {stop.name}
        </Text>
      </View>
      {stop.time ? (
        <Text style={[styles.time, stop.label ? styles.timeWithLabel : null]}>{stop.time}</Text>
      ) : null}
    </View>
  );
}

/** Pickup -> drop-off with a rail between the dots. Shared by trip details, trip complete and the complaint trip card. */
export function RouteRail({ pickup, dropoff, variant = 'default', gap = 16 }: RouteRailProps) {
  const compact = variant === 'compact';
  const dot = compact ? 8 : 12;
  return (
    <View accessible accessibilityLabel={`${pickup.name} → ${dropoff.name}`}>
      <View style={styles.stopRow}>
        <View style={[styles.railColumn, { paddingTop: compact ? 5 : 4 }]}>
          <Dot size={dot} shape="circle" color={colors.accentGreen} ring={compact ? null : colors.accentGreenSoft} />
          <View style={[styles.lineHost, { marginVertical: compact ? 3 : 4 }]}>
            {compact ? <View style={styles.solidLine} /> : <DashedLine />}
          </View>
        </View>
        <View style={[styles.stopSlot, { paddingBottom: gap }]}>
          <StopText stop={pickup} />
        </View>
      </View>
      <View style={styles.stopRow}>
        <View style={[styles.railColumn, { paddingTop: compact ? 5 : 4 }]}>
          <Dot size={dot} shape="square" color={colors.accentBlue} ring={compact ? null : colors.accentBlueSoft} />
        </View>
        <View style={styles.stopSlot}>
          <StopText stop={dropoff} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stopRow: { flexDirection: 'row', gap: 12 },
  railColumn: { width: 14, alignItems: 'center' },
  stopSlot: { flex: 1 },
  stopBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stopText: { flex: 1 },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  name: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21, color: colors.ink },
  time: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 21, color: colors.inkSoft },
  // Lines the time up with the place name (which sits under the label).
  timeWithLabel: { paddingTop: 15 },
  lineHost: { flex: 1, minHeight: 8, alignItems: 'center' },
  solidLine: { flex: 1, width: 2, backgroundColor: colors.line },
  dashHost: { flex: 1, width: 2, overflow: 'hidden', gap: DASH },
  dash: { width: 2, height: DASH, backgroundColor: colors.lineStrong },
});
