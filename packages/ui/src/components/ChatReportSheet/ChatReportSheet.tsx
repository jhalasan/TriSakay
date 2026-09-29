import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatReportSheet.styles';

export interface ChatReportSheetProps {
  visible: boolean;
  title: string;
  fromLabel: string;
  body: string;
  reportLabel: string;
  cancelLabel: string;
  loading?: boolean;
  onReport: () => void;
  onCancel: () => void;
  bottomInset?: number;
}

/** "Report this message?" bottom sheet (Part C §C9) — replaces the two `Alert.alert` confirm dialogs the chat screens used before. */
export function ChatReportSheet({ visible, title, fromLabel, body, reportLabel, cancelLabel, loading = false, onReport, onCancel, bottomInset = 0 }: ChatReportSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={loading ? undefined : onCancel}>
        <Pressable style={[styles.sheet, { paddingBottom: 26 + bottomInset }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.iconTile}>
              <Ionicons name="flag-outline" size={19} color={colors.danger} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.from}>{fromLabel}</Text>
            </View>
          </View>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" disabled={loading} style={styles.reportButton} onPress={onReport}>
              {loading ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.reportText}>{reportLabel}</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" disabled={loading} style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
