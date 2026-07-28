import { Switch, type SwitchProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Toggle.styles';

export interface ToggleProps extends SwitchProps {}

export function Toggle(props: ToggleProps) {
  return (
    <Switch
      style={styles.base}
      trackColor={{ false: colors.line, true: colors.accentBlue }}
      thumbColor={colors.white}
      ios_backgroundColor={colors.line}
      {...props}
    />
  );
}
