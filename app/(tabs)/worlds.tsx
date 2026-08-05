import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, Star, ChevronRight } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useGame } from '@/lib/GameContext';
import { useSubscription } from '@/lib/SubscriptionContext';
import { WORLDS } from '@/data/worlds';
import PaywallScreen from '@/components/screens/PaywallScreen';
import { CopilotStep, walkthroughable } from 'react-native-copilot';

const CopilotView = walkthroughable(View);

// Gradient pairs keyed by world id
const WORLD_COLORS: Record<number, [string, string]> = {
  1: ['#f97316', '#7c2d12'],
  2: ['#a855f7', '#4c1d95'],
  3: ['#06b6d4', '#164e63'],
  4: ['#eab308', '#78350f'],
};

// --- Floating particle ---
const Particle = ({ color }: { color: string }) => {
  const offset = useSharedValue(0);
  React.useEffect(() => {
    offset.value = withRepeat(
      withSequence(withTiming(-20, { duration: 2000 }), withTiming(20, { duration: 2000 })),
      -1,
      true,
    );
    return () => cancelAnimation(offset);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: 0.5,
  }));
  return (
    <Animated.View
      style={[
        style,
        { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: color },
      ]}
    />
  );
};

// --- Card data shape ---
type WorldCardData = {
  id: number;
  name: string;
  subject: string;
  icon: string;
  colors: [string, string];
  levelsCompleted: number;
  totalLevels: number;
  stars: number;
  bossDefeated: boolean;
  unlocked: boolean;
};

