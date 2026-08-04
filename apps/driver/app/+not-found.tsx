import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, EmptyState } from '@trisakay/ui';
import { styles } from '../src/styles/not-found.styles';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <EmptyState title="Page not found" message="This screen doesn't exist." />
      <Button label="Back to Home" onPress={() => router.replace('/(tabs)/dashboard')} />
    </View>
  );
}
