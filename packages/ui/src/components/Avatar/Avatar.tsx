import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { styles } from './Avatar.styles';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name?: string;
  source?: ImageSourcePropType;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 88,
};

const fontSizeMap: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 15,
  lg: 20,
  xl: 30,
};

function getInitials(name?: string) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, source, size = 'md' }: AvatarProps) {
  const dimension = sizeMap[size];
  const baseStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
  };

  return (
    <View style={[styles.base, baseStyle]}>
      {source ? (
        <Image source={source} style={styles.image} resizeMode="cover" />
      ) : (
        <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
}
