import { colors } from '@trisakay/ui';

export const SHORTCUT_ICON_TONE: Record<string, { bg: string; icon: string }> = {
  'home-outline': { bg: colors.accentBlue, icon: colors.white },
  'briefcase-outline': { bg: colors.accentGreen, icon: colors.white },
  'school-outline': { bg: colors.accentBlueSoft, icon: colors.accentBluePressed },
};
export const DEFAULT_SHORTCUT_TONE = { bg: colors.accentBlueSoft, icon: colors.accentBluePressed };
