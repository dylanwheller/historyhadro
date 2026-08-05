import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/lib/GameContext';
import { WORLDS } from '@/data/worlds';
import { ALL_QUESTIONS } from '@/data/questions';
import type { Question } from '@/data/worlds';
import PauseMenu from '@/components/PauseMenu';
import { soundManager } from '@/lib/sounds';

const EXPLAIN_PREF_KEY = '@historyhadro_explain_pref';

type BossConfig = {
  bgColors: [string, string];
  accentColor: string;
  taunts: string[];
  timeoutTaunt: string;
  victoryMessage: string;
  defeatMessage: string;
};

const BOSS_CONFIG: Record<number, BossConfig> = {
  1: {
    bgColors:       ['#431407', '#1c0a03'],
    accentColor:    '#f97316',
    taunts:         [
      "Your ancient history is crumbling! 🏛️",
      "You couldn't even name a pharaoh!",
      "My pyramids tower over your knowledge!",
      "Pathetic! You're no historian!",
    ],
    timeoutTaunt:   "Buried by the sands of time!",
    victoryMessage: "The Pharaoh Titan falls!",
    defeatMessage:  "The Pharaoh Titan conquered you!",
  },
  2: {
    bgColors:       ['#2e1065', '#130a2e'],
    accentColor:    '#a855f7',
    taunts:         [
      "You can't withstand my siege! 🏰",
      "My castles are stronger than your answers!",
      "The Black Plague has more wisdom than you!",
      "You'd be lost in the dark ages!",
    ],
    timeoutTaunt:   "Cut down by my broadsword!",
    victoryMessage: "The Iron Warlord is defeated!",
    defeatMessage:  "The Iron Warlord crushed you!",
  },
  3: {
    bgColors:       ['#082f49', '#031220'],
    accentColor:    '#06b6d4',
    taunts:         [
      "Your knowledge is lost at sea! ⚓",
      "Adrift like a rudderless ship!",
      "Columbus knew more than you!",
      "You're lost without a map!",
    ],
    timeoutTaunt:   "Shipwrecked! No time left!",
    victoryMessage: "The Sea Conqueror is sunk!",
    defeatMessage:  "The Sea Conqueror swallowed you whole!",
  },
  4: {
    bgColors:       ['#3f2d00', '#1f1600'],
    accentColor:    '#eab308',
    taunts:         [
      "You'd miss even a World War! 💣",
      "Your history knowledge is in the dark!",
      "Even a textbook knows more than you!",
      "The history books have more answers than you!",
    ],
    timeoutTaunt:   "Lost to history — no time left!",
    victoryMessage: "The Industrial Giant is toppled!",
    defeatMessage:  "The Industrial Giant crushed you!",
  },
};

