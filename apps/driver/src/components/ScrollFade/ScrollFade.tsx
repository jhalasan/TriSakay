import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@trisakay/ui';

export interface ScrollFadeProps {
  /** Height of the fade strip in px. */
  height?: number;
}

/**
 * Fades the last bit of a scroll area to `colors.bg` right above a docked
 * footer, so content reads as clipped rather than cut off. Absolutely
 * positioned by the caller at the bottom of the scroll area's wrapper —
 * this only renders the gradient itself.
 */
export function ScrollFade({ height = 28 }: ScrollFadeProps) {
  return (
    <Svg style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }} pointerEvents="none">
      <Defs>
        <LinearGradient id="scrollFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#scrollFade)" />
    </Svg>
  );
}
