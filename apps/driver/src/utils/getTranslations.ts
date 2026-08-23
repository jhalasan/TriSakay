import { translations, type Translations } from '@trisakay/shared';
import { useSettingsStore } from '../store/useSettingsStore.ts';

/**
 * Synchronous, non-hook equivalent of useTranslation() for use inside Zustand
 * store actions, which run outside the React tree and can't call hooks.
 */
export function getTranslations(): Translations {
  return translations[useSettingsStore.getState().language];
}
