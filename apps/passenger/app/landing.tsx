import { useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, Button, GradientSurface } from '@trisakay/ui';
import { styles } from '../src/styles/landing.styles';

/**
 * The choice point a first-time rider lands on after the walkthrough:
 * Get Started (register) or I already have an account (login). Reached
 * once per device — see walkthrough.tsx's finish() and splash.tsx's
 * WALKTHROUGH_SEEN_KEY check for how a rider gets routed here.
 */
export default function LandingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <GradientSurface token="hero" direction="vertical" style={styles.hero}>
        <BrandMotif size={260} color="#FFFFFF" opacity={0.1} style={styles.motif} />
        <Image
          source={require('../../../assets/trike-asset.webp')}
          style={styles.heroImage}
          resizeMode="contain"
          accessibilityLabel="TriSakay tricycles"
        />
      </GradientSurface>

      <View style={styles.body}>
        <View>
          <View style={styles.badgeWrap}>
            <View style={styles.badge}>
              <Image
                source={require('../../../assets/brand/trisakay-lockup.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="TriSakay"
              />
            </View>
          </View>
          <View style={styles.copy}>
            <Text style={styles.tagline}>Smarter Ride, Smarter Gensan</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Get Started" onPress={() => router.replace('/(auth)/register')} fullWidth />
          <Button
            label="I already have an account"
            variant="outline"
            tone="neutral"
            fullWidth
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
