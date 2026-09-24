import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const COLORS = ['#7ED321', '#F5A623', '#4A90E2', '#EC4899', '#8B5CF6', '#FCD34D'];
const DURATION = 1300;

type Particle = { dx: number; dy: number; rot: number; size: number; color: string; round: boolean };

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const speed = 120 + Math.random() * 190;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      rot: (Math.random() - 0.5) * 900,
      size: 7 + Math.random() * 7,
      color: COLORS[i % COLORS.length],
      round: Math.random() < 0.35,
    };
  });
}

function Piece({ p, progress }: { p: Particle; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35),
      transform: [
        { translateX: p.dx * t },
        { translateY: p.dy * t + 420 * t * t },
        { rotate: `${p.rot * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: p.size,
          height: p.round ? p.size : p.size * 0.55,
          borderRadius: p.round ? p.size / 2 : 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

type Props = { burstKey: number; count?: number };

export default function ConfettiBurst({ burstKey, count = 16 }: Props) {
  const progress = useSharedValue(0);
  const particles = useMemo(() => makeParticles(count), [burstKey, count]);

  useEffect(() => {
    if (burstKey === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) });
  }, [burstKey, progress]);

  if (burstKey === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Piece key={`${burstKey}-${i}`} p={p} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  piece: {
    position: 'absolute',
  },
});
