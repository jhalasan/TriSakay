import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import { BrandMotif } from '../components/BrandMotif';
import { GradientSurface } from '../components/GradientSurface';
import { colors } from '../theme';
import { styles } from './WelcomeSheet.styles';

export interface WelcomeSheetProps {
  /** The signed-in user's first name — greeting reads "Hi {firstName}!"; falls back to a name-less greeting when unknown. */
  firstName?: string | null;
  body: string;
  logoSource: ImageSourcePropType;
  onSkip: () => void;
  onTakeTour: () => void;
}

/**
 * Step-0 welcome sheet. `chevron texture overlay at 5%` + `chevron motif
 * watermark at 14% top-right` (per the handoff) are the same BrandMotif
 * component already used across the app's hero bands, layered twice at two
 * opacities/sizes — no new texture asset.
 */
export function WelcomeSheet({ firstName, body, logoSource, onSkip, onTakeTour }: WelcomeSheetProps) {
  const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';

  return (
    <View style={styles.welcomeBackdrop}>
      <View style={styles.welcomeSheetShadowWrap}>
        <GradientSurface token="hero" direction="diagonal" style={styles.welcomeSheet}>
          <BrandMotif size={340} color={colors.white} opacity={0.05} style={styles.welcomeWash} />
          <BrandMotif size={140} color={colors.white} opacity={0.14} style={styles.welcomeWatermark} />
          <View style={styles.welcomeLogoTile}>
            <Image source={logoSource} style={styles.welcomeLogoMark} resizeMode="contain" />
          </View>
          <Text style={styles.welcomeTitle}>{greeting}</Text>
          <Text style={styles.welcomeBody}>{body}</Text>
          <View style={styles.welcomeActions}>
            <Pressable accessibilityRole="button" style={styles.welcomeSkipButton} onPress={onSkip}>
              <Text style={styles.welcomeSkipLabel}>Skip</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.welcomeTakeTourButton} onPress={onTakeTour}>
              <Text style={styles.welcomeTakeTourLabel}>Take the tour</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.accentBlue} />
            </Pressable>
          </View>
        </GradientSurface>
      </View>
    </View>
  );
}
