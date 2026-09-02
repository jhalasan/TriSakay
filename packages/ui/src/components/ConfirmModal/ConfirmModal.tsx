import { Modal, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Button } from '../Button';
import { styles } from './ConfirmModal.styles';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Optional icon rendered in a centred 48px tile above the title — e.g. the log-out gate's warning glyph. Not shown unless passed, so existing confirm dialogs (e.g. a trip cancel) are unaffected. */
  icon?: React.ReactNode;
  /** Shows a spinner and disables both buttons while the confirm action is in flight — prevents a double-tap re-firing onConfirm before the modal closes. */
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  confirmLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {icon && (
            <View style={[styles.iconTile, { backgroundColor: destructive ? colors.dangerSoft : colors.accentBlueSoft }]}>
              {icon}
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button
                label={cancelLabel}
                variant="outline"
                tone="neutral"
                fullWidth
                disabled={confirmLoading}
                onPress={onCancel}
              />
            </View>
            <View style={styles.actionButton}>
              <Button
                label={confirmLabel}
                variant="solid"
                tone={destructive ? 'danger' : 'primary'}
                fullWidth
                loading={confirmLoading}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
