import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/lib/GameContext';
import { useUser } from '@/lib/UserContext';
import { useSubscription } from '@/lib/SubscriptionContext';
import { WORLDS } from '@/data/worlds';
import { ALL_QUESTIONS } from '@/data/questions';
import type { Question } from '@/data/worlds';
import PauseMenu from '@/components/PauseMenu';
import { soundManager } from '@/lib/sounds';

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────
// Deterministic shuffle keyed to world+level+restartKey: the question order
// stays fixed within a single attempt (required for mid-level pause/resume,
// since restartKey never changes while paused), but changes on each new
// attempt (restartKey increments on retry/restart, which also clears any
// saved progress first, so there's no stale resume data to mismatch).
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Mid-level resume helpers ─────────────────────────────────────────────────

type SavedProgress = {
  qIndex: number;
  lives: number;
  correct: number;    // also used as alreadySavedCorrect in GameContext
  points: number;     // also used as alreadySavedPoints  in GameContext
  streak: number;
  hintsLeft: number;
};

const progressKey   = (wId: number, lId: number) => `@historyhadro_lvl_${wId}_${lId}`;
const EXPLAIN_PREF_KEY = '@historyhadro_explain_pref';

function starsForScore(correct: number): number {
  if (correct === 10) return 3;
  if (correct >= 8) return 2;
  if (correct >= 6) return 1;
  return 0;
}

function LivesRow({ lives, max = 3 }: { lives: number; max?: number }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <Text key={i} style={{ opacity: i < lives ? 1 : 0.25 }}>
          ❤️
        </Text>
      ))}
    </View>
  );
}

