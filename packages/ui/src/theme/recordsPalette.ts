/**
 * Named local constants for the few hexes in the trip-records handoff
 * (docs/design_handoff_trisakay_trip_records, README §3.2) that have no
 * `colors.ts` token. Deliberately NOT theme tokens: each is used by one
 * surface family only, and none sits behind body text without its own
 * contrast pairing noted here. Anything with a real token stays on `colors`.
 */
export const recordsPalette = {
  /** Expired-card border and the SOS ring track — a darker `dangerSoft`. */
  dangerLine: '#F2C4BF',
  /** Expired-card footer strip background and its top border. */
  dangerWash: '#FDF4F3',
  dangerWashLine: '#F7DAD6',

  /** On-navy accents (rating bars, header stars, document health bar). Only ever drawn on the navy band, never behind text. */
  onDarkGreen: '#8BC873',
  onDarkRed: '#E0675E',
  onDarkBlue: '#7FB2E5',
  /** "20% discount applied" line on the navy band. */
  onDarkGreenLight: '#B9E3A6',

  /** Fare-flagged card ("Drop-off didn't match your booking"). Body text #4A3B0F on #FFF6E0 is 9.7:1. */
  amberBg: '#FFF6E0',
  amberBorder: '#E9C46A',
  amberTile: '#F7E2A8',
  amberIcon: '#7A5A00',
  amberText: '#4A3B0F',
} as const;

export type RecordsPaletteToken = keyof typeof recordsPalette;
