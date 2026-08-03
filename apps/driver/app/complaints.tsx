import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Textarea, TextField, type BadgeTone } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useComplaintsStore, type ComplaintStatus } from '../src/store/useComplaintsStore';
import { isNonEmpty } from '../src/utils/validation';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/complaints.styles';

const STATUS_LABEL: Record<ComplaintStatus, string> = { open: 'Open', review: 'Review', closed: 'Closed' };
const STATUS_TONE: Record<ComplaintStatus, BadgeTone> = { open: 'blue', review: 'neutral', closed: 'green' };

export default function ComplaintsScreen() {
  const complaints = useComplaintsStore((state) => state.complaints);
  const addComplaint = useComplaintsStore((state) => state.addComplaint);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isNonEmpty(subject) && isNonEmpty(message);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await wait(600);
    addComplaint({ id: `c-${complaints.length + 1}`, subject, status: 'open' });
    setSubject('');
    setMessage('');
    setSubmitting(false);
    setComposing(false);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Complaints"
        right={
          <Text onPress={() => setComposing((prev) => !prev)} style={styles.newToggleText}>
            {composing ? 'Cancel' : 'New'}
          </Text>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {composing ? (
            <View style={styles.formGap}>
              <TextField label="Subject" placeholder="What's this about?" value={subject} onChangeText={setSubject} />
              <Textarea label="Message" placeholder="Describe what happened" value={message} onChangeText={setMessage} />
              <Button label="Submit complaint" fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
            </View>
          ) : complaints.length === 0 ? (
            <EmptyState title="No complaints" message="Complaints you submit will appear here." />
          ) : (
            <View style={styles.listContent}>
              {complaints.map((item) => (
                <Card key={item.id} style={styles.cardRow}>
                  <View style={styles.subjectRow}>
                    <Text style={styles.subject}>{item.subject}</Text>
                    <Badge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
