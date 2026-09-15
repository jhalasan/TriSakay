import { StyleSheet } from 'react-native';
import { fontFamily, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  // P1-24 (2026-09-15 launch audit): wraps <Tabs> alongside <OfflineStrip>.
  root: { flex: 1 },
  label: { ...typography.labelSm },
  labelActive: { fontFamily: fontFamily.bold },
});
