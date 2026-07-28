/**
 * Every pairing below is verified against WCAG 2.1: text ≥4.5:1, control
 * boundaries ≥3:1. The accents are deliberately deep rather than pastel —
 * this app is used outdoors in daylight, and the earlier pale blue failed
 * white-on-blue button labels at 2.63:1.
 */
export const colors = {
  bg: '#F6F7F9',
  panel: '#FFFFFF',

  ink: '#14191D', // 16.5:1 on bg
  inkPressed: '#0A0E11',
  inkSoft: '#5A646B', // 5.65:1 on bg — secondary text
  inkFaint: '#666F75', // 4.78:1 on bg — placeholders, inactive labels

  line: '#DCE2E6', // decorative dividers only
  lineStrong: '#838B91', // 3.46:1 — input/control boundaries
  lineSoft: '#EBEFF2',
  fill: '#EDF1F4',
  white: '#FFFFFF',

  accentBlue: '#0B6BAF', // 5.62:1 with white — primary actions
  accentBluePressed: '#095A94',
  accentBlueSoft: '#E3EFFA',

  accentGreen: '#157A4B', // 5.36:1 with white — positive/complete status only
  accentGreenPressed: '#10633D',
  accentGreenSoft: '#E1F1E8',

  danger: '#B3261E', // 6.54:1 with white
  dangerPressed: '#931E17',
  dangerSoft: '#FBEAE8',

  overlay: 'rgba(10, 14, 17, 0.58)',
} as const;

export type ColorToken = keyof typeof colors;