function OptionButton({
  text,
  state,
  onPress,
  disabled = false,
}: {
  text: string;
  state: 'idle' | 'correct' | 'wrong' | 'reveal' | 'eliminated';
  onPress: () => void;
  disabled?: boolean;
}) {
  let bg = 'bg-card';
  let border = 'border-border';
  if (state === 'correct')    { bg = 'bg-green-500/20'; border = 'border-green-500'; }
  if (state === 'wrong')      { bg = 'bg-red-500/20';   border = 'border-red-500'; }
  if (state === 'reveal')     { bg = 'bg-green-500/10'; border = 'border-green-400'; }
  if (state === 'eliminated') { bg = 'bg-muted/40';     border = 'border-border'; }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={state !== 'idle' || disabled}
      activeOpacity={0.75}
      className={`${bg} border ${border} rounded-2xl p-4 mb-3`}
      style={state === 'eliminated' ? { opacity: 0.35 } : undefined}
    >
      <Text
        className="text-foreground text-base"
        style={state === 'eliminated' ? { textDecorationLine: 'line-through' } : undefined}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

type Phase = 'playing' | 'answered' | 'complete' | 'gameover';

/** First N levels of World 1 are free for everyone; the rest require premium. */
const FREE_LEVELS = 3;

export default function LevelScreen() {
  const { worldId: wParam, levelId: lParam } = useLocalSearchParams<{
    worldId: string;
    levelId: string;
  }>();
  const worldId = parseInt(wParam ?? '1', 10);
  const [levelId, setLevelId] = useState(() => parseInt(lParam ?? '1', 10));

  const router = useRouter();
  const { user } = useUser();
  const ageRange = user.ageRange;
  const { answerQuestion, completeLevel, loseLife, startLevel, savePartialSession } = useGame();
  const { hasAccess } = useSubscription();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const world = useMemo(() => WORLDS.find((w) => w.id === worldId)!, [worldId]);

  const [qIndex,      setQIndex]      = useState(0);
  const [lives,       setLives]       = useState(3);
  const [streak,      setStreak]      = useState(0);
  const [correct,     setCorrect]     = useState(0);
  const [points,      setPoints]      = useState(0);
  const [phase,       setPhase]       = useState<Phase>('playing');
  const [chosen,      setChosen]      = useState<number | null>(null);
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
  const [hintsLeft,        setHintsLeft]        = useState(3);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [showExplanations, setShowExplanations] = useState(false);
  const [awaitingNext,     setAwaitingNext]     = useState(false);
  // false until AsyncStorage resume-check is done — prevents a 1-frame flash of
  // question 1 before the restored question index is applied.
  const [resumeReady, setResumeReady] = useState(false);

  // Load persisted "show explanations" preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(EXPLAIN_PREF_KEY)
      .then((val) => { if (val === 'true') setShowExplanations(true); })
      .catch(() => {});
  }, []);

  // Question ORDER and SELECTION use a deterministic seed that includes
  // restartKey: stable within a single attempt (required for mid-level
  // resume, since restartKey never changes while paused), but freshly
  // shuffled on each new attempt (retry/restart/next level all bump it).
  // Option POSITIONS re-shuffle the same way, so replaying a level after
  // game over shows both a different question order and option order.
  const questions = useMemo<Question[]>(() => {
    const pool = ALL_QUESTIONS.filter(
      (q) =>
        q.worldId === worldId &&
        q.levelId === levelId &&
        q.difficulty === ageRange &&
        !q.boss,
    );
    return seededShuffle(pool, worldId * 1000 + levelId + restartKey * 97).slice(0, 10).map((q) => {
      const idx = [0, 1, 2, 3];
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      return { ...q, options: idx.map((i) => q.options[i]), correctIndex: idx.indexOf(q.correctIndex) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, levelId, ageRange, restartKey]);

  const shakeAnim    = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(1)).current;
  // Guard so completeLevel is called at most once per play-through even if the
  // component re-renders multiple times while phase === 'complete'.
  const levelSavedRef = useRef(false);

  // On mount / restart: check AsyncStorage for a saved mid-level position.
  // If found, restore all local state AND pass the resume values into GameContext
  // (so correctCount / answeredCount / score start from the right baseline).
  // alreadySavedCorrect/Points tell completeLevel how much was already written to
  // Firestore so it can write only the delta on completion.
  useEffect(() => {
    let cancelled = false;
    setResumeReady(false);
    (async () => {
      let saved: SavedProgress | null = null;
      try {
        const raw = await AsyncStorage.getItem(progressKey(worldId, levelId));
        if (raw) saved = JSON.parse(raw) as SavedProgress;
      } catch { /* ignore read errors */ }

      if (cancelled) return;

      if (saved) {
        setQIndex(saved.qIndex);
        setLives(saved.lives);
        setCorrect(saved.correct);
        setPoints(saved.points);
        setStreak(saved.streak);
        setHintsLeft(saved.hintsLeft);
        startLevel(worldId, levelId, {
          score:               saved.points,
          correctCount:        saved.correct,
          answeredCount:       saved.qIndex,   // questions 0..qIndex-1 were answered
          lives:               saved.lives,
          streak:              saved.streak,
          alreadySavedCorrect: saved.correct,
          alreadySavedPoints:  saved.points,
        });
      } else {
        startLevel(worldId, levelId);
      }

      setResumeReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  // Auto-save level progress as soon as the quiz phase flips to 'complete'.
  // Also clears the AsyncStorage resume state so the next visit starts fresh.
  useEffect(() => {
    if (phase === 'complete' && !levelSavedRef.current) {
      levelSavedRef.current = true;
      soundManager.play('levelComplete');
      // Clear resume snapshot — level is done, no point resuming from here.
      AsyncStorage.removeItem(progressKey(worldId, levelId)).catch(() => {});
      completeLevel().catch((err) =>
        console.error('[LevelScreen] ❌ auto-save completeLevel failed:', err),
      );
    }
  // completeLevel is stable (useCallback with no changing deps inside GameContext)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Use refs so the focus callback stays stable (empty deps) while still
  // reading the latest state values without stale closures.
  const phaseRef = useRef(phase); phaseRef.current = phase;

  // On re-entry: always dismiss the pause menu (user exited via pause → they want
  // to resume playing, not stare at the pause overlay again). If the level ended
  // in a terminal phase (gameover / complete), do a full reset instead.
  useFocusEffect(
    useCallback(() => {
      // Always clear pause state — coming back should resume playing, not show
      // the pause menu even if the user left while paused.
      setIsPaused(false);

      if (phaseRef.current === 'gameover' || phaseRef.current === 'complete') {
        levelSavedRef.current = false;
        setIsPaused(false);
        setQIndex(0);
        setLives(3);
        setStreak(0);
        setCorrect(0);
        setPoints(0);
        setPhase('playing');
        setChosen(null);
        setHintsLeft(3);
        setEliminatedIndices([]);
        setAwaitingNext(false);
        setRestartKey((k) => k + 1);
      }
    }, []),
  );

  const currentQ = questions[qIndex];

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Gate on resumeReady: calling fadeIn() sets fadeAnim to 0 instantly, so if it
  // fires before resumeReady is true the question renders invisible and stays
  // blank until the animation catches up. Only animate once the questions are
  // actually ready to display.
  useEffect(() => {
    if (!resumeReady) return;
    fadeIn();
  }, [qIndex, fadeIn, resumeReady]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (phase !== 'playing' || !currentQ) return;
      setChosen(optionIndex);
      setPhase('answered');

      const isCorrect = optionIndex === currentQ.correctIndex;
      const newStreak  = isCorrect ? streak + 1 : 0;
      const newCorrect = correct + (isCorrect ? 1 : 0);
      const earned     = isCorrect ? 10 + (newStreak >= 3 ? 5 : 0) : 0;

      setStreak(newStreak);
      setCorrect(newCorrect);
      setPoints((p) => p + earned);

      // Call GameContext
      answerQuestion(isCorrect);
      soundManager.play(isCorrect ? 'correct' : 'incorrect');

      if (!isCorrect) {
        shake();
        const newLives = lives - 1;
        setLives(newLives);
        loseLife();
        if (newLives === 0) {
          soundManager.play('gameOver');
          setTimeout(() => setPhase('gameover'), 1200);
          return;
        }
      }

      // If explanations mode is on and this question has one, halt here.
      // (Game-over path already returned above so we never halt on 0 lives.)
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
          setEliminatedIndices([]);
        }
      }, 1000);
    },
    [phase, currentQ, streak, correct, lives, qIndex, questions.length, shake, answerQuestion, loseLife, showExplanations],
  );

  // Advances to the next question after the user dismisses the explanation popup.
  const handleNext = useCallback(() => {
    setAwaitingNext(false);
    if (qIndex + 1 >= questions.length) {
      setPhase('complete');
    } else {
      setQIndex((i) => i + 1);
      setPhase('playing');
      setChosen(null);
      setEliminatedIndices([]);
    }
  }, [qIndex, questions.length]);

  // Toggles explanation mode and persists the preference.
  const handleToggleExplain = useCallback(() => {
    setShowExplanations((prev) => {
      const next = !prev;
      AsyncStorage.setItem(EXPLAIN_PREF_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  // completeLevel was already called by the auto-save useEffect when phase
  // flipped to 'complete'. Advance to the next level in-place (no navigation)
  // so there are no route-replace issues within the tabs stack. Falls back to
  // the world detail screen only after the last level.
  const handleComplete = useCallback(() => {
    const stars = starsForScore(correct);
    const nextLevelPremiumLocked =
      worldId === 1 && (levelId + 1) > FREE_LEVELS && !hasAccess;
    if (stars > 0 && levelId < world.levels && !nextLevelPremiumLocked) {
      levelSavedRef.current = false;
      setLevelId((l) => l + 1);
      setQIndex(0);
      setLives(3);
      setStreak(0);
      setCorrect(0);
      setPoints(0);
      setPhase('playing');
      setChosen(null);
      setHintsLeft(3);
      setEliminatedIndices([]);
      setAwaitingNext(false);
      setRestartKey((k) => k + 1);
    } else if (nextLevelPremiumLocked) {
      router.replace(`/(tabs)/world/${worldId}?paywall=1` as any);
    } else {
      router.replace(`/(tabs)/world/${worldId}` as any);
    }
  }, [router, worldId, levelId, world.levels, correct, hasAccess]);

  const handleRetry = useCallback(async () => {
    // Await the removal so the useEffect([restartKey]) read never races the delete.
    await AsyncStorage.removeItem(progressKey(worldId, levelId)).catch(() => {});
    levelSavedRef.current = false;
    setQIndex(0);
    setLives(3);
    setStreak(0);
    setCorrect(0);
    setPoints(0);
    setPhase('playing');
    setChosen(null);
    setHintsLeft(3);
    setEliminatedIndices([]);
    setAwaitingNext(false);
    setRestartKey((k) => k + 1);
  }, [worldId, levelId]);

  const handlePause   = useCallback(() => setIsPaused(true),  []);
  const handleResume  = useCallback(() => setIsPaused(false), []);

  const handleHint = useCallback(() => {
    if (eliminatedIndices.length > 0 || hintsLeft === 0 || phase !== 'playing' || !currentQ) return;
    // Shuffle the wrong answer indices and take the first two
    const wrongIndices = currentQ.options
      .map((_, i) => i)
      .filter((i) => i !== currentQ.correctIndex)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    setEliminatedIndices(wrongIndices);
    setHintsLeft((h) => h - 1);
    setPoints((p) => Math.max(0, p - 5));
  }, [eliminatedIndices, hintsLeft, phase, currentQ]);

  const handleRestart = useCallback(() => {
    // Clear saved progress — user explicitly chose to start over.
    AsyncStorage.removeItem(progressKey(worldId, levelId)).catch(() => {});
    levelSavedRef.current = false;
    setIsPaused(false);
    setQIndex(0);
    setLives(3);
    setStreak(0);
    setCorrect(0);
    setPoints(0);
    setPhase('playing');
    setChosen(null);
    setHintsLeft(3);
    setEliminatedIndices([]);
    setAwaitingNext(false);
    setRestartKey((k) => k + 1);
  }, [worldId, levelId]);

  // Called from the game-over screen "Back to world" button.
  // Clears any stale mid-level save (so the level starts fresh on re-entry, not
  // with 0 lives left) then navigates to the world detail screen.
  const handleGameOverExit = useCallback(() => {
    AsyncStorage.removeItem(progressKey(worldId, levelId)).catch(() => {});
    router.replace(`/(tabs)/world/${worldId}` as any);
  }, [router, worldId, levelId]);

  const handleExit = useCallback(() => {
    // Persist the mid-level position so the user can resume from here next time.
    // Only bother if at least one question has been answered (qIndex > 0).
    if (qIndex > 0) {
      const saved: SavedProgress = { qIndex, lives, correct, points, streak, hintsLeft };
      AsyncStorage.setItem(progressKey(worldId, levelId), JSON.stringify(saved)).catch(() => {});
    }

    // Also save partial stats so the Home screen updates immediately.
    // completeLevel will write only the delta (new questions / points since this
    // save) to avoid double-counting if the user comes back and finishes.
    if (correct > 0 || points > 0) {
      savePartialSession(correct, points);
    } else {
      console.log('[handleExit] nothing earned — skipping savePartialSession');
    }

    // Always navigate to the specific world detail screen so exit works
    // correctly regardless of back-stack state (e.g. home screen "Continue"
    // bypasses the world detail screen entirely).
    router.replace(`/(tabs)/world/${worldId}` as any);
  }, [correct, points, qIndex, lives, streak, hintsLeft, savePartialSession, router, worldId, levelId]);

  // ── render: complete ──
  if (phase === 'complete') {
    const stars = starsForScore(correct);
    const bonus = 50 + (correct === 10 ? 100 : 0);
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-6xl mb-4">{stars === 3 ? '🏆' : stars >= 1 ? '⭐' : '😢'}</Text>
        <Text className="text-2xl font-bold text-foreground mb-2">{correct}/10 correct</Text>
        <View className="flex-row gap-1 mb-4">
          {[1, 2, 3].map((s) => (
            <Text key={s} className="text-3xl" style={{ color: '#FCD34D', opacity: stars >= s ? 1 : 0.25 }}>★</Text>
          ))}
        </View>
        <Text className="text-muted-foreground mb-2">+{points} pts (questions)</Text>
        <Text className="text-muted-foreground mb-6">+{bonus} pts (completion bonus)</Text>
        <TouchableOpacity
          onPress={handleComplete}
          className="bg-primary rounded-2xl px-8 py-3 mb-3 w-full items-center"
        >
          <Text className="text-primary-foreground font-bold text-lg">
            {worldId === 1 && (levelId + 1) > FREE_LEVELS && !hasAccess
              ? 'Unlock to Continue'
              : stars > 0 && levelId < world.levels ? `Next: Level ${levelId + 1} →` : 'Back to World'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRetry} className="py-2">
          <Text className="text-muted-foreground">Play again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── render: game over ──
  if (phase === 'gameover') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-6xl mb-4">💀</Text>
        <Text className="text-2xl font-bold text-foreground mb-2">Out of lives!</Text>
        <Text className="text-muted-foreground mb-6">{correct} correct before game over</Text>
        <TouchableOpacity
          onPress={handleRetry}
          className="bg-primary rounded-2xl px-8 py-3 mb-3 w-full items-center"
        >
          <Text className="text-primary-foreground font-bold text-lg">Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGameOverExit} className="py-2">
          <Text className="text-destructive font-bold">Back to world</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Hold rendering until AsyncStorage resume check is done to prevent a 1-frame
  // flash of question 1 before the restored question index is applied.
  if (!resumeReady || !currentQ) return null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header — matches MathRex style */}
        <View className="flex-row items-center justify-between px-6 py-4 bg-card border-b border-border">
          <View className="w-10 h-10" />
          <View className="items-center">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {world.name}
            </Text>
            <Text className="text-lg font-bold text-foreground mt-1">
              Level {levelId}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center bg-muted px-2 py-1 rounded-full">
              <Text className="text-xs mr-1">⚡</Text>
              <Text className="text-sm font-bold text-foreground">{points}</Text>
            </View>
            <LivesRow lives={lives} />
          </View>
        </View>

        {/* Progress bar */}
        <View className="mx-4 mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${((qIndex + (phase === 'answered' ? 1 : 0)) / questions.length) * 100}%`,
              backgroundColor: world.accentColor,
            }}
          />
        </View>

        {/* Question + Options — animated together so options never show without their question */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateX: shakeAnim }] }}
        >
          <View className="px-4 pt-8 pb-6">
            <Text className="text-xl font-bold text-foreground leading-snug">{currentQ.text}</Text>
          </View>

          <View className="px-4">
            {currentQ.options.map((opt, i) => {
              let state: 'idle' | 'correct' | 'wrong' | 'reveal' | 'eliminated' = 'idle';
              if (eliminatedIndices.includes(i) && phase === 'playing') {
                state = 'eliminated';
              } else if (phase === 'answered') {
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

        {/* Explanation — only shown when the Explain toggle is on */}
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

        {/* Streak badge */}
        {streak >= 3 && phase === 'playing' && (
          <View className="mx-4 mt-4 bg-yellow-500/20 border border-yellow-400 rounded-xl p-3 flex-row items-center gap-2">
            <Text>🔥</Text>
            <Text className="text-yellow-400 font-semibold">{streak} streak! +5 bonus</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom action bar ── */}
      <View
        className="absolute left-0 right-0 bg-card border-t border-border flex-row items-center px-6"
        style={{ bottom: 0, height: 60 + bottomInset, paddingBottom: bottomInset }}
      >
        {/* Pause */}
        <TouchableOpacity
          onPress={handlePause}
          activeOpacity={0.7}
          className="flex-row items-center gap-2 bg-muted rounded-xl px-4 py-2"
        >
          <Text className="text-base">⏸</Text>
          <Text className="text-foreground text-sm font-semibold">Pause</Text>
        </TouchableOpacity>

        {/* Mute (session-only, doesn't touch the Profile setting) */}
        <TouchableOpacity
          onPress={handleToggleMute}
          activeOpacity={0.7}
          className="flex-row items-center bg-muted rounded-xl px-3 py-2 ml-2"
        >
          <Text className="text-base">{muted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>

        <View className="flex-1" />

        {/* Explain toggle */}
        <TouchableOpacity
          onPress={handleToggleExplain}
          activeOpacity={0.7}
          className="flex-row items-center gap-2 rounded-xl px-3 py-2 mr-2"
          style={{
            backgroundColor: showExplanations ? '#3b82f620' : 'transparent',
            borderWidth: 1,
            borderColor: showExplanations ? '#3b82f6' : '#ffffff20',
          }}
        >
          <Text className="text-base">📖</Text>
          <Text className="text-foreground text-sm font-semibold">Explain</Text>
        </TouchableOpacity>

        {/* 50/50 Hint */}
        <TouchableOpacity
          onPress={handleHint}
          disabled={eliminatedIndices.length > 0 || hintsLeft === 0 || phase !== 'playing'}
          activeOpacity={0.7}
          className="flex-row items-center gap-2 rounded-xl px-4 py-2"
          style={{
            backgroundColor: eliminatedIndices.length > 0 || hintsLeft === 0 || phase !== 'playing'
              ? 'transparent'
              : '#ca8a0420',
            borderWidth: 1,
            borderColor: eliminatedIndices.length > 0 || hintsLeft === 0 || phase !== 'playing'
              ? '#ffffff20'
              : '#ca8a04',
            opacity: eliminatedIndices.length > 0 || hintsLeft === 0 || phase !== 'playing' ? 0.4 : 1,
          }}
        >
          <Text className="text-base">💡</Text>
          <Text className="text-foreground text-sm font-semibold">
            50/50 ({hintsLeft})
          </Text>
        </TouchableOpacity>
      </View>

      <PauseMenu
        visible={isPaused}
        onResume={handleResume}
        onRestart={handleRestart}
        onExit={handleExit}
      />
    </SafeAreaView>
  );
}
