import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AchievementService from '@/services/AchievementService';
import { ACHIEVEMENTS } from '@/data/achievements';

export default function AchievementsScreen() {
  const unlockedIds: string[] = AchievementService.getUnlockedIds();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-2xl font-bold text-foreground">Achievements</Text>
        <Text className="text-muted-foreground mt-1">
          {unlockedIds.length}/{ACHIEVEMENTS.length} unlocked
        </Text>
      </View>

      <FlatList
        data={ACHIEVEMENTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 128 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => {
          const unlocked = unlockedIds.includes(item.id);
          return (
            <View
              className="bg-card border border-border rounded-2xl p-4 flex-row items-center gap-4"
              style={unlocked ? undefined : { opacity: 0.45 }}
            >
              <Text className="text-4xl">{item.icon}</Text>
              <View className="flex-1">
                <Text className="font-bold text-foreground">{item.title}</Text>
                <Text className="text-sm text-muted-foreground">{item.description}</Text>
              </View>
              {unlocked && <Text className="text-green-400 text-lg">✓</Text>}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
