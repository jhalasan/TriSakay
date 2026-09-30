import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '../../theme';

export interface StatCell {
  value: string;
  caption: string;
  /** Monospace value (trip references). */
  mono?: boolean;
}

export interface StatCellsProps {
  cells: StatCell[];
}

/** A 2- or 3-column grid of value + caption with hairline dividers, under a top border. */
export function StatCells({ cells }: StatCellsProps) {
  return (
    <View style={styles.row}>
      {cells.map((cell, index) => (
        <View key={cell.caption} style={[styles.cell, index > 0 && styles.divider]}>
          <Text style={[styles.value, cell.mono && styles.mono]} numberOfLines={1}>
            {cell.value}
          </Text>
          <Text style={styles.caption} numberOfLines={1}>
            {cell.caption}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.lineSoft },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4 },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.lineSoft },
  value: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  mono: { fontFamily: 'monospace', fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft },
});
