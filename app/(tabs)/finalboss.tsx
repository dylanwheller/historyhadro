/**
 * Final Boss — HistoryHadro
 *
 * The Eternal Chronicler: questions drawn from ALL 4 worlds combined.
 * Unlocks after every world boss has been defeated.
 *
 * 20 questions · need 15 correct · 5 lives · 1 000 XP
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useGame } from '@/lib/GameContext';
import { useUser } from '@/lib/UserContext';
import { WORLDS } from '@/data/worlds';
import { ALL_QUESTIONS } from '@/data/questions';
import type { Question } from '@/data/worlds';
import { soundManager } from '@/lib/sounds';

const BOSS_QUESTIONS_TOTAL = 20;
const DEFEAT_THRESHOLD    = 15;
const FINAL_BOSS_XP       = 1000;

const BOSS = {
  name:    'The Eternal Chronicler',
  icon:    '📜',
  tagline: 'Knowledge from across the ages',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function OptionButton({
  text, state, onPress, disabled = false,
}: {
  text: string;
  state: 'idle' | 'correct' | 'wrong' | 'reveal';
  onPress: () => void;
  disabled?: boolean;
}) {
  let bg = 'bg-card', border = 'border-border';
  if (state === 'correct') { bg = 'bg-green-500/20'; border = 'border-green-500'; }
  if (state === 'wrong')   { bg = 'bg-red-500/20';   border = 'border-red-500';   }
  if (state === 'reveal')  { bg = 'bg-green-500/10'; border = 'border-green-400'; }
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={state !== 'idle' || disabled}
      activeOpacity={0.75}
      className={`${bg} border ${border} rounded-2xl p-4 mb-3`}
    >
      <Text className="text-foreground text-base">{text}</Text>
    </TouchableOpacity>
  );
}

type Phase = 'playing' | 'answered' | 'complete';

export default function FinalBossScreen() {
  const router = useRouter();
  const { game, answerQuestion, markFinalBossDefeated } = useGame();
  const { addPoints } = useUser();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const [qIndex,     setQIndex]     = useState(0);
  const [correct,    setCorrect]    = useState(0);
  const [points,     setPoints]     = useState(0);
  const [phase,      setPhase]      = useState<Phase>('playing');
  const [chosen,     setChosen]     = useState<number | null>(null);
  const [isPaused,   setIsPaused]   = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  // Draw from ALL worlds' boss questions
  const questions = useMemo<Question[]>(() => {
    const pool = ALL_QUESTIONS.filter((q) => q.boss === true);
    return shuffle(pool).slice(0, BOSS_QUESTIONS_TOTAL).map((q) => {
      const idx = [0, 1, 2, 3];
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      return { ...q, options: idx.map((i) => q.options[i]), correctIndex: idx.indexOf(q.correctIndex) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const phaseRef = useRef(phase); phaseRef.current = phase;

  useFocusEffect(
    useCallback(() => {
      if (phaseRef.current === 'complete') {
        setQIndex(0); setCorrect(0); setPoints(0);
        setPhase('playing'); setChosen(null);
        setRestartKey(k => k + 1);
      }
    }, []),
  );

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => { fadeIn(); }, [qIndex, fadeIn]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const currentQ = questions[qIndex];
  const defeated = correct >= DEFEAT_THRESHOLD;

  const handleAnswer = useCallback((optionIndex: number) => {
    if (phase !== 'playing' || !currentQ) return;
    setChosen(optionIndex);
    setPhase('answered');

    const isCorrect = optionIndex === currentQ.correctIndex;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    const earned = isCorrect ? 15 : -25; // bigger rewards/penalties for final boss

    soundManager.play(isCorrect ? 'correct' : 'incorrect');
    setCorrect(newCorrect);
    setPoints(p => Math.max(0, p + earned));
    if (!isCorrect) shake();
    answerQuestion(isCorrect);

    setTimeout(() => {
      if (qIndex + 1 >= questions.length) {
        soundManager.play(newCorrect >= DEFEAT_THRESHOLD ? 'bossDefeated' : 'defeatedByBoss');
        setPhase('complete');
      } else {
        setQIndex(i => i + 1);
        setPhase('playing');
        setChosen(null);
      }
    }, 1000);
  }, [phase, currentQ, correct, qIndex, questions.length, shake, answerQuestion]);

  const handleFinish = useCallback(async () => {
    if (defeated) {
      addPoints(FINAL_BOSS_XP);
      markFinalBossDefeated();
    }
    router.replace('/(tabs)/worlds' as any);
  }, [defeated, addPoints, markFinalBossDefeated, router]);

  const handleRetry = useCallback(() => {
    setQIndex(0); setCorrect(0); setPoints(0);
    setPhase('playing'); setChosen(null);
    setRestartKey(k => k + 1);
  }, []);

  // ── complete screen ──
  if (phase === 'complete') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-6xl mb-4">{defeated ? '🏆' : '😢'}</Text>
        <Text className="text-2xl font-bold text-foreground mb-2 text-center">
          {defeated ? 'GAME COMPLETE!' : 'Lost to the chronicles…'}
        </Text>
        <Text className="text-muted-foreground mb-2">{correct}/{BOSS_QUESTIONS_TOTAL} correct</Text>
        {defeated && (
          <>
            <Text className="text-yellow-400 font-semibold mb-1">+{FINAL_BOSS_XP} XP 🌟</Text>
            <Text className="text-muted-foreground text-sm mb-6 text-center">
              You are a HistoryHadro Legend!
            </Text>
          </>
        )}
        {!defeated && (
          <Text className="text-muted-foreground mb-6">
            Need {DEFEAT_THRESHOLD} correct to win
          </Text>
        )}
        <TouchableOpacity
          onPress={handleFinish}
          className="bg-primary rounded-2xl px-8 py-3 mb-3 w-full items-center"
        >
          <Text className="text-primary-foreground font-bold text-lg">
            {defeated ? 'Claim Victory' : 'Back to Worlds'}
          </Text>
        </TouchableOpacity>
        {!defeated && (
          <TouchableOpacity onPress={handleRetry} className="py-2">
            <Text className="text-muted-foreground">Try Again</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  if (!currentQ) return null;

  const bossHpPct = Math.round(Math.max(0, (1 - correct / DEFEAT_THRESHOLD) * 100));

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Boss header */}
      <View className="px-4 pt-4 pb-4" style={{ backgroundColor: '#0f0a2022' }}>
        <Text className="text-center text-2xl font-bold text-foreground mb-1">
          🌌 {BOSS.name}
        </Text>
        <Text className="text-center text-xs text-muted-foreground mb-1">{BOSS.tagline}</Text>
        <Text className="text-center text-sm text-muted-foreground mb-3">
          {qIndex + 1} / {BOSS_QUESTIONS_TOTAL}
        </Text>
        <View className="h-3 bg-muted rounded-full overflow-hidden mx-2">
          <View className="h-full rounded-full bg-violet-500" style={{ width: `${bossHpPct}%` }} />
        </View>
        <Text className="text-center text-xs text-muted-foreground mt-1">
          Boss HP — {correct} hits landed · need {DEFEAT_THRESHOLD}
        </Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: shakeAnim }], flex: 1 }}>
        <View className="px-4 pt-6 pb-4">
          <Text className="text-xl font-bold text-foreground leading-snug">{currentQ.text}</Text>
        </View>
        <View className="px-4">
          {currentQ.options.map((opt, i) => {
            let state: 'idle' | 'correct' | 'wrong' | 'reveal' = 'idle';
            if (phase === 'answered') {
              if (i === currentQ.correctIndex) state = chosen === i ? 'correct' : 'reveal';
              else if (i === chosen) state = 'wrong';
            }
            return (
              <OptionButton key={i} text={opt} state={state}
                onPress={() => handleAnswer(i)} disabled={isPaused} />
            );
          })}
        </View>
      </Animated.View>

      {/* Bottom bar */}
      <View
        className="absolute left-0 right-0 bg-card border-t border-border flex-row items-center px-6"
        style={{ bottom: 0, height: 60 + bottomInset, paddingBottom: bottomInset }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/worlds' as any)}
          activeOpacity={0.7}
          className="flex-row items-center gap-2 bg-muted rounded-xl px-4 py-2"
        >
          <Text className="text-foreground text-sm font-semibold">Exit</Text>
        </TouchableOpacity>
        <View className="flex-1" />
        <Text className="text-muted-foreground text-xs">⚡ Final Boss — no hints!</Text>
      </View>
    </SafeAreaView>
  );
}
