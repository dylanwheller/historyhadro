// components/screens/DailyChallengeScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CheckCircle, Clock, Star, Zap } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useAuth } from '@/lib/AuthContext';
import { useUser } from '@/lib/UserContext';
import { updateDailyStat } from '@/lib/firebase';
import { soundManager } from '@/lib/sounds';
import { ALL_QUESTIONS } from '@/data/questions';
import type { Question } from '@/data/worlds';

cssInterop(ArrowLeft,   { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock,       { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Star,        { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Zap,         { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_QUESTIONS    = 10;
const TIME_LIMIT         = 60;
const POINTS_PER_CORRECT = 10;
const BONUS_ALL_CORRECT  = 50;
const WORLD_COUNTS: Record<number, number> = { 1: 3, 2: 3, 3: 2, 4: 2 };

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDailyStorageKey(uid: string, dateKey: string): string {
  return `@historyhadro_daily_${uid}_${dateKey}`;
}

function generateDailyQuestions(ageRange: 'junior' | 'senior'): Question[] {
  const seed = parseInt(getTodayKey().replace(/-/g, ''), 10);
  const rng  = mulberry32(seed);
  const picked: Question[] = [];
  for (const worldId of [1, 2, 3, 4]) {
    const pool     = ALL_QUESTIONS.filter(q => q.worldId === worldId && q.difficulty === ageRange && !q.boss);
    const shuffled = seededShuffle(pool, rng);
    picked.push(...shuffled.slice(0, WORLD_COUNTS[worldId]));
  }
  return seededShuffle(picked, rng);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase        = 'playing' | 'results' | 'already_done';
type FeedbackType = 'correct' | 'incorrect' | null;

// ─── Component ────────────────────────────────────────────────────────────────
export default function DailyChallengeScreen() {
  const router             = useRouter();
  const { user: authUser } = useAuth();
  const { user, addPoints } = useUser();
  const ageRange           = user.ageRange ?? 'junior';

  const [phase,        setPhase]        = useState<Phase>('playing');
  const [questions]                      = useState<Question[]>(() => generateDailyQuestions(ageRange));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback,     setFeedback]     = useState<FeedbackType>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft,     setTimeLeft]     = useState(TIME_LIMIT);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    soundManager.setSessionMuted(false);
    return () => soundManager.setSessionMuted(false);
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundManager.setSessionMuted(next);
  };

  const isProcessing     = useRef(false);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const correctRef       = useRef(0);
  const timeLeftRef      = useRef(TIME_LIMIT);
  const selectedIndexRef = useRef<number | null>(null);

  const timerWidth  = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const shakeX      = useSharedValue(0);

  const timerBarStyle = useAnimatedStyle(() => ({
    width: `${timerWidth.value * 100}%` as any,
    backgroundColor:
      timerWidth.value > 0.4 ? '#7ED321' :
      timerWidth.value > 0.2 ? '#F5A623' : '#D0021B',
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  // ── Check if already completed today ──────────────────────────────────────
  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid) return;
    AsyncStorage.getItem(getDailyStorageKey(uid, getTodayKey())).then(val => {
      if (val !== null) setPhase('already_done');
    });
  }, [authUser?.uid]);

  // ── Finish & persist ──────────────────────────────────────────────────────
  const finishChallenge = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const correct      = correctRef.current;
    const remaining    = timeLeftRef.current;
    const completedAll = correct === TOTAL_QUESTIONS;
    const timeBonus    = Math.floor(remaining * 0.5);
    const total        = correct * POINTS_PER_CORRECT + (completedAll ? BONUS_ALL_CORRECT : 0) + timeBonus;

    setPointsEarned(total);
    addPoints(total);

    const uid     = authUser?.uid;
    const dateKey = getTodayKey();

    if (uid) {
      AsyncStorage.setItem(
        getDailyStorageKey(uid, dateKey),
        JSON.stringify({ correct, pts: total }),
      ).catch(() => {});

      updateDailyStat(uid, dateKey, {
        questionsSolved:         correct,
        pointsEarned:            total,
        dailyChallengeCompleted: true,
        dailyChallengeCorrect:   correct,
        dailyChallengePts:       total,
      }).catch(console.warn);
    }

    soundManager.play('dailyChallengeComplete');
    setPhase('results');
  }, [addPoints, authUser?.uid]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        timeLeftRef.current = next;
        timerWidth.value = withTiming(next / TIME_LIMIT, { duration: 900, easing: Easing.linear });
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          runOnJS(finishChallenge)();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((optionIndex: number) => {
    if (isProcessing.current || feedback !== null) return;
    isProcessing.current  = true;
    selectedIndexRef.current = optionIndex;

    const q         = questions[currentIndex];
    const isCorrect = optionIndex === q.correctIndex;

    setFeedback(isCorrect ? 'correct' : 'incorrect');
    soundManager.play(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      correctRef.current += 1;
      setCorrectCount(c => c + 1);
      buttonScale.value = withSequence(
        withSpring(1.06, { damping: 10 }),
        withSpring(1,    { damping: 10 }),
      );
    } else {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming( 8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming( 8, { duration: 50 }),
        withTiming( 0, { duration: 50 }),
      );
    }

    setTimeout(() => {
      const next = currentIndex + 1;
      if (next >= TOTAL_QUESTIONS) {
        if (timerRef.current) clearInterval(timerRef.current);
        finishChallenge();
      } else {
        setCurrentIndex(next);
        setFeedback(null);
        selectedIndexRef.current = null;
        isProcessing.current = false;
      }
    }, 900);
  }, [currentIndex, feedback, questions, finishChallenge, buttonScale, shakeX]);

  // ── Already done ──────────────────────────────────────────────────────────
  if (phase === 'already_done') {
    return (
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 items-center justify-center px-8 gap-6">
          <Text className="text-6xl">🔭</Text>
          <Text className="text-2xl font-bold text-white text-center">
            Challenge Complete!
          </Text>
          <Text className="text-purple-200 text-center text-base leading-relaxed">
            You've already tackled today's challenge.{'\n'}Come back tomorrow for a new one!
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 bg-primary px-8 py-4 rounded-2xl flex-row items-center gap-2"
          >
            <ArrowLeft size={18} color="#fff" />
            <Text className="text-white font-bold text-base">Back to Home</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const pct   = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
    const stars = correctCount >= 9 ? 3 : correctCount >= 6 ? 2 : correctCount >= 3 ? 1 : 0;
    return (
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 items-center justify-center px-8 gap-5">
          <View className="flex-row gap-3 mb-2">
            {[1, 2, 3].map(i => (
              <Star key={i} size={40} color={i <= stars ? '#F5A623' : '#334155'} fill={i <= stars ? '#F5A623' : 'none'} />
            ))}
          </View>
          <Text className="text-3xl font-black text-white text-center">
            {correctCount >= 8 ? 'Brilliant! 🎉' : correctCount >= 5 ? 'Good effort! 💪' : 'Keep exploring! 🔭'}
          </Text>
          <View className="w-full bg-white/10 rounded-2xl p-5 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-purple-200">Correct answers</Text>
              <Text className="text-white font-bold">{correctCount} / {TOTAL_QUESTIONS}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-purple-200">Accuracy</Text>
              <Text className="text-white font-bold">{pct}%</Text>
            </View>
            {correctCount === TOTAL_QUESTIONS && (
              <View className="flex-row items-center justify-between">
                <Text className="text-purple-200">Perfect score bonus</Text>
                <Text className="text-yellow-400 font-bold">+{BONUS_ALL_CORRECT}</Text>
              </View>
            )}
            <View className="h-px bg-white/20" />
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Zap size={16} color="#fbbf24" />
                <Text className="text-yellow-400 font-bold">Points earned</Text>
              </View>
              <Text className="text-yellow-400 font-black text-xl">+{pointsEarned}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-full bg-primary py-4 rounded-2xl items-center"
          >
            <Text className="text-white font-bold text-lg">Back to Home</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const q          = questions[currentIndex];
  const timerColor = timeLeft > 24 ? '#7ED321' : timeLeft > 12 ? '#F5A623' : '#D0021B';
  const LABELS     = ['A', 'B', 'C', 'D'];

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="px-5 pt-2 pb-3">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1">
              <TouchableOpacity onPress={() => router.back()} className="p-2">
                <ArrowLeft size={22} color="#c4b5fd" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleToggleMute} className="p-2">
                <Text style={{ fontSize: 18 }}>{muted ? '🔇' : '🔊'}</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-white font-bold text-base">Daily Challenge</Text>
            <View className="flex-row items-center gap-1.5">
              <Clock size={16} color={timerColor} />
              <Text className="font-bold text-base" style={{ color: timerColor }}>{timeLeft}s</Text>
            </View>
          </View>
          <View className="h-2 bg-white/20 rounded-full overflow-hidden">
            <Animated.View style={[timerBarStyle, { height: '100%', borderRadius: 999 }]} />
          </View>
        </View>

        {/* Progress dots */}
        <View className="flex-row justify-center gap-1.5 mb-4">
          {questions.map((_, i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width:  i === currentIndex ? 10 : 8,
                height: i === currentIndex ? 10 : 8,
                backgroundColor:
                  i < currentIndex   ? '#7ED321' :
                  i === currentIndex ? '#f0fdf4' :
                  'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </View>

        {/* Question counter */}
        <Text className="text-center text-purple-200 text-sm mb-1">
          {currentIndex + 1} of {TOTAL_QUESTIONS}
        </Text>

        {/* Question card */}
        <View className="px-5 mb-5">
          <View className="bg-white/10 rounded-3xl p-6">
            <Text className="text-white text-xl font-bold text-center leading-snug">
              {q.text}
            </Text>
          </View>
        </View>

        {/* Answer options */}
        <View className="px-5 gap-3">
          {q.options.map((opt, i) => {
            const isCorrectOption = i === q.correctIndex;
            let bg     = 'bg-white/10';
            let border = 'border-white/20';

            if (feedback !== null) {
              if (isCorrectOption) {
                bg = 'bg-[#7ED321]/30'; border = 'border-[#7ED321]';
              } else if (feedback === 'incorrect' && i === selectedIndexRef.current) {
                bg = 'bg-red-500/30'; border = 'border-red-500';
              }
            }

            const animStyle =
              feedback === 'correct'   && isCorrectOption          ? pulseStyle :
              feedback === 'incorrect' && i === selectedIndexRef.current ? shakeStyle : {};

            return (
              <Animated.View key={i} style={animStyle}>
                <TouchableOpacity
                  onPress={() => handleAnswer(i)}
                  disabled={feedback !== null}
                  activeOpacity={0.75}
                  className={`${bg} border ${border} rounded-2xl p-4 flex-row items-center gap-3`}
                >
                  <View className="w-7 h-7 rounded-full bg-white/20 items-center justify-center shrink-0">
                    <Text className="text-white text-xs font-bold">{LABELS[i]}</Text>
                  </View>
                  <Text className="flex-1 text-white text-base font-medium">
                    {opt}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Bottom score strip */}
        <View className="absolute bottom-8 left-5 right-5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <CheckCircle size={16} color="#7ED321" />
            <Text className="text-purple-200 text-sm">{correctCount} correct</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Zap size={16} color="#fbbf24" />
            <Text className="text-purple-200 text-sm">{correctCount * POINTS_PER_CORRECT} pts</Text>
          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}
