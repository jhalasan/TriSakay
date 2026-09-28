import { View, type ViewStyle } from 'react-native';
import { styles } from './IconTile.styles';

export type IconTileSize = 48 | 38 | 34 | 32 | 30 | 26;

const RADIUS_BY_SIZE: Record<IconTileSize, number> = {
  48: 15,
  38: 12,
  34: 11,
  32: 10,
  30: 10,
  26: 8,
};

export interface IconTileProps {
  size: IconTileSize;
  backgroundColor: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Rounded square icon container, sized per README §1.6. */
export function IconTile({ size, backgroundColor, children, style }: IconTileProps) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: RADIUS_BY_SIZE[size], backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}
