import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { Badge, colors, type BadgeTone } from '@trisakay/ui';
import type { DocumentStatus } from '../../types/document';
import { styles } from './DocumentUploadRow.styles';

export interface DocumentUploadRowProps {
  label: string;
  status: DocumentStatus;
  uri: string | null;
  onUpload: (uri: string) => void;
  onRemove: () => void;
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  unsubmitted: 'Not uploaded',
  selected: 'Selected',
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  unsubmitted: 'neutral',
  selected: 'neutral',
  pending: 'neutral',
  verified: 'green',
  rejected: 'danger',
};

export function DocumentUploadRow({ label, status, uri, onUpload, onRemove }: DocumentUploadRowProps) {
  async function handlePress() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload this document.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) onUpload(result.assets[0].uri);
  }

  function handleRemove() {
    Alert.alert('Remove this photo?', "You'll need to upload it again before submitting.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
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
            accessibilityLabel={`Remove ${label}`}
          >
            <Ionicons name="trash-outline" size={16} color={colors.white} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.uploadBox}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`Upload ${label}`}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.inkSoft} />
          <Text style={styles.uploadText}>Upload</Text>
        </Pressable>
      )}
    </View>
  );
}
