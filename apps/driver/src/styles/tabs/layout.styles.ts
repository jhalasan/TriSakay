import { StyleSheet } from 'react-native';
import { fontFamily, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  label: { ...typography.labelSm },
  labelActive: { fontFamily: fontFamily.bold },
});
