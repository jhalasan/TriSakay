import { useWindowDimensions } from 'react-native';
import { moderateScale } from '@trisakay/ui';

/**
 * Every illustration in this flow is authored at the 375×812 baseline canvas
 * from the design handoff. This scales any baseline px value the same way
 * the rest of the app's tokens do, so illustration geometry (bands, routes,
 * pins) stays proportional to text and spacing at any device width.
 */
export function useMapScale() {
  const { width } = useWindowDimensions();
  return (value: number) => moderateScale(value, width);
}
