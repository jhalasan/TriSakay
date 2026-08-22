import { translations, type Translations } from '@trisakay/shared';
import { useSettingsStore } from '../store/useSettingsStore.ts';

export function useTranslation(): Translations {
  const language = useSettingsStore((state) => state.language);
  return translations[language];
}