const DEFAULT_CONFIG: BossConfig = BOSS_CONFIG[1];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function OptionButton({
  text,
  state,
  onPress,
  disabled = false,
}: {
  text: string;
  state: 'idle' | 'correct' | 'wrong' | 'reveal';
  onPress: () => void;
  disabled?: boolean;
}) {
  let bg = 'bg-card';
  let border = 'border-border';
  if (state === 'correct') { bg = 'bg-green-500/20'; border = 'border-green-500'; }
  if (state === 'wrong')   { bg = 'bg-red-500/20';   border = 'border-red-500'; }
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

const BOSS_QUESTIONS_TOTAL = 15;
const DEFEAT_THRESHOLD     = 10;
const MAX_LIVES            = 5;
const TIMER_SECONDS        = 25;

function effectiveThreshold(questionCount: number): number {
  return Math.min(DEFEAT_THRESHOLD, questionCount);
}

type Phase = 'playing' | 'answered' | 'complete';

export default function BossScreen() {
  const { worldId: wParam } = useLocalSearchParams<{ worldId: string }>();
  const worldId = parseInt(wParam ?? '1', 10);
  const router  = useRouter();
  const { startBoss, answerQuestion, completeBoss } = useGame();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const world  = useMemo(() => WORLDS.find((w) => w.id === worldId)!, [worldId]);
  const config = useMemo(() => BOSS_CONFIG[worldId] ?? DEFAULT_CONFIG, [worldId]);

  const [qIndex,      setQIndex]      = useState(0);
  const [correct,     setCorrect]     = useState(0);
  const [lives,       setLives]       = useState(MAX_LIVES);
  const [points,      setPoints]      = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(TIMER_SECONDS);
  const [phase,       setPhase]       = useState<Phase>('playing');
  const [chosen,      setChosen]      = useState<number | null>(null);
  const [bossMsg,     setBossMsg]     = useState('');
  const [isPaused,    setIsPaused]    = useState(false);
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
  const [restartKey,  setRestartKey]  = useState(0);
  const [awaitingNext,     setAwaitingNext]     = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(EXPLAIN_PREF_KEY)
      .then((val) => { if (val === 'true') setShowExplanations(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (awaitingNext) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [awaitingNext]);

  const questions = useMemo<Question[]>(() => {
    const pool = ALL_QUESTIONS.filter((q) => q.worldId === worldId && q.boss === true);
    return shuffle(pool).slice(0, BOSS_QUESTIONS_TOTAL).map((q) => {
      const idx = [0, 1, 2, 3];
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      return { ...q, options: idx.map((i) => q.options[i]), correctIndex: idx.indexOf(q.correctIndex) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, restartKey]);

  // Animations
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const fadeAnim       = useRef(new Animated.Value(1)).current;
  const bobAnim        = useRef(new Animated.Value(0)).current;
  const chargeAnim     = useRef(new Animated.Value(0)).current;
  const flashGreenAnim = useRef(new Animated.Value(0)).current;
  const flashRedAnim   = useRef(new Animated.Value(0)).current;
  const msgOpacity     = useRef(new Animated.Value(0)).current;

  // Idle boss bob — starts on mount, cleans up on unmount
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -10, duration: 1200, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0,   duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startBoss(worldId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  const phaseRef    = useRef(phase);    phaseRef.current    = phase;
  const isPausedRef = useRef(isPaused); isPausedRef.current = isPaused;

  useFocusEffect(
    useCallback(() => {
      if (isPausedRef.current || phaseRef.current === 'complete') {
        setIsPaused(false);
        setQIndex(0);
        setCorrect(0);
        setLives(MAX_LIVES);
        setPoints(0);
        setTimeLeft(TIMER_SECONDS);
        setPhase('playing');
        setChosen(null);
        setAwaitingNext(false);
        setRestartKey((k) => k + 1);
      }
    }, []),
  );

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => { fadeIn(); }, [qIndex, fadeIn]);

  // Reset timer on each new question
  useEffect(() => {
    setTimeLeft(TIMER_SECONDS);
  }, [qIndex, restartKey]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const bossHit = useCallback(() => {
    Animated.sequence([
      Animated.timing(chargeAnim, { toValue: -14, duration: 70, useNativeDriver: true }),
      Animated.timing(chargeAnim, { toValue: 14,  duration: 70, useNativeDriver: true }),
      Animated.timing(chargeAnim, { toValue: -7,  duration: 70, useNativeDriver: true }),
      Animated.timing(chargeAnim, { toValue: 0,   duration: 70, useNativeDriver: true }),
    ]).start();
  }, [chargeAnim]);

  const bossCharge = useCallback(() => {
    Animated.sequence([
      Animated.timing(chargeAnim, { toValue: 28,  duration: 150, useNativeDriver: true }),
      Animated.timing(chargeAnim, { toValue: -8,  duration: 100, useNativeDriver: true }),
      Animated.timing(chargeAnim, { toValue: 0,   duration: 100, useNativeDriver: true }),
    ]).start();
  }, [chargeAnim]);

  const triggerGreenFlash = useCallback(() => {
    flashGreenAnim.setValue(0.4);
    Animated.timing(flashGreenAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  }, [flashGreenAnim]);

  const triggerRedFlash = useCallback(() => {
    flashRedAnim.setValue(0.4);
    Animated.timing(flashRedAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  }, [flashRedAnim]);

  const showBossMsg = useCallback((msg: string) => {
    setBossMsg(msg);
    msgOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(msgOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [msgOpacity]);

  const currentQ = questions[qIndex];

  const handleAnswerRef = useRef<(idx: number) => void>(() => {});

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (phase !== 'playing' || !currentQ) return;

      const isTimeout = optionIndex === -1;
      const isCorrect = !isTimeout && optionIndex === currentQ.correctIndex;

      setChosen(isTimeout ? null : optionIndex);
      setPhase('answered');

      const newCorrect = correct + (isCorrect ? 1 : 0);
      const newLives   = isCorrect ? lives : lives - 1;

      setCorrect(newCorrect);
      setLives(newLives);
      setPoints((p) => Math.max(0, p + (isCorrect ? 10 : -20)));
      answerQuestion(isCorrect);
      soundManager.play(isCorrect ? 'correct' : 'incorrect');

      if (isCorrect) {
        triggerGreenFlash();
        showBossMsg('⚡ Critical Hit!');
        bossHit();
      } else {
        triggerRedFlash();
        const taunts = config.taunts;
        showBossMsg(isTimeout
          ? config.timeoutTaunt
          : taunts[Math.floor(Math.random() * taunts.length)]);
        bossCharge();
        shake();
      }

      // End early if lives depleted or boss defeated — always auto-advance
      if ((!isCorrect && newLives <= 0) || newCorrect >= effectiveThreshold(questions.length)) {
        setTimeout(() => setPhase('complete'), 1600);
        return;
      }

      // If explain mode is on and this question has an explanation, wait for Next
      if (showExplanations && currentQ.explanation) {
        setAwaitingNext(true);
        return;
      }

      setTimeout(() => {
        if (qIndex + 1 >= questions.length) {
          setPhase('complete');
        } else {
          setQIndex((i) => i + 1);
          setPhase('playing');
          setChosen(null);
        }
      }, 1500);
    },
    [
      phase, currentQ, correct, lives, qIndex, questions.length,
      config, shake, bossHit, bossCharge, triggerGreenFlash, triggerRedFlash, showBossMsg, answerQuestion,
      showExplanations,
    ],
  );

  handleAnswerRef.current = handleAnswer;

  const handleNext = useCallback(() => {
    setAwaitingNext(false);
    if (qIndex + 1 >= questions.length) {
      setPhase('complete');
    } else {
      setQIndex((i) => i + 1);
      setPhase('playing');
      setChosen(null);
    }
  }, [qIndex, questions.length]);

  // Per-question countdown timer
  useEffect(() => {
    if (phase !== 'playing' || isPaused) return;
    if (timeLeft <= 0) {
      handleAnswerRef.current(-1);
      return;
    }
    const t = setTimeout(() => setTimeLeft((tl) => tl - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, isPaused]);

  const playerWon = correct >= effectiveThreshold(questions.length);

  const handleFinish = useCallback(async () => {
    if (playerWon) {
      soundManager.play('bossDefeated');
      await completeBoss();
    } else {
      soundManager.play('defeatedByBoss');
    }
    router.replace('/(tabs)/worlds' as any);
  }, [playerWon, completeBoss, router]);

  const handlePause  = useCallback(() => setIsPaused(true),  []);
  const handleResume = useCallback(() => setIsPaused(false), []);

  const handleRestart = useCallback(() => {
    setIsPaused(false);
    setQIndex(0);
    setCorrect(0);
    setLives(MAX_LIVES);
    setPoints(0);
    setTimeLeft(TIMER_SECONDS);
    setPhase('playing');
    setChosen(null);
    setAwaitingNext(false);
    setRestartKey((k) => k + 1);
  }, []);

  const handleToggleExplain = useCallback(() => {
    setShowExplanations((prev) => {
      const next = !prev;
      AsyncStorage.setItem(EXPLAIN_PREF_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleExit = useCallback(() => {
    router.replace('/(tabs)/worlds' as any);
  }, [router]);

  // ── Complete screen ──
  if (phase === 'complete') {
    return (
      <LinearGradient colors={config.bgColors} style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 items-center justify-center px-6">
          <Text style={{ fontSize: 80, marginBottom: 8 }}>{world.icon}</Text>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>{playerWon ? '🏆' : '💀'}</Text>
          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
            {playerWon ? config.victoryMessage : config.defeatMessage}
          </Text>
          <Text style={{ color: '#ffffff99', marginBottom: 4 }}>
            {correct}/{BOSS_QUESTIONS_TOTAL} correct
          </Text>
          <Text style={{ color: '#ffffff99', marginBottom: 16 }}>
            {lives} {lives === 1 ? 'life' : 'lives'} remaining
          </Text>
          {playerWon && (
            <Text style={{ color: '#fbbf24', fontWeight: '600', fontSize: 17, marginBottom: 24 }}>
              +200 boss bonus! ⭐
            </Text>
          )}
          {!playerWon && (
            <Text style={{ color: '#ffffff60', marginBottom: 24, textAlign: 'center' }}>
              {lives === 0 ? 'You ran out of lives!' : `Need ${effectiveThreshold(questions.length)} correct to win`}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleFinish}
            style={{ backgroundColor: config.accentColor, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 12, width: '100%', alignItems: 'center', marginBottom: 12 }}
          >
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 17 }}>
              {playerWon ? 'Claim Reward' : 'Back to World'}
            </Text>
          </TouchableOpacity>
          {!playerWon && (
            <TouchableOpacity
              onPress={() => router.replace(`/(tabs)/boss/${worldId}` as any)}
              style={{ paddingVertical: 8 }}
            >
              <Text style={{ color: '#ffffff60' }}>Try Again</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!currentQ) return null;

  const bossHpPct  = Math.round(Math.max(0, (1 - correct / effectiveThreshold(questions.length)) * 100));
  const timerPct   = (timeLeft / TIMER_SECONDS) * 100;
  const timerColor = timeLeft > 15 ? '#22c55e' : timeLeft > 8 ? '#f59e0b' : '#ef4444';

  return (
    <LinearGradient colors={config.bgColors} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 128 }}>

          {/* ── Boss section ── */}
          <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 }}>

            {/* Boss emoji — idle bob + charge lunge */}
            <Animated.View style={{ transform: [{ translateY: Animated.add(bobAnim, chargeAnim) }] }}>
              <Text style={{ fontSize: 80 }}>{world.icon}</Text>
            </Animated.View>

            {/* Taunt / hit message */}
            <Animated.View style={{ opacity: msgOpacity, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 }}>
              <Text style={{ color: config.accentColor, textAlign: 'center', fontWeight: '700', fontSize: 14 }}>
                {bossMsg}
              </Text>
            </Animated.View>

            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginTop: 4 }}>
              ⚔️ {world.bossName}
            </Text>
            <Text style={{ color: '#ffffff70', fontSize: 12, marginTop: 2 }}>
              Question {qIndex + 1} / {BOSS_QUESTIONS_TOTAL}
            </Text>

            {/* Timer bar */}
            <View style={{ width: '100%', height: 6, backgroundColor: '#ffffff20', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
              <View style={{ width: `${timerPct}%` as any, height: '100%', backgroundColor: timerColor, borderRadius: 3 }} />
            </View>
            <Text style={{ color: timerColor, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              {timeLeft}s
            </Text>

            {/* Boss HP bar */}
            <View style={{ width: '100%', height: 10, backgroundColor: '#ffffff20', borderRadius: 5, marginTop: 10, overflow: 'hidden' }}>
              <View style={{ width: `${bossHpPct}%` as any, height: '100%', backgroundColor: '#ef4444', borderRadius: 5 }} />
            </View>
            <Text style={{ color: '#ffffff60', fontSize: 11, marginTop: 3 }}>
              Boss HP — {correct} hits landed
            </Text>

            {/* Player lives */}
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <Text key={i} style={{ fontSize: 22 }}>{i < lives ? '❤️' : '🖤'}</Text>
              ))}
            </View>
          </View>

          {/* ── Question + Options ── */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: shakeAnim }] }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', lineHeight: 28 }}>
                {currentQ.text}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {(currentQ.options as string[]).map((opt, i) => {
                let state: 'idle' | 'correct' | 'wrong' | 'reveal' = 'idle';
                if (phase === 'answered') {
                  if (i === currentQ.correctIndex) state = chosen === i ? 'correct' : 'reveal';
                  else if (i === chosen) state = 'wrong';
                }
                return (
                  <OptionButton
                    key={i}
                    text={opt}
                    state={state}
                    onPress={() => handleAnswer(i)}
                    disabled={isPaused}
                  />
                );
              })}
            </View>
          </Animated.View>

          {phase === 'answered' && showExplanations && currentQ.explanation && (
            <View className="mx-4 mt-2 bg-card border border-border rounded-2xl p-4">
              <Text className="text-sm text-muted-foreground">💡 {currentQ.explanation}</Text>
              {awaitingNext && (
                <TouchableOpacity
                  onPress={handleNext}
                  className="mt-3 bg-primary rounded-2xl py-2 items-center"
                >
                  <Text className="text-primary-foreground font-semibold text-sm">Next →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Bottom action bar ── */}
        <View
          className="absolute left-0 right-0 bg-card border-t border-border flex-row items-center px-6"
          style={{ bottom: 0, height: 60 + bottomInset, paddingBottom: bottomInset }}
        >
          <TouchableOpacity
            onPress={handlePause}
            activeOpacity={0.7}
            className="flex-row items-center gap-2 bg-muted rounded-xl px-4 py-2"
          >
            <Text className="text-base">⏸</Text>
            <Text className="text-foreground text-sm font-semibold">Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggleMute}
            activeOpacity={0.7}
            className="flex-row items-center bg-muted rounded-xl px-3 py-2 ml-2"
          >
            <Text className="text-base">{muted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
          <View className="flex-1" />
          <TouchableOpacity
            onPress={handleToggleExplain}
            activeOpacity={0.7}
            className="flex-row items-center gap-2 rounded-xl px-3 py-2"
            style={{
              backgroundColor: showExplanations ? '#3b82f620' : 'transparent',
              borderWidth: 1,
              borderColor: showExplanations ? '#3b82f6' : '#ffffff20',
            }}
          >
            <Text className="text-base">📖</Text>
            <Text className="text-foreground text-sm font-semibold">Explain</Text>
          </TouchableOpacity>
        </View>

        {/* Screen flash overlays */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#22c55e', opacity: flashGreenAnim }}
        />
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ef4444', opacity: flashRedAnim }}
        />

        <PauseMenu
          visible={isPaused}
          onResume={handleResume}
          onRestart={handleRestart}
          onExit={handleExit}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}
