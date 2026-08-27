import { useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Button, colors, moderateScale } from '@trisakay/ui';
import { MapGround } from '../src/components/MapGround';
import {
  WalkthroughFareIllustration,
  WalkthroughRouteIllustration,
  WalkthroughVerifiedIllustration,
} from '../src/components/illustrations';
import {
  WALKTHROUGH_SEEN_KEY,
  WALKTHROUGH_SLIDES,
  type WalkthroughIllustration,
  type WalkthroughSlide,
} from '../src/constants/walkthrough';
import { DOT_ACTIVE_WIDTH, DOT_INACTIVE_WIDTH, styles } from '../src/styles/walkthrough.styles';

const ILLUSTRATIONS: Record<WalkthroughIllustration, () => React.JSX.Element> = {
  route: WalkthroughRouteIllustration,
  fare: WalkthroughFareIllustration,
  verified: WalkthroughVerifiedIllustration,
};

const AnimatedFlatList = Animated.FlatList<WalkthroughSlide>;

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, inputRange, [DOT_INACTIVE_WIDTH, DOT_ACTIVE_WIDTH, DOT_INACTIVE_WIDTH], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, inputRange, [colors.line, colors.accentBlue, colors.line]),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

function Slide({
  slide,
  index,
  width,
  scrollX,
  topInset,
  bottomInset,
  onNext,
  onSkip,
}: {
  slide: WalkthroughSlide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  topInset: number;
  bottomInset: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isLast = index === WALKTHROUGH_SLIDES.length - 1;
  const Illustration = ILLUSTRATIONS[slide.illustration];

  return (
    <View style={[styles.slide, { width }]}>
      <MapGround style={styles.mapBand}>
        <View style={{ height: topInset }} />
        <View style={styles.counterRow}>
          <Text style={styles.counter}>{`Step ${String(index + 1).padStart(2, '0')} of 03`}</Text>
          <Pressable onPress={onSkip} disabled={isLast} hitSlop={8} accessibilityRole="button" style={styles.skip}>
            <Text style={[styles.skipLabel, isLast && styles.skipHidden]}>Skip</Text>
          </Pressable>
        </View>
        <View style={styles.illustrationArea}>
          <Illustration />
        </View>
      </MapGround>

      <View style={styles.sheet}>
        <Text style={styles.headline}>{slide.title}</Text>
        <Text style={styles.body}>{slide.subtitle}</Text>
        <View style={styles.ctaRow}>
          <Button
            label={isLast ? 'Get Started' : 'Next'}
            onPress={isLast ? onSkip : onNext}
            fullWidth
            accessibilityRole="button"
          />
        </View>
        <View style={styles.dots}>
          {WALKTHROUGH_SLIDES.map((_, dotIndex) => (
            <Dot key={dotIndex} index={dotIndex} width={width} scrollX={scrollX} />
          ))}
        </View>
        <View style={{ height: bottomInset }} />
      </View>
    </View>
  );
}

export default function WalkthroughScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<Animated.FlatList<WalkthroughSlide>>(null);
  const scrollX = useSharedValue(0);

  const topInset = Math.max(insets.top, moderateScale(44, width));
  const bottomInset = Math.max(insets.bottom, moderateScale(34, width));

  const finish = () => {
    void AsyncStorage.setItem(WALKTHROUGH_SEEN_KEY, '1');
    router.replace('/landing');
  };

  const goNext = (index: number) => {
    listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <View style={styles.root}>
      <AnimatedFlatList
        ref={listRef}
        data={WALKTHROUGH_SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.illustration}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <Slide
            slide={item}
            index={index}
            width={width}
            scrollX={scrollX}
            topInset={topInset}
            bottomInset={bottomInset}
            onNext={() => goNext(index)}
            onSkip={finish}
          />
        )}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />
    </View>
  );
}
