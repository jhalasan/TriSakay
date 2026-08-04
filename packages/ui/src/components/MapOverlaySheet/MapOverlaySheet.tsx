import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GradientSurface } from '../GradientSurface';
import { styles } from './MapOverlaySheet.styles';

export interface MapOverlaySheetProps {
  children: React.ReactNode;
  /** Bounds the sheet's height for content that can grow (e.g. a results list) — otherwise it sizes to its content. */
  maxHeight?: number;
  /**
   * Pixels of bottom safe-area inset to add on top of the sheet's own
   * padding. Required from the call site rather than read internally: an
   * absolutely positioned child's containing block is its ancestor's full
   * padding box, so a `SafeAreaView`'s bottom padding does NOT constrain
   * this sheet the way it would a normal in-flow child — pass
   * `useSafeAreaInsets().bottom` explicitly instead.
   */
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A panel that floats over the bottom of a full-bleed map, rather than
 * pushing the map into the remaining flex space the way a normal in-flow
 * layout would. Always `position: absolute` against its nearest positioned
 * ancestor — that ancestor must be the full-screen container the map also
 * fills.
 */
export function MapOverlaySheet({ children, maxHeight, bottomInset = 0, style }: MapOverlaySheetProps) {
  return (
    <View
      style={[styles.sheet, { paddingBottom: styles.sheet.paddingBottom + bottomInset }, maxHeight != null && { maxHeight }, style]}
    >
      <GradientSurface token="brand" direction="diagonal" style={styles.handle} />
      {children}
    </View>
  );
}
