import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Spinner.styles';

export interface SpinnerProps {
  size?: 'small' | 'large';
}

export function Spinner({ size = 'small' }: SpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={colors.accentBlue} />
    </View>
  );
}
