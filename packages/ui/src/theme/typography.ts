import type { TextStyle } from 'react-native';

type TypeStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing' | 'textTransform'
>;

/**
 * Wider steps and heavier display weights than a stock scale: on a phone held
 * at arm's length outdoors, a 2px difference between levels reads as noise.
 * Negative tracking on the large sizes only — the floor is -0.04em.
 */
export const typography = {
  /** Fares and amounts due — the one number the rider is looking for. */
  amount: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2 },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  h1: { fontSize: 27, lineHeight: 33, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  buttonSmall: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
} satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;
