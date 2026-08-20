import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { saveSavedPlace, type SavedPlaceKind } from '@trisakay/services';
import { useTranslation } from '../../hooks/useTranslation';
import type { LocationPoint } from '../../types/booking';
import { styles } from './SavePlaceSheet.styles';

export interface SavePlaceSheetProps {
  /** Non-null shows the sheet; null hides it. */
  place: LocationPoint | null;
  onClose: () => void;
  /** Fires with the same `place` once the save succeeds, before `onClose`. */
  onSaved: (place: LocationPoint) => void;
}

const OPTION_ICON: Record<SavedPlaceKind, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  custom: 'location-outline',
};

export function SavePlaceSheet({ place, onClose, onSaved }: SavePlaceSheetProps) {
  const t = useTranslation();
  const [saving, setSaving] = useState<SavedPlaceKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (place === null) setError(null);
  }, [place]);

  async function handleSave(kind: SavedPlaceKind) {
    if (!place || saving) return;
    setSaving(kind);
    setError(null);

    const label = kind === 'home' ? t.savePlace.homeLabel : kind === 'work' ? t.savePlace.workLabel : place.label;
    const { error: saveError } = await saveSavedPlace({
      kind,
      label,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });

    setSaving(null);
    if (saveError) {
      setError(saveError);
      return;
    }
    onSaved(place);
    onClose();
  }

  const options: { kind: SavedPlaceKind; label: string }[] = [
    { kind: 'home', label: `${t.savePlace.saveAsPrefix} ${t.savePlace.homeLabel}` },
    { kind: 'work', label: `${t.savePlace.saveAsPrefix} ${t.savePlace.workLabel}` },
    { kind: 'custom', label: `${t.savePlace.saveAsPrefix} "${place?.label ?? ''}"` },
  ];

  return (
    <Modal visible={place !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t.savePlace.title}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {options.map((option) => (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              style={[styles.optionRow, saving !== null && styles.optionRowDisabled]}
              disabled={saving !== null}
              onPress={() => handleSave(option.kind)}
            >
              <Ionicons name={OPTION_ICON[option.kind]} size={20} color={colors.accentBluePressed} />
              <Text style={styles.optionLabel} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
