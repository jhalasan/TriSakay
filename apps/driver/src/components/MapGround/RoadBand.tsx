import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@trisakay/ui';
import { useMapScale } from './useMapScale';

export interface RoadBandProps {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** A road-colored rectangle. Positions/sizes are baseline px, scaled to the device. */
export function RoadBand({ left, top, right, bottom, width, height, style }: RoadBandProps) {
  const scale = useMapScale();

  return (
    <View
      style={[
        styles.band,
        {
          left: left !== undefined ? scale(left) : undefined,
          top: top !== undefined ? scale(top) : undefined,
          right: right !== undefined ? scale(right) : undefined,
          bottom: bottom !== undefined ? scale(bottom) : undefined,
          width: width !== undefined ? scale(width) : undefined,
          height: height !== undefined ? scale(height) : undefined,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    backgroundColor: colors.accentBlueSoft,
  },
});
