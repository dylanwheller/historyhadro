import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, Animated } from 'react-native';

export type PendingAchievementPopup = {
  id: string;
  title: string;
  icon: string;
};

type Props = {
  queue: PendingAchievementPopup[];
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 2800;

export default function AchievementUnlockPopup({ queue, onDismiss }: Props) {
  const current = queue[0] ?? null;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    scale.setValue(0.8);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.8, duration: 150, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  if (!current) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={dismiss}
      className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center bg-black/50 z-50"
    >
      <Animated.View
        style={{ transform: [{ scale }], opacity }}
        className="bg-card border border-border rounded-2xl shadow-2xl p-5 mx-10 items-center gap-2"
      >
        <Text style={{ fontSize: 40 }}>{current.icon}</Text>
        <Text className="text-primary text-xs font-bold uppercase tracking-wider">Achievement Unlocked!</Text>
        <Text className="text-foreground text-lg font-bold text-center">{current.title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
