import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { applyForDiscount, getMyDiscount } from '@trisakay/services';
import type { DiscountCategory, PassengerDiscount } from '@trisakay/services';
import { Badge, Button, Card, SegmentedControl, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useAuthStore } from '../../src/store/useAuthStore';
import { styles } from '../../src/styles/profile/apply-discount.styles';

const CATEGORY_OPTIONS: { label: string; value: DiscountCategory }[] = [
  { label: 'Senior', value: 'senior_citizen' },
  { label: 'PWD', value: 'pwd' },
  { label: 'Student', value: 'student' },
];

const CATEGORY_LABEL: Record<DiscountCategory, string> = {
  senior_citizen: 'Senior Citizen',
  pwd: 'PWD',
  student: 'Student',
};

export default function ApplyDiscountScreen() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PassengerDiscount | null>(null);
  const [category, setCategory] = useState<DiscountCategory>('senior_citizen');
  const [frontPhotoUri, setFrontPhotoUri] = useState<string | null>(null);
  const [backPhotoUri, setBackPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function refresh() {
    return getMyDiscount().then((result) => setExisting(result.data));
  }

  const { refreshing, onRefresh } = usePullToRefresh(refresh);

  useEffect(() => {
    let cancelled = false;
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePickPhoto(side: 'front' | 'back') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload your ID.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    if (side === 'front') setFrontPhotoUri(result.assets[0].uri);
    else setBackPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!user) return;
    if (!frontPhotoUri || !backPhotoUri) {
      setFormError('Add photos of both the front and back of your ID before submitting.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const { error } = await applyForDiscount({
      userId: user.id,
      category,
      frontUri: frontPhotoUri,
      backUri: backPhotoUri,
    });
    if (error) {
      setSubmitting(false);
      setFormError(error);
      return;
    }
    await refresh();
    setSubmitting(false);
    setFrontPhotoUri(null);
    setBackPhotoUri(null);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Fare discount" />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Fare discount" />
        <View style={styles.content}>
          <Card style={[styles.card, styles.statusCard]}>
            <Badge
              label={existing.status === 'approved' ? 'Approved' : 'Pending review'}
              tone={existing.status === 'approved' ? 'green' : 'blue'}
            />
            <Text style={styles.statusTitle}>{CATEGORY_LABEL[existing.category]}</Text>
            <Text style={styles.statusNote}>
              {existing.status === 'approved'
                ? 'Your discount is active — it applies automatically to every fare.'
                : 'Submitted for PSO review. You will be notified once a decision is made.'}
            </Text>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Fare discount" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
      >
        <Text style={styles.intro}>
          Senior citizens, PWDs, and students may apply for a fare discount. Upload photos of the
          front and back of your valid ID — a PSO Supervisor checks its authenticity before the
          discount takes effect.
        </Text>

        {existing?.status === 'rejected' && (
          <Card style={[styles.card, styles.statusCard]}>
            <Badge label="Previous application rejected" tone="danger" />
            {existing.remarks && (
              <>
                <Text style={styles.remarksLabel}>Reviewer's note</Text>
                <Text style={styles.remarksBody}>{existing.remarks}</Text>
              </>
            )}
            <Text style={styles.statusNote}>You can submit a new application below.</Text>
          </Card>
        )}

        <View>
          <Text style={styles.sectionLabel}>Category</Text>
          <SegmentedControl options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </View>

        <View style={styles.photoRow}>
          <View style={styles.photoSlot}>
            <Text style={styles.sectionLabel}>ID photo — front</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={frontPhotoUri ? 'Change front ID photo' : 'Add front ID photo'}
              style={[styles.photoUpload, frontPhotoUri && styles.photoUploadFilled]}
              onPress={() => handlePickPhoto('front')}
            >
              {frontPhotoUri ? (
                <>
                  <Image source={{ uri: frontPhotoUri }} style={styles.photoPreview} resizeMode="cover" />
                  <Text style={styles.photoChangeLabel}>Tap to change</Text>
                </>
              ) : (
                <>
                  <Ionicons name="card-outline" size={28} color={colors.inkSoft} />
                  <Text style={styles.photoUploadLabel}>Tap to add the front</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.photoSlot}>
            <Text style={styles.sectionLabel}>ID photo — back</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backPhotoUri ? 'Change back ID photo' : 'Add back ID photo'}
              style={[styles.photoUpload, backPhotoUri && styles.photoUploadFilled]}
              onPress={() => handlePickPhoto('back')}
            >
              {backPhotoUri ? (
                <>
                  <Image source={{ uri: backPhotoUri }} style={styles.photoPreview} resizeMode="cover" />
                  <Text style={styles.photoChangeLabel}>Tap to change</Text>
                </>
              ) : (
                <>
                  <Ionicons name="card-outline" size={28} color={colors.inkSoft} />
                  <Text style={styles.photoUploadLabel}>Tap to add the back</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <Button label="Submit application" fullWidth loading={submitting} onPress={handleSubmit} />

        <Text style={styles.disclaimer}>
          Your ID photo is only visible to you and to PSO Supervisor/Admin reviewers.
        </Text>
      </ScrollView>
    </View>
  );
}
