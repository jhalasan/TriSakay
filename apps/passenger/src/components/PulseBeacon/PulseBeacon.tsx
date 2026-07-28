import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { motion } from '@trisakay/ui';
import { styles } from './PulseBeacon.styles';

export interface PulseBeaconProps {
  /** Diameter of the solid core. Rings expand out from this. */
  size?: number;
  /** Number of staggered rings. */
  rings?: number;
  children?: React.ReactNode;
}

/**
 * The signature moment of the ride flow: while we look for a driver, the
 * screen is alive rather than a spinner on a static page. Rings expand and
 * fade on a stagger, easing out so each wave decelerates as it dissipates.
 */
export function PulseBeacon({ size = 72, rings = 3, children }: PulseBeaconProps) {
  const progress = useMemo(
    () => Array.from({ length: rings }, () => new Animated.Value(0)),
    [rings],
  );
  const animations = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const loops = progress.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((motion.duration.pulse / rings) * index),
          Animated.timing(value, {
            toValue: 1,
            duration: motion.duration.pulse,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );

    animations.current = Animated.parallel(loops);
    animations.current.start();

    return () => {
      animations.current?.stop();
      progress.forEach((v) => v.setValue(0));
    };
  }, [progress, rings]);

  return (
    <View style={[styles.container, { width: size * 3, height: size * 3 }]}>
      {progress.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [
                { scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) },
              ],
            },
          ]}
        />
      ))}
      <View style={[styles.core, { width: size, height: size }]}>{children}</View>
    </View>
  );
}
