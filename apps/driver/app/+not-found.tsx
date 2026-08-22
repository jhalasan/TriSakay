import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, EmptyState } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { styles } from '../src/styles/not-found.styles';

export default function NotFoundScreen() {
  const router = useRouter();
  const t = useTranslation();

  return (
    <View style={styles.container}>
      <EmptyState title={t.driver.notFound.title} message={t.driver.notFound.message} />
      <Button label={t.driver.notFound.backToHome} onPress={() => router.replace('/(tabs)/dashboard')} />
    </View>
  );
}
