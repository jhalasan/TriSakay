import { View, type ViewProps } from 'react-native';
import { elevation } from '../../theme';
import { styles } from './Card.styles';

export interface CardProps extends ViewProps {
  variant?: 'flat' | 'raised';
}

export function Card({ variant = 'flat', style, children, ...viewProps }: CardProps) {
  return (
    <View
      style={[styles.base, variant === 'flat' ? styles.flat : elevation.card, style]}
      {...viewProps}
    >
      {children}
    </View>
  );
}