// --- World card ---
const WorldCard = ({ world, onPress }: { world: WorldCardData; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    className="mb-6 mx-4 active:scale-95"
    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
  >
    <LinearGradient
      colors={world.unlocked ? world.colors : ['#334155', '#1e293b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-3xl overflow-hidden relative h-48"
    >
      {world.unlocked && (
        <>
          <Particle color={world.colors[0]} />
          <Particle color={world.colors[1]} />
          <Particle color="#ffffff" />
        </>
      )}

      <View className="flex-1 p-5 justify-between relative z-10">
        {/* Top row */}
        <View className="flex-row justify-between items-start">
          <View className="bg-white/20 p-3 rounded-2xl" style={{ opacity: world.unlocked ? 1 : 0.35 }}>
            <Text style={{ fontSize: 28 }}>{world.icon}</Text>
          </View>
          <View className="flex-row gap-2">
            {world.bossDefeated && world.unlocked && (
              <View className="bg-yellow-400/90 px-2 py-1 rounded-full flex-row items-center gap-1">
                <Text className="text-yellow-900 text-xs font-bold">⚔️ Boss slain</Text>
              </View>
            )}
            {!world.unlocked && (
              <View className="bg-black/40 p-2 rounded-full">
                <Lock size={20} color="#cbd5e1" />
              </View>
            )}
          </View>
        </View>

        {/* Title */}
        <View className="flex-1 justify-center mt-2">
          <Text className="text-white text-2xl font-bold">{world.name}</Text>
          <Text className="text-white/80 text-sm mt-1">{world.subject}</Text>
        </View>

        {/* Bottom row — progress */}
        <View className="flex-row items-end justify-between">
          <View className="flex-1 mr-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Star size={16} color="#FCD34D" fill={world.stars > 0 ? '#FCD34D' : 'transparent'} />
              <Text className="text-white text-sm">
                {world.stars}/{world.totalLevels * 3} stars
              </Text>
              <Text className="text-white/60 text-xs">
                · {world.levelsCompleted}/{world.totalLevels} levels
              </Text>
            </View>
            <View className="h-2 bg-black/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-white rounded-full"
                style={{ width: `${Math.round((world.levelsCompleted / world.totalLevels) * 100)}%` }}
              />
            </View>
          </View>
          <ChevronRight size={24} color={world.unlocked ? '#fff' : '#64748b'} />
        </View>
      </View>

      {!world.unlocked && <View className="absolute inset-0 bg-black/30" />}
    </LinearGradient>
  </Pressable>
);

// --- Screen ---
export default function WorldsScreen() {
  const router = useRouter();
  const { hasAccess } = useSubscription();
  const { game } = useGame();
  const worldProgress = game.worldProgress;
  const [paywallOpen, setPaywallOpen] = useState(false);

  const worlds = useMemo<WorldCardData[]>(() => {
    return WORLDS.map((world) => {
      const wp = worldProgress[world.id];
      const levelsCompleted = wp
        ? Object.values(wp.levels).filter((l) => l.stars > 0).length
        : 0;
      const stars = wp
        ? Object.values(wp.levels).reduce((sum, l) => sum + (l.stars ?? 0), 0)
        : 0;
      const bossDefeated = wp?.bossDefeated ?? false;
      // World 1 is always free.
      // Worlds 2-4 require premium access AND the previous world's boss defeated —
      // premium buys access but you still have to earn each world through play.
      const prevBossDefeated =
        world.id === 1 ||
        (worldProgress[world.id - 1]?.bossDefeated ?? false);
      const unlocked = (world.id === 1 || hasAccess) && prevBossDefeated;

      return {
        id: world.id,
        name: world.name,
        subject: world.subject,
        icon: world.icon,
        colors: WORLD_COLORS[world.id],
        levelsCompleted,
        totalLevels: world.levels,
        stars,
        bossDefeated,
        unlocked,
      };
    });
  }, [worldProgress, hasAccess]);

  const handleWorldPress = useCallback(
    (world: WorldCardData) => {
      if (world.id !== 1 && !hasAccess) {
        setPaywallOpen(true);
        return;
      }
      if (!world.unlocked) return; // progress-locked — defeat the previous world's boss first
      router.push(`/world/${world.id}`);
    },
    [hasAccess, router],
  );

  const allBossesDefeated = useMemo(
    () => [1, 2, 3, 4].every((w) => worldProgress[w]?.bossDefeated ?? false),
    [worldProgress],
  );
  const finalBossDefeated = worldProgress[0]?.bossDefeated ?? false;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header — step 3 of the tour */}
      <CopilotStep
        name="worlds-list"
        order={3}
        text="Choose a world to explore. Each has 5 levels and a boss battle!"
      >
        <CopilotView collapsable={false}>
          <Text className="text-sm text-muted-foreground">Your Journey</Text>
          <Text className="text-2xl font-bold text-foreground">History Worlds</Text>
        </CopilotView>
      </CopilotStep>

      <ScrollView
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {worlds.map((world) =>
          world.id === 1 ? (
            <CopilotStep
              key={world.id}
              name="world-levels"
              order={4}
              text="Each world has 5 levels and a boss battle. Tap to explore and earn stars!"
            >
              <CopilotView className="relative" collapsable={false}>
                <WorldCard world={world} onPress={() => handleWorldPress(world)} />
              </CopilotView>
            </CopilotStep>
          ) : (
            <View key={world.id} className="relative">
              <WorldCard world={world} onPress={() => handleWorldPress(world)} />
              {world.id !== 1 && !hasAccess && (
                <View className="absolute top-4 left-8 bg-primary px-3 py-1 rounded-full flex-row items-center gap-1">
                  <Star size={12} color="#fff" fill="#fff" />
                  <Text className="text-white text-xs font-bold">Premium</Text>
                </View>
              )}
            </View>
          ),
        )}

        {/* ── Final Boss card ── */}
        {allBossesDefeated && (
          <Pressable
            onPress={() => !finalBossDefeated && router.push('/(tabs)/finalboss' as any)}
            className="mb-6 mx-4 active:scale-95"
            style={{ shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12 }}
          >
            <View
              className="rounded-3xl overflow-hidden h-36"
              style={{ backgroundColor: finalBossDefeated ? '#451a03' : '#1e0050' }}
            >
              <View className="flex-1 p-5 justify-between">
                <View className="flex-row justify-between items-start">
                  <Text style={{ fontSize: 32 }}>📜</Text>
                  <View style={{ backgroundColor: finalBossDefeated ? '#fbbf2430' : '#7c3aed30', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: finalBossDefeated ? '#fbbf24' : '#c4b5fd', fontSize: 11, fontWeight: 'bold' }}>
                      {finalBossDefeated ? '👑 LEGENDARY' : '⚡ FINAL BOSS'}
                    </Text>
                  </View>
                </View>
                <View>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>The Eternal Chronicler</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                    {finalBossDefeated ? 'Defeated — you are a HistoryHadro Legend!' : 'All worlds combined · 1 000 XP'}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      </ScrollView>

      {paywallOpen && (
        <PaywallScreen modal onClose={() => setPaywallOpen(false)} />
      )}
    </SafeAreaView>
  );
}
