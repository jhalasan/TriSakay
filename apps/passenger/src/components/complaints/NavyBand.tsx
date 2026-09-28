import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, GradientSurface, colors } from '@trisakay/ui';
import { styles } from './NavyBand.styles';

export interface NavyBandProps extends ViewProps {
  motifSize?: number;
}

/**
 * Full-bleed navy hero band shared by the complaints tab and tracker —
 * matches the hero treatment already used by Home/History/Saved places
 * (GradientSurface token="hero" + a BrandMotif watermark, no extra texture
 * layer). Extends under the status bar; content gets its own top inset.
 */
export function NavyBand({ motifSize = 170, style, children, ...viewProps }: NavyBandProps) {
  return (
    <View style={styles.shadowWrap}>
      <GradientSurface token="hero" direction="diagonal" style={[styles.panel, style]} {...viewProps}>
        <BrandMotif size={motifSize} color={colors.white} opacity={0.12} style={styles.motif} />
        <SafeAreaView edges={['top']}>{children}</SafeAreaView>
      </GradientSurface>
    </View>
  );
}
