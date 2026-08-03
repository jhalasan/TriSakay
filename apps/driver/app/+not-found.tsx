import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Text style={[typography.h2, { color: colors.ink }]}>This screen doesn't exist.</Text>
        <Link href="/">
          <Text style={[typography.body, { color: colors.accentBlue }]}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
