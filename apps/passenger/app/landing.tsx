import { useRouter } from 'expo-router';
import { Image, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BrandMotif, Button, moderateScale } from '@trisakay/ui';
import { useReducedMotionEntering } from '../src/components/useReducedMotionEntering';
import { styles } from '../src/styles/landing.styles';

/**
 * The choice point a first-time rider lands on after the walkthrough:
 * Get Started (register) or I already have an account (login). Reached
 * once per device — see walkthrough.tsx's finish() and splash.tsx's
 * WALKTHROUGH_SEEN_KEY check for how a rider gets routed here.
 */
export default function LandingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = (value: number) => moderateScale(value, width);

  const topInset = Math.max(insets.top, scale(44));
  const bottomInset = Math.max(insets.bottom, scale(34));

  const headlineEntering = useReducedMotionEntering(() =>
    FadeIn.duration(600).delay(300).withInitialValues({ opacity: 0, transform: [{ translateY: scale(18) }] }),
  );
  const bodyEntering = useReducedMotionEntering(() =>
    FadeIn.duration(600).delay(420).withInitialValues({ opacity: 0, transform: [{ translateY: scale(18) }] }),
  );
  const trikeEntering = useReducedMotionEntering(() =>
    FadeIn.duration(850).delay(500).withInitialValues({ opacity: 0, transform: [{ translateX: -scale(30) }, { translateY: scale(10) }] }),
  );
  const actionsEntering = useReducedMotionEntering(() =>
    FadeIn.duration(550).delay(560).withInitialValues({ opacity: 0, transform: [{ translateY: scale(18) }] }),
  );

  return (
    <View style={styles.root}>
      <View style={{ height: topInset }} />

      <BrandMotif
        size={480}
        color="rgba(0, 46, 96, 0.06)"
        chevronColor="rgba(71, 116, 52, 0.16)"
        opacity={1}
        style={styles.motif}
      />

      <View style={styles.header}>
        <Image
          source={require('../../../assets/brand/trisakay-lockup.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="TriSakay"
        />
        <Animated.Text entering={headlineEntering} style={styles.headline}>
          Smarter ride,{'\n'}
          <Text style={styles.headlineAccent}>smarter Gensan.</Text>
        </Animated.Text>
        <Animated.Text entering={bodyEntering} style={styles.body}>
          Tricycle booking for General Santos City — fixed fares, verified drivers, no haggling.
        </Animated.Text>
      </View>

      <View style={styles.trikeBand}>
        <Animated.Image
          entering={trikeEntering}
          source={require('../../../assets/trike-asset.webp')}
          style={styles.trikeImage}
          resizeMode="contain"
          accessibilityLabel="TriSakay tricycles"
        />
      </View>

      <Animated.View entering={actionsEntering} style={styles.actions}>
        <Button label="Get Started" onPress={() => router.replace('/(auth)/register')} fullWidth />
        <Button
          label="I already have an account"
          variant="outline"
          tone="neutral"
          fullWidth
          onPress={() => router.replace('/(auth)/login')}
        />
      </Animated.View>

      <View style={{ height: bottomInset }} />
    </View>
  );
}
