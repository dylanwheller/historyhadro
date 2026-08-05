import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/lib/UserContext';
import { getLeaderboard } from '@/lib/firebase';

type Period = 'weekly' | 'allTime';

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  points: number;
  updatedAt?: { toDate?: () => Date; seconds?: number } | null;
};

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() - ((day + 6) % 7)); // back to Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function entryUpdatedAt(entry: LeaderboardEntry): Date | null {
  const ts = entry.updatedAt;
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export default function LeaderboardScreen() {
  const { user } = useUser();
  const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('weekly');

  const load = useCallback(async () => {
    try {
      const raw = await getLeaderboard(100);
      setAllEntries(
        (raw as any[]).map((d) => ({
          uid: d.uid,
          displayName: d.displayName || 'Anonymous',
          points: d.points || 0,
          updatedAt: d.updatedAt ?? null,
        }))
      );
    } catch (err) {
      console.warn('[Leaderboard] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const weekStart = getWeekStart();
  const entries: LeaderboardEntry[] =
    period === 'weekly'
      ? allEntries.filter((e) => {
          const d = entryUpdatedAt(e);
          return d !== null && d >= weekStart;
        })
      : allEntries;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">Leaderboard</Text>
      </View>

      {/* Period tabs */}
      <View className="flex-row mx-6 mb-4 gap-2">
        {([['weekly', 'This Week'], ['allTime', 'All Time']] as [Period, string][]).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => setPeriod(id)}
            className={`px-4 py-1.5 rounded-full border ${
              period === id
                ? 'bg-primary border-primary'
                : 'bg-transparent border-primary/40'
            }`}
          >
            <Text className={`text-sm font-semibold font-nunito ${
              period === id ? 'text-white' : 'text-foreground'
            }`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 128 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {entries.length === 0 ? (
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-4xl mb-4">🏆</Text>
              <Text className="text-foreground font-semibold text-lg">No scores yet</Text>
              <Text className="text-muted-foreground text-center mt-2 text-sm">
                {period === 'weekly'
                  ? 'Complete a level this week to appear here!'
                  : 'Complete a level to appear here!'}
              </Text>
            </View>
          ) : (
            entries.map((item, index) => {
              const rank = index + 1;
              const isMe = item.uid === user.id;
              const medal = MEDALS[rank] ?? null;
              return (
                <View
                  key={item.uid}
                  className={`bg-card border rounded-2xl p-3 flex-row items-center gap-3 mb-2 ${
                    isMe ? 'border-primary' : 'border-border'
                  }`}
                >
                  <Text className="w-8 text-center text-lg">
                    {medal ?? (
                      <Text className="text-muted-foreground font-semibold text-sm">{rank}</Text>
                    )}
                  </Text>
                  <Text
                    className={`flex-1 font-medium ${isMe ? 'text-primary' : 'text-foreground'}`}
                    numberOfLines={1}
                  >
                    {item.displayName}{isMe ? ' (you)' : ''}
                  </Text>
                  <Text className={`font-bold ${isMe ? 'text-primary' : 'text-foreground'}`}>
                    {item.points.toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
