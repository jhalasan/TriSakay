import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  Animated,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, BrandMotif, GradientSurface, colors } from '@trisakay/ui';
import { WALKTHROUGH_SEEN_KEY } from '../src/constants/walkthrough';
import { styles } from '../src/styles/walkthrough.styles';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  /** Verified-driver slide only — see iconBadgeVerified in walkthrough.styles.ts. */
  verified?: boolean;
}

const SLIDES: Slide[] = [
  {
    icon: 'car-sport',
    title: 'Book a Ride Easily',
    subtitle: 'Request a tricycle in seconds. Set your pickup and drop-off, and a nearby driver will be on the way.',
  },
  {
    icon: 'receipt-outline',
    title: 'Fare Transparency',
    subtitle:
      'Know your fare before you ride. Pricing follows the approved fare matrix, with a full breakdown shown before you confirm.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Travel Safely with Verified Drivers',
    subtitle: 'Every driver is verified by the PSO. Track your ride in real time, from pickup to drop-off.',
    verified: true,
  },
];

const AnimatedFlatList = Animated.FlatList<Slide>;

function Slide({
  icon,
  title,
  subtitle,
  verified,
  index,
  width,
  scrollX,
}: Slide & { index: number; width: number; scrollX: Animated.Value }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });

  return (
    <View style={[styles.slide, { width }]}>
      <GradientSurface token="hero" direction="vertical" style={styles.hero}>
        <BrandMotif size={300} color="#FFFFFF" opacity={0.08} style={styles.motif} />
        <Animated.View
          style={[styles.iconBadge, verified && styles.iconBadgeVerified, { transform: [{ scale }], opacity }]}
        >
          <Ionicons name={icon} size={48} color={verified ? colors.accentGreenPressed : colors.white} />
        </Animated.View>
      </GradientSurface>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: Animated.Value }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 22, 8], extrapolate: 'clamp' });
  const backgroundColor = scrollX.interpolate({
    inputRange,
    outputRange: [colors.line, colors.accentBlue, colors.line],
    extrapolate: 'clamp',
  });

  return <Animated.View style={[styles.dot, { width: dotWidth, backgroundColor }]} />;
}

export default function WalkthroughScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<Animated.FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const isLast = activeIndex === SLIDES.length - 1;

  const finish = () => {
    void AsyncStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    router.replace('/landing');
  };

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    listRef.current?.scrollToOffset({ offset: (activeIndex + 1) * width, animated: true });
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
  });

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {!isLast && (
        <Pressable style={styles.skip} onPress={finish} hitSlop={8} accessibilityRole="button">
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>
      )}

      <AnimatedFlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.title}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => <Slide {...item} index={index} width={width} scrollX={scrollX} />}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      <View style={styles.chrome}>
        <View style={styles.dots}>
          {SLIDES.map((slide, index) => (
            <Dot key={slide.title} index={index} width={width} scrollX={scrollX} />
          ))}
        </View>
        <Button
          label={isLast ? 'Get Started' : 'Next'}
          onPress={goNext}
          fullWidth
          accessibilityRole="button"
        />
      </View>
    </SafeAreaView>
  );
}
