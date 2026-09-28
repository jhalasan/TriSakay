import type { Ionicons } from '@expo/vector-icons';
import { colors, type ColorToken } from '@trisakay/ui';
import type { ComplaintCategory } from '@trisakay/services';

export const CATEGORY_ICON: Record<ComplaintCategory, keyof typeof Ionicons.glyphMap> = {
  fare: 'cash-outline',
  conduct: 'person-outline',
  safety: 'shield-outline',
  low_rating: 'star-outline',
  vehicle_condition: 'build-outline',
  other: 'ellipsis-horizontal',
};

export const CATEGORY_TONE: Record<ComplaintCategory, { bg: string; fg: string }> = {
  fare: { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed },
  conduct: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  safety: { bg: colors.dangerSoft, fg: colors.dangerPressed },
  low_rating: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  vehicle_condition: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  other: { bg: colors.fill, fg: colors.inkSoft },
};

/** Grid/order used by the step-1 category picker (README §3.1). */
export const CATEGORY_GRID_ORDER: ComplaintCategory[] = [
  'fare',
  'conduct',
  'safety',
  'vehicle_condition',
  'low_rating',
  'other',
];

export type { ColorToken };
