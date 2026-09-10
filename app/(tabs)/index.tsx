import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { useTour } from '@/lib/TourContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Zap, Target, Flame, TrendingUp, ChevronRight, Play, Sparkles, Sword, Star } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useAuth } from '@/lib/AuthContext';
import { useUser } from '@/lib/UserContext';
import { getAvatarSource } from '@/lib/avatars';
import { useGame } from '@/lib/GameContext';
import { useSubscription } from '@/lib/SubscriptionContext';
import { getUserDailyStats, updateDailyStat } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WORLDS, RANK_NAMES, RANK_THRESHOLDS } from '@/data/worlds';
import { ACHIEVEMENTS } from '@/data/achievements';
import AchievementService from '@/services/AchievementService';
import PaywallScreen from '@/components/screens/PaywallScreen';

const CopilotView = walkthroughable(View);

cssInterop(Zap,         { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Target,      { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Flame,       { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(TrendingUp,  { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRight,{ className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Play,        { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Sparkles,    { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Sword,       { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Star,        { className: { target: 'style', nativeStyleToProp: { color: true } } });

/** First N levels of World 1 are free for everyone; the rest require premium. */
const FREE_LEVELS = 3;

// ─── Types ───────────────────────────────────────────────────────────────────
type DailyCardState = { done: false } | { done: true; correct: number; pts: number };

// ─── History quotes ────────────────────────────────────────────────────────────
const ASTRO_QUOTES = [
  'The more you know about the past, the better prepared you are for the future.',
  'Those who cannot remember the past are condemned to repeat it.',
  'History is not a burden on the memory but an illumination of the soul.',
  'Somewhere, something incredible is waiting to be known.',
  'The farther backward you can look, the farther forward you are likely to see.',
  'History is the version of past events that people have decided to agree upon.',
  'The world is a book, and those who do not travel read only one page.',
];

// ─── Rank badge ───────────────────────────────────────────────────────────────
function getRank(points: number): { name: string; index: number; nextAt: number | null } {
  let index = 0;
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= RANK_THRESHOLDS[i]) { index = i; break; }
  }
  return {
    name: RANK_NAMES[index],
    index,
    nextAt: index < RANK_THRESHOLDS.length - 1 ? RANK_THRESHOLDS[index + 1] : null,
  };
}

const RANK_COLORS = [
  { bg: 'bg-emerald-100', border: 'border-emerald-700', text: 'text-emerald-900' },
  { bg: 'bg-emerald-100', border: 'border-emerald-700', text: 'text-emerald-900' },
  { bg: 'bg-yellow-400',  border: 'border-yellow-600',  text: 'text-yellow-900'  },
  { bg: 'bg-yellow-400',  border: 'border-yellow-600',  text: 'text-yellow-900'  },
  { bg: 'bg-orange-500',  border: 'border-orange-700',  text: 'text-white'        },
  { bg: 'bg-orange-500',  border: 'border-orange-700',  text: 'text-white'        },
  { bg: 'bg-sky-500',     border: 'border-sky-700',     text: 'text-white'        },
  { bg: 'bg-sky-500',     border: 'border-sky-700',     text: 'text-white'        },
  { bg: 'bg-purple-600',  border: 'border-purple-800',  text: 'text-white'        },
  { bg: 'bg-purple-600',  border: 'border-purple-800',  text: 'text-white'        },
];

const RankBadge = ({ rankIndex }: { rankIndex: number }) => {
  const s = RANK_COLORS[rankIndex] ?? RANK_COLORS[0];
  return (
    <View className={`px-3 py-1 rounded-full border-2 ${s.bg} ${s.border}`}>
      <Text className={`text-xs font-bold ${s.text}`}>{RANK_NAMES[rankIndex]}</Text>
    </View>
  );
};

// ─── Animated XP counter ─────────────────────────────────────────────────────
const AnimatedCounter = ({ value }: { value: number }) => {
  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withSpring(value, { damping: 15, stiffness: 100 });
  }, [value]);
  return (
    <Animated.Text entering={FadeIn} className="text-2xl font-bold text-foreground">
      {value.toLocaleString()}
    </Animated.Text>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { user, isLoggedIn } = useUser();
  const avatarSource = getAvatarSource(user.avatarId);
  const { game } = useGame();
  const { hasAccess } = useSubscription();
  const worldProgress = game.worldProgress;
  const points = user.points ?? 0;
  // Daily stats come from GameContext — seeded from Firestore on login and
  // incremented locally on every completion/exit so there is no race condition.
  const solvedToday = game.todaySolved;
  const pointsToday = game.todayPoints;

  const { startTour } = useTour();
  const hasTriggeredTourRef = useRef(false);

  const [paywallOpen, setPaywallOpen]   = useState(false);
  const [greeting, setGreeting]         = useState('');
  const [quoteIndex, setQuoteIndex]     = useState(0);
  const [loginStreak, setLoginStreak]   = useState(0);

  const [dailyCard, setDailyCard] = useState<DailyCardState>({ done: false });

  const uidRef = useRef(user.id);
  uidRef.current = user.id;

  const pulseValue = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }],
  }));

  const rank = useMemo(() => getRank(points), [points]);

  // ── Continue Learning target ──
  const continueTarget = useMemo(() => {
    for (const world of WORLDS) {
      const wp = worldProgress[world.id];
      const levels = wp?.levels ?? {};
      // Use stars as ground truth — levelsCompleted can lag behind in-memory
      // state if a level was completed moments ago.
      const starredCount = Object.keys(levels).filter(
        (k) => (levels[k]?.stars ?? 0) > 0,
      ).length;
      if (starredCount < world.levels) {
        let nextLevel = 1;
        for (let l = 1; l <= world.levels; l++) {
          if ((levels[String(l)]?.stars ?? 0) > 0) nextLevel = l + 1;
          else break;
        }
        const levelId = Math.min(nextLevel, world.levels);
        const requiresUpgrade = !hasAccess && (world.id > 1 || levelId > FREE_LEVELS);
        const levelsCompleted = wp?.levelsCompleted ?? 0;
        return {
          world,
          levelId,
          levelsCompleted,
          progressPercent: Math.round((starredCount / world.levels) * 100),
          levelsRemaining: world.levels - starredCount,
          requiresUpgrade,
        };
      }
    }
    return null;
  }, [worldProgress, hasAccess]);

  // ── Boss battle nudge — first world with all levels done but boss not beaten ──
  const bossBattleWorld = useMemo(() => {
    for (const world of WORLDS) {
      if (world.id > 1 && !hasAccess) continue;
      const wp = worldProgress[world.id];
      const levels = wp?.levels ?? {};
      const starredCount = Object.keys(levels).filter(
        (k) => (levels[k]?.stars ?? 0) > 0,
      ).length;
      if (starredCount >= world.levels && !(wp?.bossDefeated)) {
        return world;
      }
    }
    return null;
  }, [worldProgress, hasAccess]);

  // ── Recent achievements (refreshed on every screen focus) ──
  const [recentAchievements, setRecentAchievements] = useState(() => {
    const unlockedIds = AchievementService.getUnlockedIds() as string[];
    return ACHIEVEMENTS.filter((a) => unlockedIds.includes(a.id)).slice(-3).reverse();
  });

  // ── Load login streak only (daily solved/points come from GameContext) ──
  const loadDailyStats = useCallback((uid: string) => {
    const today = new Date().toISOString().slice(0, 10);
    // Mark today as a login day so streak counts active login days
    updateDailyStat(uid, today, { loggedIn: true }).catch(() => {});

    getUserDailyStats(uid)
      .then((stats) => {
        // Guard: discard result if the user changed while this request was in flight
        if (uidRef.current !== uid) return;
        const activeDates = new Set(
          stats.filter((s) => (s.questionsSolved ?? 0) > 0 || s.loggedIn).map((s) => s.dateKey),
        );
        let streak = 0;
        const now = new Date();
        for (let i = 0; i < 90; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          if (activeDates.has(d.toISOString().slice(0, 10))) streak++;
          else break;
        }
        setLoginStreak(streak);
      })
      .catch(console.warn);
  }, []); // uidRef is a stable ref object — reading .current inside is safe without listing it as a dep

  // ── Check daily challenge completion (also called on auth resolve) ──────────
  const loadDailyChallenge = useCallback((uid: string) => {
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(`@historyhadro_daily_${uid}_${today}`)
      .then(val => {
        // Guard: discard result if the user changed while this request was in flight
        if (uidRef.current !== uid) return;
        if (val !== null) {
          try {
            const parsed = JSON.parse(val) as { correct: number; pts: number };
            const correct = typeof parsed.correct === 'number' ? parsed.correct : 0;
            const pts     = typeof parsed.pts     === 'number' ? parsed.pts     : 0;
            setDailyCard({ done: true, correct, pts });
          } catch {
            setDailyCard({ done: true, correct: 0, pts: 0 });
          }
        } else {
          setDailyCard({ done: false });
        }
      })
      .catch(console.warn);
  }, []); // uidRef is a stable ref object — reading .current inside is safe without listing it as a dep

  // Fires on every user.id change (including logout → '').
  // Reset local state immediately so the UI never shows stale data from
  // the previous account, even briefly.
  useEffect(() => {
    setLoginStreak(0);
    setDailyCard({ done: false });
    if (user.id) {
      loadDailyStats(user.id);
      loadDailyChallenge(user.id);
    }
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetches when returning from a game session
  useFocusEffect(
    useCallback(() => {
      const uid = uidRef.current;
      if (uid) loadDailyStats(uid);
      // Refresh achievements in case one was just earned
      const unlockedIds = AchievementService.getUnlockedIds() as string[];
      setRecentAchievements(
        ACHIEVEMENTS.filter((a) => unlockedIds.includes(a.id)).slice(-3).reverse(),
      );
      // Check daily challenge completion
      if (uid) loadDailyChallenge(uid);
    }, [loadDailyStats, loadDailyChallenge]),
  );

  // Tour trigger — fires once on first focus after login when walkthrough not yet done.
  // No delay needed: useFocusEffect runs after all child useEffects, so CopilotStep
  // components on this screen have already called registerStep by the time this fires.
  // The splash-style modal in TourProvider covers the pre-warm immediately.
  useFocusEffect(useCallback(() => {
    if (!user.walkthroughComplete && isLoggedIn && !hasTriggeredTourRef.current) {
      hasTriggeredTourRef.current = true;
      startTour();
    }
  }, [user.walkthroughComplete, isLoggedIn, startTour]));

  // ── Greeting + quote rotation + pulse ──
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

    pulseValue.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1, true,
    );

    const quoteTimer = setInterval(() => setQuoteIndex((i) => (i + 1) % ASTRO_QUOTES.length), 8000);
    return () => { clearInterval(quoteTimer); cancelAnimation(pulseValue); };
  }, []);

  const progressToNext = rank.nextAt
    ? Math.min(100, Math.round((points / rank.nextAt) * 100))
    : 100;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* ── Header ── */}
        <View className="px-6 pt-4 pb-6">
          <View className="mb-4">
            <Text className="text-primary text-sm">
              {greeting}, {user.name}!
            </Text>
            <Text className="text-2xl font-bold text-foreground">
              Ready to explore history?
            </Text>
          </View>

          {/* Avatar + stats row */}
          <CopilotStep
            name="home-stats"
            order={1}
            text="Your home base — track your XP, rank, and daily progress here."
          >
            <CopilotView collapsable={false}>
            <View className="flex-row items-center gap-4">
            <Image
              source={avatarSource}
              className="h-36 w-36 rounded-3xl opacity-95"
              resizeMode="cover"
            />
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-2 flex-wrap">
                <RankBadge rankIndex={rank.index} />
                <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                  <Text className="text-primary text-xs font-bold">Level {user.level}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2 mb-3">
                <Zap size={18} color="#f59e0b" />
                <AnimatedCounter value={points} />
                <Text className="text-sm text-primary">XP</Text>
              </View>
              {/* Rank progress bar */}
              <View>
                <View className="h-2 bg-muted rounded-full overflow-hidden">
                  <View className="h-full rounded-full bg-primary" style={{ width: `${progressToNext}%` }} />
                </View>
                {rank.nextAt && (
                  <Text className="text-xs text-muted-foreground mt-1">
                    {rank.nextAt - points} pts to {RANK_NAMES[rank.index + 1]}
                  </Text>
                )}
              </View>
            </View>
            </View>
            </CopilotView>
          </CopilotStep>
        </View>

        {/* ── Continue Learning ── */}
        {continueTarget && !bossBattleWorld ? (
          <View className="px-6 mb-6">
            <Animated.View entering={FadeInDown.duration(600).delay(100)}>
              <CopilotStep
                name="home-continue"
                order={2}
                text="Tap here to jump straight into your next history lesson."
              >
                <CopilotView>
                  <TouchableOpacity
                    onPress={() => {
                      if (continueTarget.requiresUpgrade) { setPaywallOpen(true); return; }
                      router.push(`/level/${continueTarget.world.id}/${continueTarget.levelId}` as any);
                    }}
                    activeOpacity={0.9}
                    className="bg-primary rounded-2xl p-5 shadow-lg"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-2">
                        <View className="bg-black/10 p-2 rounded-lg">
                          <Play size={20} color="#1c1917" />
                        </View>
                        <Text className="text-primary-foreground text-lg font-bold">
                          {continueTarget.requiresUpgrade
                            ? 'Unlock to Continue'
                            : points > 0 ? 'Continue Playing' : 'Start Playing'}
                        </Text>
                      </View>
                      <ChevronRight size={24} color="#1c1917" />
                    </View>

                    <View className="bg-black/10 rounded-xl p-3 mb-3">
                      <Text className="text-primary-foreground text-sm font-semibold mb-1">
                        {continueTarget.world.icon} {continueTarget.world.name} · Level {continueTarget.levelId}
                      </Text>
                      <View className="h-2 bg-black/20 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-primary-foreground rounded-full"
                          style={{ width: `${continueTarget.progressPercent}%` }}
                        />
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-primary-foreground/70 text-xs">
                        {continueTarget.levelsRemaining > 0
                          ? `${continueTarget.levelsCompleted}/${continueTarget.world.levels} levels complete · ${continueTarget.levelsRemaining} remaining`
                          : 'World complete!'}
                      </Text>
                      <View className="bg-black/15 px-3 py-1 rounded-full">
                        <Text className="text-primary-foreground text-xs font-bold">
                          {continueTarget.requiresUpgrade ? '⭐ UPGRADE' : points > 0 ? 'CONTINUE' : 'START'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </CopilotView>
              </CopilotStep>
            </Animated.View>
          </View>
        ) : (
          <CopilotStep name="home-continue" order={2} text="Tap here to jump straight into your next history lesson.">
            <CopilotView><View style={{ height: 4 }} /></CopilotView>
          </CopilotStep>
        )}

        {/* ── Boss Battle nudge ── */}
        {bossBattleWorld && (
          <View className="px-6 mb-6">
            <Animated.View style={pulseStyle} entering={FadeInDown.duration(600).delay(200)}>
              <TouchableOpacity
                onPress={() => router.push(`/boss/${bossBattleWorld.id}` as any)}
                activeOpacity={0.9}
                className="bg-muted rounded-2xl p-5 shadow-lg border border-primary/50"
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <View className="bg-white/20 p-2 rounded-lg">
                    <Sword size={20} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-lg font-bold">Boss Battle Ready!</Text>
                    <Text className="text-white/80 text-sm">{bossBattleWorld.bossName} awaits</Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between mt-2">
                  <View className="flex-row items-center gap-2">
                    <Flame size={16} color="#fff" />
                    <Text className="text-white text-sm">+200 XP Bonus</Text>
                  </View>
                  <View className="bg-white/20 px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-bold">FIGHT NOW</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* ── Daily History Challenge ── */}
        <View className="px-6 mb-6">
          <Animated.View entering={FadeInDown.duration(600).delay(300)}>
            <View className="bg-card rounded-2xl overflow-hidden border border-border">
              {/* Card header */}
              <View className="bg-primary/10 px-4 py-3 flex-row items-center gap-2">
                <Sparkles size={20} color="#a855f7" />
                <Text className="text-primary font-bold">Daily History Challenge</Text>
                <View
                  className={`ml-auto px-2 py-0.5 rounded-full flex-row items-center gap-1 ${
                    !hasAccess && !dailyCard.done ? 'bg-primary' : 'bg-primary/20'
                  }`}
                >
                  {!hasAccess && !dailyCard.done && <Star size={10} color="#fff" fill="#fff" />}
                  <Text className={`text-xs font-bold ${!hasAccess && !dailyCard.done ? 'text-white' : 'text-primary'}`}>
                    {dailyCard.done ? '✓ DONE' : !hasAccess ? 'PREMIUM' : 'TODAY'}
                  </Text>
                </View>
              </View>

              {dailyCard.done ? (
                /* Completed state */
                <View className="p-4">
                  <Text className="text-foreground font-semibold mb-1">
                    🎉 Challenge complete!
                  </Text>
                  <Text className="text-muted-foreground text-sm mb-3">
                    {dailyCard.correct} / 10 correct · +{dailyCard.pts} XP earned
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    Come back tomorrow for a new challenge 🔭
                  </Text>
                </View>
              ) : (
                /* Play state */
                <TouchableOpacity
                  onPress={() => {
                    if (!hasAccess) { setPaywallOpen(true); return; }
                    router.push('/daily-challenge' as any);
                  }}
                  activeOpacity={0.85}
                >
                  <View className="p-4">
                    <Text className="text-foreground font-semibold mb-1">
                      10 history questions · 60 seconds
                    </Text>
                    <Text className="text-muted-foreground text-sm mb-3">
                      Ancient Civilisations · Middle Ages · Exploration · Modern World
                    </Text>
                    <View className="bg-primary rounded-xl py-2.5 items-center">
                      <Text className="text-primary-foreground font-bold">
                        {hasAccess ? 'Play Now →' : 'Unlock to Play →'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>

        {/* ── Quick Stats ── */}
        <View className="px-6 mb-6">
          <Animated.View entering={FadeInUp.duration(600).delay(400)}>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-card rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <Target size={18} color="#a855f7" />
                  <Text className="text-muted-foreground text-xs">Solved Today</Text>
                </View>
                <Text className="text-2xl font-bold text-foreground">{solvedToday}</Text>
              </View>
              <View className="flex-1 bg-card rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <Flame size={18} color="#f97316" />
                  <Text className="text-muted-foreground text-xs">Streak</Text>
                </View>
                <Text className="text-2xl font-bold text-foreground">{loginStreak} days</Text>
              </View>
              <View className="flex-1 bg-card rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <TrendingUp size={18} color="#10b981" />
                  <Text className="text-muted-foreground text-xs">Pts Today</Text>
                </View>
                <Text className="text-2xl font-bold text-foreground">{pointsToday}</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ── Recent Achievements ── */}
        <View className="mb-6">
          <View className="px-6 flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-foreground">Recent Achievements</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/achievements' as any)}>
              <Text className="text-primary text-sm font-bold">View All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          >
            {recentAchievements.length === 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/achievements' as any)}
                className="bg-card rounded-xl p-4 border border-border min-w-[200px] items-center"
              >
                <Text className="text-3xl mb-2">🏆</Text>
                <Text className="text-muted-foreground text-sm text-center">
                  No achievements yet.{'\n'}Start exploring to earn some!
                </Text>
              </TouchableOpacity>
            ) : (
              recentAchievements.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => router.push('/(tabs)/achievements' as any)}
                  className="bg-card rounded-xl p-4 border border-border min-w-[140px]"
                >
                  <Text className="text-3xl mb-2">{a.icon}</Text>
                  <Text className="text-foreground text-sm font-bold mb-1">{a.title}</Text>
                  <Text className="text-muted-foreground text-xs capitalize">{a.category}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* ── Motivation Quote ── */}
        <View className="px-6 mb-6">
          <Animated.View entering={FadeIn.duration(1000).delay(700)}>
            <View className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
              <View className="flex-row items-start gap-3">
                <Sparkles size={20} color="#a855f7" />
                <View className="flex-1">
                  <Text className="text-foreground italic text-base leading-relaxed">
                    &quot;{ASTRO_QUOTES[quoteIndex]}&quot;
                  </Text>
                  <Text className="text-primary text-xs mt-2">— HistoryHadro Wisdom</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

      </ScrollView>

      {paywallOpen && (
        <PaywallScreen modal onClose={() => setPaywallOpen(false)} />
      )}
    </SafeAreaView>
  );
}
