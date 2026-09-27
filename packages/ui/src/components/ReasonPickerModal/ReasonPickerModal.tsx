import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Button } from '../Button';
import { styles } from './ReasonPickerModal.styles';

export interface ReasonOption {
  code: string;
  label: string;
}

export interface ReasonPickerModalProps {
  visible: boolean;
  title: string;
  message?: string;
  options: ReasonOption[];
  confirmLabel: string;
  cancelLabel?: string;
  /** Shows a spinner and disables the list/buttons while the confirm action is in flight. */
  confirmLoading?: boolean;
  onConfirm: (code: string) => void;
  onCancel: () => void;
}

/**
 * PD1 (UAT audit): a required-reason picker for cancelling a ride past the
 * free-cancel stage — used by both apps so the passenger/driver can't
 * cancel an assigned/ongoing ride without picking one of a fixed set of
 * reason codes, matching what the server's cancel RPCs now enforce.
 */
export function ReasonPickerModal({
  visible,
  title,
  message,
  options,
  confirmLabel,
  cancelLabel = 'Back',
  confirmLoading = false,
  onConfirm,
  onCancel,
}: ReasonPickerModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Starts fresh each time the sheet reopens, rather than carrying over a
  // reason picked (and then backed out of) on a previous cancel attempt.
  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.options}>
            {options.map((option) => {
              const isSelected = selected === option.code;
              return (
                <Pressable
                  key={option.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  disabled={confirmLoading}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => setSelected(option.code)}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? colors.accentBlue : colors.inkSoft}
                  />
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button label={cancelLabel} variant="outline" tone="neutral" fullWidth disabled={confirmLoading} onPress={onCancel} />
            </View>
            <View style={styles.actionButton}>
              <Button
                label={confirmLabel}
                variant="solid"
                tone="danger"
                fullWidth
                loading={confirmLoading}
                disabled={!selected}
                onPress={() => selected && onConfirm(selected)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
