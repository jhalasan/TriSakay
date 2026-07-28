export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
