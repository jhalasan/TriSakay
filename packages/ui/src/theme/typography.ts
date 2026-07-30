import type { TextStyle } from 'react-native';

/**
 * Poppins — geometric, rounded, and noticeably more branded than a neutral UI
 * face. The trade it makes is legibility at small sizes: a short x-height
 * relative to its caps, single-storey `a`, and near-circular `o`/`e` counters
 * that close up on a low-DPI screen in daylight. `caption` (13px) is where
 * that shows first, so check it outdoors before committing to this face —
 * NFR-3's low-literacy requirement leans the other way.
 *
 * **Weight lives in the family name, never in `fontWeight`.** React Native
 * cannot synthesise weights for a custom face, so each weight is a separate
 * loaded font. Setting `fontWeight` as well makes Android apply fake-bold on
 * top of the real bold face, which reads as smeared. Every token below sets
 * `fontFamily` and no weight, and `TypeStyle` omits `fontWeight` so the
 * compiler rejects re-adding one.
 *
 * The consuming app must load exactly these four families at startup (see
 * `apps/passenger/app/_layout.tsx`). A family that is not loaded silently
 * falls back to the system face at regular weight, so the loader and this map
 * have to stay in step — import `fontFamily` there rather than re-typing the
 * strings.
 */
export const fontFamily = {
  regular: 'Poppins_400Regular',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;

type TypeStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontFamily' | 'letterSpacing' | 'textTransform'
>;

/**
 * Wider steps and heavier display weights than a stock scale: on a phone held
 * at arm's length outdoors, a 2px difference between levels reads as noise.
 * Negative tracking on the large sizes only — the floor is -0.04em.
 */
export const typography = {
  /** Fares and amounts due — the one number the rider is looking for. */
  amount: { fontSize: 40, lineHeight: 46, fontFamily: fontFamily.extrabold, letterSpacing: -1.2 },
  display: { fontSize: 34, lineHeight: 40, fontFamily: fontFamily.extrabold, letterSpacing: -0.8 },
  h1: { fontSize: 27, lineHeight: 33, fontFamily: fontFamily.bold, letterSpacing: -0.4 },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.bold, letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 23, fontFamily: fontFamily.semibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  button: { fontSize: 16, lineHeight: 20, fontFamily: fontFamily.bold },
  buttonSmall: { fontSize: 14, lineHeight: 18, fontFamily: fontFamily.semibold },
} satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;
