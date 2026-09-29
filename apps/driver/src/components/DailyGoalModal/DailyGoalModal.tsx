import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Button, TextField } from '@trisakay/ui';
import { styles } from './DailyGoalModal.styles';

export interface DailyGoalModalProps {
  visible: boolean;
  currentValue: number | null;
  title: string;
  body: string;
  placeholder: string;
  saveLabel: string;
  clearLabel: string;
  cancelLabel: string;
  onSave: (value: number | null) => void;
  onCancel: () => void;
}

/** Local-only daily-goal editor (driver redesign v2, Phase 1) — no backend column, just AsyncStorage via useSettingsStore. */
export function DailyGoalModal({
  visible,
  currentValue,
  title,
  body,
  placeholder,
  saveLabel,
  clearLabel,
  cancelLabel,
  onSave,
  onCancel,
}: DailyGoalModalProps) {
  const [text, setText] = useState(currentValue !== null ? String(currentValue) : '');

  useEffect(() => {
    if (visible) setText(currentValue !== null ? String(currentValue) : '');
  }, [visible, currentValue]);

  function handleSave() {
    const parsed = Number(text.replace(/[^0-9]/g, ''));
    onSave(text.trim().length === 0 || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <TextField
            placeholder={placeholder}
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            leftIcon={<Text style={styles.pesoIcon}>₱</Text>}
            autoFocus
          />
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button label={cancelLabel} variant="outline" tone="neutral" fullWidth onPress={onCancel} />
            </View>
            <View style={styles.actionButton}>
              <Button label={saveLabel} fullWidth onPress={handleSave} />
            </View>
          </View>
          {currentValue !== null && (
            <Button
              label={clearLabel}
              variant="ghost"
              tone="danger"
              fullWidth
              onPress={() => onSave(null)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
