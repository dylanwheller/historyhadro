import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

function RevealStar({ index, earned }: { index: number; earned: boolean }) {
  const scale = useSharedValue(earned ? 0 : 1);
  const spin = useSharedValue(earned ? -40 : 0);

  useEffect(() => {
    if (!earned) return;
    const delay = 350 + index * 420;
    scale.value = withDelay(
      delay,
      withSequence(withTiming(1.6, { duration: 180 }), withSpring(1, { damping: 5 })),
    );
    spin.value = withDelay(delay, withSpring(0, { damping: 6 }));
  }, [earned, index, scale, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${spin.value}deg` }],
  }));

  return (
    <Animated.Text
      style={[{ fontSize: 44, color: '#FCD34D', opacity: earned ? 1 : 0.25 }, style]}
    >
      ★
    </Animated.Text>
  );
}

export default function StarReveal({ stars }: { stars: number }) {
  return (
    <View className="flex-row gap-2 mb-4">
      {[1, 2, 3].map((s) => (
        <RevealStar key={s} index={s - 1} earned={stars >= s} />
      ))}
    </View>
  );
}
