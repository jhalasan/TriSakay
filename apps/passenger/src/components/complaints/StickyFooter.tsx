import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './StickyFooter.styles';

/** Absolute-bottom footer for the multi-step complaint flow (README §1.7). */
export function StickyFooter({ style, children, ...viewProps }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }, style]} {...viewProps}>
      {children}
    </View>
  );
}
