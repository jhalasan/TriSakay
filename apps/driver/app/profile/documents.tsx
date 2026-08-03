import { ScrollView, View } from 'react-native';
import { Button } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { DocumentUploadRow } from '../../src/components/DocumentUploadRow';
import { useDocumentsStore } from '../../src/store/useDocumentsStore';
import { DOCUMENT_LABEL, DOCUMENT_TYPES } from '../../src/types/document';
import { styles } from '../../src/styles/profile/documents.styles';

export default function DocumentsScreen() {
  const statuses = useDocumentsStore((state) => state.statuses);
  const submit = useDocumentsStore((state) => state.submit);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Documents & tricycle" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {DOCUMENT_TYPES.map((type) => (
          <DocumentUploadRow
            key={type}
            label={DOCUMENT_LABEL[type]}
            status={statuses[type]}
            onUpload={() => submit(type)}
          />
        ))}
        <Button label="Save & submit" fullWidth onPress={() => {}} disabled />
      </ScrollView>
    </View>
  );
}
