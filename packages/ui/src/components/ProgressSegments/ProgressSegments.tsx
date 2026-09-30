import { StyleSheet, View } from 'react-native';

export interface ProgressSegmentsProps {
  /** One colour per segment, left to right. */
  colors: string[];
  height?: number;
  gap?: number;
}

/** n equal, pill-ended bars. Used for the document health bar, the 3-step complaint bar and the 2-step filing progress. */
export function ProgressSegments({ colors: segmentColors, height = 5, gap = 4 }: ProgressSegmentsProps) {
  return (
    <View style={[styles.row, { gap }]} accessible={false} importantForAccessibility="no-hide-descendants">
      {segmentColors.map((color, index) => (
        <View key={index} style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
