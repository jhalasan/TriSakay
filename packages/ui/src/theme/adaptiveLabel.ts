/**
 * How a button, link or chip label fits a narrow space: wrap to a second line
 * first, and only if it still does not fit shrink it a little (never below 90%).
 * The old rule forced one line and let the text shrink to 75%, which made long
 * labels, especially Filipino ones, look tiny. maxFontSizeMultiplier stops a
 * large system font size from pushing the label past what two lines can absorb.
 * Spread it onto the label's <Text>.
 */
export const ADAPTIVE_LABEL_PROPS = {
  numberOfLines: 2,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.9,
  maxFontSizeMultiplier: 1.3,
} as const;
