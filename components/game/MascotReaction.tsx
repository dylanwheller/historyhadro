import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Mood } from '@/lib/reactions';

type Props = {
  mood: Mood;
  // Bump to replay the same mood (e.g. two correct answers in a row).
  moodKey: number;
  message?: string;
  size?: number;
  // Defaults to the app's mascot; pass the player's chosen avatar to personalise it.
  source?: ImageSourcePropType;
  // "overlay" keeps the layout footprint to just the mascot; the bubble floats below it.
  bubble?: 'inline' | 'overlay';
};

export default function MascotReaction({ mood, moodKey, message, size = 64, bubble = 'inline', source }: Props) {
  const bob = useSharedValue(0);
  const jump = useSharedValue(0);
  const squash = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(withTiming(-3, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );
    return () => cancelAnimation(bob);
  }, [bob]);

  useEffect(() => {
    if (moodKey === 0) return;
    if (mood === 'happy' || mood === 'celebrate') {
      const height = mood === 'celebrate' ? -size * 0.6 : -size * 0.32;
      const hops = mood === 'celebrate' ? 2 : 1;
      let hop = withSequence(withTiming(height, { duration: 170 }), withSpring(0, { damping: 6 }));
      for (let i = 1; i < hops; i++) {
        hop = withSequence(hop, withTiming(height, { duration: 170 }), withSpring(0, { damping: 6 }));
      }
      jump.value = hop;
      squash.value = withSequence(
        withTiming(1.12, { duration: 120 }),
        withSpring(1, { damping: 5 }),
      );
      tilt.value = withSequence(
        withTiming(mood === 'celebrate' ? 14 : 8, { duration: 100 }),
        withTiming(mood === 'celebrate' ? -14 : -8, { duration: 140 }),
        withTiming(0, { duration: 120 }),
      );
    } else if (mood === 'sad') {
      jump.value = withSequence(withTiming(size * 0.08, { duration: 160 }), withDelay(500, withSpring(0)));
      squash.value = withSequence(withTiming(0.92, { duration: 160 }), withDelay(500, withSpring(1)));
      tilt.value = withSequence(
        withTiming(-9, { duration: 200 }),
        withDelay(450, withSpring(0, { damping: 8 })),
      );
    }
  }, [moodKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value + jump.value },
      { rotate: `${tilt.value}deg` },
      { scale: squash.value },
    ],
  }));

  const mascot = (
    <Animated.View style={mascotStyle}>
      <Image
        source={source ?? require('../../assets/dinos/avatar.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );

  if (bubble === 'overlay') {
    return (
      <View style={{ width: size, height: size }}>
        {mascot}
        {message ? (
          <View style={{ position: 'absolute', top: size + 2, left: 0, width: 200, zIndex: 30 }} pointerEvents="none">
            <Animated.View
              key={`${moodKey}-${message}`}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(150)}
              className="bg-card border border-border rounded-2xl px-3 py-1.5 self-start"
            >
              <Text className="text-foreground font-bold text-sm">{message}</Text>
            </Animated.View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3">
      {mascot}
      {message ? (
        <Animated.View
          key={`${moodKey}-${message}`}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          className="bg-card border border-border rounded-2xl px-3 py-2"
        >
          <Text className="text-foreground font-bold">{message}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
