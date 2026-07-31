import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fill is a GradientSurface child (brand navy→green) — no backgroundColor
  // here, it would just sit hidden underneath.
  ring: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
