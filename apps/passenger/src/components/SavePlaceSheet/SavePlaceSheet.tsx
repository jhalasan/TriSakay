import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button, TextField, colors } from '@trisakay/ui';
import { SAVED_PLACE_ICONS, saveSavedPlace, type SavedPlaceIcon } from '@trisakay/services';
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

const DEFAULT_ICON: SavedPlaceIcon = 'location-outline';

export function SavePlaceSheet({ place, onClose, onSaved }: SavePlaceSheetProps) {
  const t = useTranslation();
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState<SavedPlaceIcon>(DEFAULT_ICON);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (place === null) {
      setError(null);
      return;
    }
    setLabel(place.label);
    setIcon(DEFAULT_ICON);
  }, [place]);

  async function handleSave() {
    if (!place || saving || label.trim().length === 0) return;
    setSaving(true);
    setError(null);

    const { error: saveError } = await saveSavedPlace({
      label: label.trim(),
      icon,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });

    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onSaved(place);
    onClose();
  }

  return (
    <Modal visible={place !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t.savePlace.title}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <TextField
            label={t.savePlace.nameLabel}
            placeholder={t.savePlace.namePlaceholder}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.iconSectionLabel}>{t.savePlace.iconLabel}</Text>
          <View style={styles.iconRow}>
            {SAVED_PLACE_ICONS.map((option) => {
              const selected = option === icon;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  accessibilityState={{ selected }}
                  style={[styles.iconOption, selected && styles.iconOptionSelected]}
                  onPress={() => setIcon(option)}
                >
                  <Ionicons name={option} size={20} color={selected ? colors.white : colors.accentBluePressed} />
                </Pressable>
              );
            })}
          </View>

          <Button
            label={t.savePlace.saveButton}
            fullWidth
            disabled={label.trim().length === 0}
            loading={saving}
            onPress={handleSave}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
