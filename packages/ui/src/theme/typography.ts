import { Dimensions, type TextStyle } from 'react-native';
import { moderateScale } from './scale';

const deviceWidth = Dimensions.get('window').width;
const scaleFont = (size: number) => moderateScale(size, deviceWidth);

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
  amount: {
    fontSize: scaleFont(40),
    lineHeight: scaleFont(46),
    fontFamily: fontFamily.extrabold,
    letterSpacing: -1.2,
  },
  display: {
    fontSize: scaleFont(34),
    lineHeight: scaleFont(40),
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.8,
  },
  /** The landing screen's headline only — one size up from `display`. */
  displayLg: {
    fontSize: scaleFont(36),
    lineHeight: scaleFont(42),
    fontFamily: fontFamily.extrabold,
    letterSpacing: -1.1,
  },
  h1: { fontSize: scaleFont(27), lineHeight: scaleFont(33), fontFamily: fontFamily.bold, letterSpacing: -0.4 },
  h2: { fontSize: scaleFont(20), lineHeight: scaleFont(26), fontFamily: fontFamily.bold, letterSpacing: -0.2 },
  h3: { fontSize: scaleFont(17), lineHeight: scaleFont(23), fontFamily: fontFamily.semibold },
  /** Passenger Home's greeting name. One step below `display`. */
  h1b: { fontSize: scaleFont(28), lineHeight: scaleFont(32), fontFamily: fontFamily.extrabold, letterSpacing: -0.7 },
  /** Driver duty-console "Go online" CTA title weight/size. */
  h2b: { fontSize: scaleFont(22), lineHeight: scaleFont(25), fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  /** "Listening for requests" panel title. */
  h3b: { fontSize: scaleFont(19), lineHeight: scaleFont(25), fontFamily: fontFamily.bold },
  /** Request-card stop values (pickup/dropoff address lines). */
  bodyLg: { fontSize: scaleFont(15), lineHeight: scaleFont(21), fontFamily: fontFamily.semibold },
  /** Request-card meta text, driver duty-console meta line. */
  bodySm: { fontSize: scaleFont(14), lineHeight: scaleFont(20), fontFamily: fontFamily.semibold },
  body: { fontSize: scaleFont(16), lineHeight: scaleFont(24), fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: scaleFont(16), lineHeight: scaleFont(24), fontFamily: fontFamily.semibold },
  caption: { fontSize: scaleFont(13), lineHeight: scaleFont(18), fontFamily: fontFamily.regular },
  /** Stats-strip values, listening-panel body copy. */
  labelSm: { fontSize: scaleFont(11), lineHeight: scaleFont(15), fontFamily: fontFamily.regular },
  /** Stats-strip labels. */
  labelXs: {
    fontSize: scaleFont(10),
    lineHeight: scaleFont(14),
    fontFamily: fontFamily.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  /** Section eyebrows ("SAVED PLACES", "INCOMING REQUEST", "YOU'RE ONLINE") — same shape as `label` but with the redesign's slightly wider tracking. */
  eyebrow: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontFamily: fontFamily.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontFamily: fontFamily.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  button: { fontSize: scaleFont(16), lineHeight: scaleFont(20), fontFamily: fontFamily.bold },
  buttonSmall: { fontSize: scaleFont(14), lineHeight: scaleFont(18), fontFamily: fontFamily.semibold },
  /** Map-illustration label chips (e.g. "Pickup", "PSO verified"). */
  chip: { fontSize: scaleFont(12), lineHeight: scaleFont(16), fontFamily: fontFamily.semibold },
} satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;
