import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/lib/GameContext';
import { useUser } from '@/lib/UserContext';
import { WORLDS } from '@/data/worlds';

function StarRow({ stars }: { stars: number }) {
  return (
    <View className="flex-row gap-0.5">
      {[1, 2, 3].map((s) => (
        <Text
          key={s}
          className={`text-base ${stars >= s ? 'text-yellow-400' : 'text-slate-600'}`}
          style={{ opacity: stars >= s ? 1 : 0.5 }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

export default function WorldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const worldId = parseInt(id ?? '1', 10);
  const router = useRouter();
  const { game } = useGame();
  const worldProgress = game.worldProgress;
  const { user, setAgeRange } = useUser();

  const world = useMemo(() => WORLDS.find((w) => w.id === worldId), [worldId]);
  const wp = worldProgress[worldId];

  // Mid-level resume progress: map of levelId → questions answered so far.
  // Loaded from AsyncStorage so we can show "3 of 10 answered" on in-progress levels.
  const [resumeProgress, setResumeProgress] = useState<Record<number, number>>({});

  const loadResumeProgress = useCallback(async () => {
    const entries: Record<number, number> = {};
    await Promise.all(
      [1, 2, 3, 4, 5].map(async (lId) => {
        try {
          const raw = await AsyncStorage.getItem(`@historyhadro_lvl_${worldId}_${lId}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { qIndex?: number };
            if ((parsed.qIndex ?? 0) > 0) entries[lId] = parsed.qIndex!;
          }
        } catch { /* ignore */ }
      }),
    );
    setResumeProgress(entries);
  }, [worldId]);

  // Load on mount and re-load whenever the screen comes back into focus
  // (so the label updates after the user exits a level mid-way).
  useEffect(() => { loadResumeProgress(); }, [loadResumeProgress]);
  useFocusEffect(useCallback(() => { loadResumeProgress(); }, [loadResumeProgress]));

  if (!world) return null;

  const levelStars = (levelId: number): number => wp?.levels[String(levelId)]?.stars ?? 0;

  const levelUnlocked = (levelId: number): boolean => {
    if (levelId === 1) return true;
    return levelStars(levelId - 1) > 0;
  };

  const allLevelsComplete = [1, 2, 3, 4, 5].every((l) => levelStars(l) > 0);
  const bossDefeated = wp?.bossDefeated ?? false;

  const handleLevel = (levelId: number) => {
    if (!levelUnlocked(levelId)) return;
    router.push(`/level/${worldId}/${levelId}`);
  };

  const handleBoss = () => {
    if (!allLevelsComplete) return;
    router.push(`/boss/${worldId}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View
          className="px-4 pt-4 pb-8 items-center"
          style={{ backgroundColor: world.accentColor + '22' }}
        >
          {/* Back button — always returns to worlds list regardless of nav history */}
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/worlds')}
            className="self-start mb-2 p-2 rounded-full bg-black/10"
            activeOpacity={0.7}
          >
            <Text className="text-foreground text-lg">‹ Worlds</Text>
          </TouchableOpacity>
          <Text className="text-5xl mb-2">{world.icon}</Text>
          <Text className="text-2xl font-bold text-foreground text-center">{world.name}</Text>
          <Text className="text-muted-foreground mt-1">{world.subject}</Text>
        </View>

        {/* Age Range Toggle */}
        <View className="px-4 pt-4">
          <Text className="text-sm text-muted-foreground mb-2">Question difficulty</Text>
          <View className="flex-row bg-card border border-border rounded-xl overflow-hidden">
            {(['junior', 'senior'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => setAgeRange(range)}
                className="flex-1 py-2.5 items-center"
                style={user.ageRange === range ? { backgroundColor: world.accentColor } : undefined}
              >
                <Text
                  className={`font-semibold capitalize ${user.ageRange === range ? 'text-white' : 'text-foreground'}`}
                >
                  {range === 'junior' ? 'Junior (6–9)' : 'Senior (10–13)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Level Grid */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Levels</Text>
          <View className="gap-3">
            {[1, 2, 3, 4, 5].map((levelId) => {
              const unlocked = levelUnlocked(levelId);
              const stars = levelStars(levelId);
              return (
                <TouchableOpacity
                  key={levelId}
                  onPress={() => handleLevel(levelId)}
                  activeOpacity={unlocked ? 0.7 : 1}
                  className="bg-card border border-border rounded-2xl p-4 flex-row items-center"
                  style={unlocked ? undefined : { opacity: 0.45 }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-4"
                    style={{ backgroundColor: world.accentColor + '33' }}
                  >
                    <Text className="font-bold" style={{ color: world.accentColor }}>
                      {unlocked ? String(levelId) : '🔒'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">Level {levelId}</Text>
                    {stars > 0 && <StarRow stars={stars} />}
                    {stars === 0 && unlocked && resumeProgress[levelId] ? (
                      <Text className="text-xs text-amber-500">
                        {resumeProgress[levelId]} of 10 answered
                      </Text>
                    ) : stars === 0 && unlocked && wp?.levels[String(levelId)] ? (
                      <Text className="text-xs text-amber-500">Need 6+ correct to pass</Text>
                    ) : stars === 0 && unlocked ? (
                      <Text className="text-xs text-muted-foreground">Not started</Text>
                    ) : null}
                  </View>
                  <Text className="text-muted-foreground text-lg">›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Boss */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Boss Battle</Text>
          <TouchableOpacity
            onPress={handleBoss}
            activeOpacity={allLevelsComplete ? 0.7 : 1}
            className="bg-card border border-border rounded-2xl p-4 flex-row items-center"
            style={allLevelsComplete ? undefined : { opacity: 0.45 }}
          >
            <View className="w-10 h-10 rounded-full items-center justify-center mr-4 bg-red-500/20">
              <Text className="text-xl">{allLevelsComplete ? '⚔️' : '🔒'}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-foreground">{world.bossName}</Text>
              <Text className="text-xs text-muted-foreground">
                {bossDefeated
                  ? 'Defeated!'
                  : allLevelsComplete
                  ? 'Ready to challenge'
                  : 'Complete all levels to unlock'}
              </Text>
            </View>
            {bossDefeated && <Text className="text-yellow-400">✓</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
