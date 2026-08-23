import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { Badge, colors, type BadgeTone } from '@trisakay/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { DocumentStatus } from '../../types/document';
import { interpolate } from '../../utils/interpolate';
import { styles } from './DocumentUploadRow.styles';

export interface DocumentUploadRowProps {
  label: string;
  status: DocumentStatus;
  uri: string | null;
  onUpload: (uri: string) => void;
  onRemove: () => void;
}

const STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  unsubmitted: 'neutral',
  selected: 'neutral',
  pending: 'neutral',
  verified: 'green',
  rejected: 'danger',
};

export function DocumentUploadRow({ label, status, uri, onUpload, onRemove }: DocumentUploadRowProps) {
  const t = useTranslation();
  const STATUS_LABEL: Record<DocumentStatus, string> = {
    unsubmitted: t.driver.documents.statusUnsubmitted,
    selected: t.driver.documents.statusSelected,
    pending: t.driver.documents.statusPending,
    verified: t.driver.documents.statusVerified,
    rejected: t.driver.documents.statusRejected,
  };

  async function handlePress() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.driver.documents.permissionNeededTitle, t.driver.documents.permissionNeededMessage);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) onUpload(result.assets[0].uri);
  }

  function handleRemove() {
    Alert.alert(t.driver.documents.removeTitle, t.driver.documents.removeMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.driver.documents.removeConfirm, style: 'destructive', onPress: onRemove },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
      </View>
      {uri ? (
        <View style={styles.preview}>
          <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
          <Pressable
            style={styles.removeButton}
            onPress={handleRemove}
            accessibilityRole="button"
            accessibilityLabel={interpolate(t.driver.documents.removeAccessibilityLabel, { label })}
          >
            <Ionicons name="trash-outline" size={16} color={colors.white} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.uploadBox}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={interpolate(t.driver.documents.uploadAccessibilityLabel, { label })}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.inkSoft} />
          <Text style={styles.uploadText}>{t.driver.documents.upload}</Text>
        </Pressable>
      )}
    </View>
  );
}
