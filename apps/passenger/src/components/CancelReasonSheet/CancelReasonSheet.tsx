import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { GradientSurface, colors } from '@trisakay/ui';
import { styles } from './CancelReasonSheet.styles';

export interface CancelReasonOption {
  code: string;
  label: string;
}

export interface CancelReasonSheetProps {
  visible: boolean;
  title: string;
  body: string;
  options: CancelReasonOption[];
  keepLabel: string;
  cancelLabel: string;
  confirmLoading?: boolean;
  onKeep: () => void;
  onConfirm: (code: string) => void;
  bottomInset?: number;
}

/**
 * Part B §B5 — a purpose-built bottom sheet for the passenger's cancel-with-reason
 * flow, not a restyle of the shared `ReasonPickerModal` (a centered card used by
 * both apps' other cancel/transfer reason pickers). This sheet's scrim-dismiss,
 * gradient "Keep my ride" button and disabled-until-selected "Cancel ride" button
 * are specific to this screen — restyling the shared modal would change the
 * driver app's own cancel/transfer UI too, which is out of scope here.
 */
export function CancelReasonSheet({
  visible,
  title,
  body,
  options,
  keepLabel,
  cancelLabel,
  confirmLoading = false,
  onKeep,
  onConfirm,
  bottomInset = 0,
}: CancelReasonSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Selection resets on each open (Part B §B5).
  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <Pressable style={styles.scrim} onPress={confirmLoading ? undefined : onKeep}>
        <Pressable style={[styles.sheet, { paddingBottom: 26 + bottomInset }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

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
                  <View style={[styles.radio, isSelected && styles.radioSelected]} />
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]} numberOfLines={1}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.buttons}>
            <GradientSurface token="button" direction="diagonal" style={styles.keepButtonWrap}>
              <Pressable style={styles.keepButton} accessibilityRole="button" disabled={confirmLoading} onPress={onKeep}>
                <Text style={styles.keepButtonText}>{keepLabel}</Text>
              </Pressable>
            </GradientSurface>
            <Pressable
              style={[styles.cancelButton, !selected && styles.cancelButtonDisabled]}
              accessibilityRole="button"
              disabled={!selected || confirmLoading}
              onPress={() => selected && onConfirm(selected)}
            >
              {confirmLoading ? <ActivityIndicator color={colors.danger} /> : <Text style={[styles.cancelButtonText, !selected && styles.cancelButtonTextDisabled]}>{cancelLabel}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
