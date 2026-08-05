// lib/GameContext.tsx
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import {
  getWorldProgress,
  saveWorldLevelProgress,
  saveBossDefeated,
  updateDailyStat,
  updateLeaderboard,
  getUserAchievements,
  getUserDailyStats,
  saveAchievement,
} from '@/lib/firebase';
import { useUser } from '@/lib/UserContext';
import AchievementService from '@/services/AchievementService';
import { soundManager } from '@/lib/sounds';
import AchievementUnlockPopup from '@/components/AchievementUnlockPopup';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorldProgressState = {
  [worldId: number]: {
    highestLevelUnlocked: number;
    levelsCompleted: number;
    bossDefeated: boolean;
    levels: Record<string, { stars: number; completed: boolean }>;
  };
};

export type GameState = {
  currentWorld: number | null;
  currentLevel: number | null;
  isBoss: boolean;
  score: number;
  lives: number;
  streak: number;
  answeredCount: number;
  correctCount: number;
  worldProgress: WorldProgressState;
  // Today's accumulated stats — seeded from Firestore on login, incremented locally
  // so the Home screen never shows stale data due to Firestore write latency.
  todaySolved: number;
  todayPoints: number;
  // Tracks what was already saved to Firestore via a partial-exit save so that
  // completeLevel can write only the delta and avoid double-counting.
  alreadySavedCorrect: number;
  alreadySavedPoints: number;
  pendingAchievementPopups: { id: string; title: string; icon: string }[];
};

// Options for resuming a level mid-way (populated from AsyncStorage on re-entry).
export type StartLevelOpts = {
  score?: number;
  correctCount?: number;
  answeredCount?: number;
  lives?: number;
  streak?: number;
  alreadySavedCorrect?: number;
  alreadySavedPoints?: number;
};

type GameContextType = {
  game: GameState;
  startLevel: (worldId: number, levelId: number, opts?: StartLevelOpts) => void;
  startBoss: (worldId: number) => void;
  answerQuestion: (correct: boolean) => string[];
  completeLevel: () => Promise<string[]>;
  completeBoss: () => Promise<string[]>;
  savePartialSession: (correctCount: number, sessionPoints: number) => void;
  loseLife: () => boolean;
  resetGame: () => void;
  setWorldProgress: (progress: WorldProgressState) => void;
  triggerAchievementCheck: (eventType: string, eventData?: Record<string, any>) => string[];
  dismissAchievementPopup: () => void;
  /** Mark the final boss (worldId 0) as defeated and persist to Firestore. */
  markFinalBossDefeated: () => void;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultGame: GameState = {
  currentWorld: null,
  currentLevel: null,
  isBoss: false,
  score: 0,
  lives: 3,
  streak: 0,
  answeredCount: 0,
  correctCount: 0,
  worldProgress: {},
  todaySolved: 0,
  todayPoints: 0,
  alreadySavedCorrect: 0,
  alreadySavedPoints: 0,
  pendingAchievementPopups: [],
};

const GameContext = createContext<GameContextType>({} as GameContextType);

export const useGame = () => useContext(GameContext);

// ─── Helper ───────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user, addPoints, addQuestionsSolved } = useUser();
  const [game, setGame] = useState<GameState>(defaultGame);
  const gameRef = useRef<GameState>(defaultGame);
  gameRef.current = game;
  const progressLoaded = useRef(false);

  // Shared by every achievement-check call site below — resolves each newly
  // unlocked ID to its display data and appends to the popup queue.
  const pushAchievementPopups = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const newPopups = ids
      .map((id) => {
        const def = AchievementService.getAchievementById(id);
        return def ? { id, title: def.title, icon: def.icon || '🏆' } : null;
      })
      .filter(Boolean) as { id: string; title: string; icon: string }[];
    if (newPopups.length === 0) return;
    soundManager.play('achievementUnlocked');
    setGame((g) => ({ ...g, pendingAchievementPopups: [...g.pendingAchievementPopups, ...newPopups] }));
  }, []);

  // ── Load world progress from Firestore whenever the signed-in user changes ──
  useEffect(() => {
    if (!user?.id) {
      // Logged out — wipe in-memory progress so the next user starts clean
      setGame(defaultGame);
      progressLoaded.current = false;
      return;
    }

    let cancelled = false;
    progressLoaded.current = false;

    // Load world progress, achievements, and today's stats in parallel
    Promise.all([
      getWorldProgress(user.id),
      getUserAchievements(user.id),
      getUserDailyStats(user.id),
    ])
      .then(([raw, unlockedIds, dailyStats]) => {
        if (cancelled) return;
        const progress: WorldProgressState = {};
        for (const [key, data] of Object.entries(raw)) {
          const worldId = Number(key);
          progress[worldId] = {
            highestLevelUnlocked: data.highestLevelUnlocked ?? 1,
            levelsCompleted:      data.levelsCompleted      ?? 0,
            bossDefeated:         data.bossDefeated         ?? false,
            levels:               data.levels               ?? {},
          };
        }
        // Seed today's stats so the Home screen has them before any level is played
        const todayStat = dailyStats.find((s) => s.dateKey === todayKey());
        setGame(g => ({
          ...g,
          worldProgress: progress,
          todaySolved: todayStat?.questionsSolved ?? 0,
          todayPoints: todayStat?.pointsEarned    ?? 0,
        }));
        progressLoaded.current = true;
        // Seed the in-memory AchievementService with persisted unlock history
        AchievementService.loadProgress({}, unlockedIds);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[GameContext] Failed to load user progress:', err);
          progressLoaded.current = true; // let the app continue even if load fails
        }
      });

    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setWorldProgress = useCallback((progress: WorldProgressState) => {
    setGame(g => ({ ...g, worldProgress: progress }));
    // Note: progressLoaded.current is set by the startup useEffect, not here
  }, []);

  const startLevel = useCallback((worldId: number, levelId: number, opts: StartLevelOpts = {}) => {
    setGame(g => ({
      ...g,
      currentWorld: worldId,
      currentLevel: levelId,
      isBoss: false,
      score:               opts.score               ?? 0,
      lives:               opts.lives               ?? 3,
      streak:              opts.streak              ?? 0,
      answeredCount:       opts.answeredCount       ?? 0,
      correctCount:        opts.correctCount        ?? 0,
      alreadySavedCorrect: opts.alreadySavedCorrect ?? 0,
      alreadySavedPoints:  opts.alreadySavedPoints  ?? 0,
    }));
  }, []);

  const startBoss = useCallback((worldId: number) => {
    setGame(g => ({
      ...g,
      currentWorld: worldId,
      currentLevel: null,
      isBoss: true,
      score: 0,
      lives: 3,
      streak: 0,
      answeredCount: 0,
      correctCount: 0,
    }));
  }, []);

  const answerQuestion = useCallback((correct: boolean): string[] => {
    // Compute new streak synchronously from the ref so we can check achievements
    // outside the setGame updater (updater runs async; values set inside it
    // cannot be reliably read in the same call frame).
    const newStreak = correct ? gameRef.current.streak + 1 : 0;
    const streakBonus = correct && newStreak >= 3 ? 5 : 0;
    const pointsEarned = correct ? 10 + streakBonus : 0;

    const newlyUnlocked: string[] = [];
    if (correct && progressLoaded.current) {
      newlyUnlocked.push(
        ...AchievementService.checkAndUnlockAchievements('correct_answer', { streak: newStreak })
      );
      if (user?.id) {
        for (const id of newlyUnlocked) {
          saveAchievement(user.id, id).catch(console.warn);
        }
      }
      pushAchievementPopups(newlyUnlocked);
    }

    setGame(g => ({
      ...g,
      score: g.score + pointsEarned,
      streak: newStreak,
      answeredCount: g.answeredCount + 1,
      correctCount: correct ? g.correctCount + 1 : g.correctCount,
    }));

    return newlyUnlocked;
  }, [user?.id, pushAchievementPopups]);

  const loseLife = useCallback((): boolean => {
    let over = false;
    setGame(g => {
      const newLives = g.lives - 1;
      if (newLives <= 0) over = true;
      return { ...g, lives: Math.max(0, newLives) };
    });
    return over;
  }, []);

  const completeLevel = useCallback(async (): Promise<string[]> => {
    const {
      currentWorld, currentLevel,
      correctCount, answeredCount, score,
      alreadySavedCorrect, alreadySavedPoints,
    } = gameRef.current;

    console.log('[completeLevel] called — world:', currentWorld, 'level:', currentLevel,
      'correct:', correctCount, 'answered:', answeredCount, 'score:', score,
      'uid:', user?.id ?? '(none)');

    if (!currentWorld || !currentLevel) {
      console.error('[GameContext] completeLevel: ABORT — missing world/level', { currentWorld, currentLevel });
      return [];
    }
    if (!user?.id) {
      console.error('[GameContext] completeLevel: ABORT — user.id not set');
      return [];
    }

    const isPerfect = correctCount === 10 && answeredCount === 10;
    const bonusPoints = isPerfect ? 100 : 50;
    const totalPoints = score + bonusPoints;
    const stars = correctCount >= 10 ? 3 : correctCount >= 8 ? 2 : correctCount >= 6 ? 1 : 0;
    console.log('[completeLevel] stars:', stars, '— saving worldProgress[', currentWorld, '][', currentLevel, ']');

    // Delta: subtract what was already saved to Firestore during a mid-level exit
    // so we never double-count stats when a user resumes and completes a level.
    const deltaCorrect = Math.max(0, correctCount - alreadySavedCorrect);
    const deltaPoints  = Math.max(0, totalPoints  - alreadySavedPoints);

    // ── 1. Update local state immediately (always succeeds) ─────────────────
    addPoints(deltaPoints);
    addQuestionsSolved(deltaCorrect);

    const newlyUnlocked: string[] = [];
    if (progressLoaded.current) {
      newlyUnlocked.push(
        ...AchievementService.checkAndUnlockAchievements('level_complete', {
          worldId: currentWorld,
          levelId: currentLevel,
          correct: correctCount,
          total: answeredCount,
        })
      );
      const wp = gameRef.current.worldProgress[currentWorld];
      if (wp && currentLevel === 5 && correctCount >= 6) {
        newlyUnlocked.push(
          ...AchievementService.checkAndUnlockAchievements('world_complete', { worldId: currentWorld })
        );
      }
      // Persist newly unlocked achievements to Firestore
      for (const id of newlyUnlocked) {
        saveAchievement(user.id, id).catch(console.warn);
      }
      pushAchievementPopups(newlyUnlocked);
    }

    setGame(g => {
      const existing = g.worldProgress[currentWorld] ?? {
        highestLevelUnlocked: 1,
        levelsCompleted: 0,
        bossDefeated: false,
        levels: {},
      };
      const updatedLevels = {
        ...existing.levels,
        [String(currentLevel)]: { stars, completed: correctCount >= 6 },
      };
      const allDone = Object.values(updatedLevels).filter(l => l.completed).length;
      return {
        ...g,
        score: totalPoints,
        todaySolved: g.todaySolved + deltaCorrect,
        todayPoints: g.todayPoints + deltaPoints,
        worldProgress: {
          ...g.worldProgress,
          [currentWorld]: {
            ...existing,
            highestLevelUnlocked: Math.max(existing.highestLevelUnlocked, currentLevel + 1),
            levelsCompleted: allDone,
            levels: updatedLevels,
          },
        },
      };
    });

    // ── 2. Persist to Firestore in background (errors logged, don't block UI) ─
    const newLeaderboardPoints = (user.points ?? 0) + deltaPoints;
    console.log('[completeLevel] writing to Firestore — uid:', user.id,
      'world:', currentWorld, 'level:', currentLevel, 'stars:', stars,
      'points:', deltaPoints, '(delta)', 'date:', todayKey());
    Promise.all([
      saveWorldLevelProgress(user.id, currentWorld, currentLevel, stars),
      updateDailyStat(user.id, todayKey(), { questionsSolved: deltaCorrect, pointsEarned: deltaPoints }),
      updateLeaderboard(user.id, {
        displayName: user.name ?? 'HistoryHadro Explorer',
        points: newLeaderboardPoints,
      }),
    ])
      .then(() => console.log('[completeLevel] ✅ Firestore writes succeeded'))
      .catch(err => console.error('[GameContext] completeLevel: ❌ Firestore write FAILED:', err));

    return newlyUnlocked;
  }, [user, addPoints, addQuestionsSolved, pushAchievementPopups]);

  const completeBoss = useCallback(async (): Promise<string[]> => {
    const { currentWorld, correctCount, score } = gameRef.current;

    if (!currentWorld) {
      console.warn('[GameContext] completeBoss: missing currentWorld');
      return [];
    }
    if (!user?.id) {
      console.warn('[GameContext] completeBoss: user.id not set — cannot persist');
      return [];
    }

    const totalPoints = score + 200;

    // ── 1. Update local state immediately (always succeeds) ─────────────────
    addPoints(totalPoints);
    addQuestionsSolved(correctCount);

    const newlyUnlocked: string[] = [];
    if (progressLoaded.current) {
      newlyUnlocked.push(
        ...AchievementService.checkAndUnlockAchievements('boss_defeated', { worldId: currentWorld })
      );
      for (const id of newlyUnlocked) {
        saveAchievement(user.id, id).catch(console.warn);
      }
      pushAchievementPopups(newlyUnlocked);
    }

    setGame(g => ({
      ...g,
      score: totalPoints,
      todaySolved: g.todaySolved + correctCount,
      todayPoints: g.todayPoints + totalPoints,
      worldProgress: {
        ...g.worldProgress,
        [currentWorld]: {
          ...(g.worldProgress[currentWorld] ?? { highestLevelUnlocked: 1, levelsCompleted: 0, levels: {} }),
          bossDefeated: true,
        },
      },
    }));

    // ── 2. Persist to Firestore in background (errors logged, don't block UI) ─
    const newLeaderboardPoints = (user.points ?? 0) + totalPoints;
    Promise.all([
      saveBossDefeated(user.id, currentWorld),
      updateDailyStat(user.id, todayKey(), { questionsSolved: correctCount, pointsEarned: totalPoints }),
      updateLeaderboard(user.id, {
        displayName: user.name ?? 'HistoryHadro Explorer',
        points: newLeaderboardPoints,
      }),
    ]).catch(err => console.warn('[GameContext] completeBoss: Firestore write failed:', err));

    return newlyUnlocked;
  }, [user, addPoints, addQuestionsSolved, pushAchievementPopups]);

  const markFinalBossDefeated = useCallback(() => {
    if (user?.id) {
      saveBossDefeated(user.id, 0).catch(console.warn); // worldId 0 = final boss
    }
    setGame(g => ({
      ...g,
      worldProgress: {
        ...g.worldProgress,
        0: {
          ...(g.worldProgress[0] ?? { highestLevelUnlocked: 1, levelsCompleted: 0, levels: {} }),
          bossDefeated: true,
        },
      },
    }));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when the user exits a level mid-play (via pause → exit).
  // Saves whatever was earned so it shows up on the Home screen immediately.
  const savePartialSession = useCallback((correctCount: number, sessionPoints: number) => {
    if (correctCount === 0 && sessionPoints === 0) {
      return;
    }
    addPoints(sessionPoints);
    addQuestionsSolved(correctCount);
    setGame(g => ({
      ...g,
      todaySolved: g.todaySolved + correctCount,
      todayPoints: g.todayPoints + sessionPoints,
    }));
    if (user?.id) {
      updateDailyStat(user.id, todayKey(), {
        questionsSolved: correctCount,
        pointsEarned: sessionPoints,
      })
        .then(() => console.log('[savePartialSession] ✅ dailyStats written'))
        .catch(err => console.error('[savePartialSession] ❌ dailyStats write FAILED:', err));
    } else {
      console.error('[savePartialSession] ❌ no user.id — skipping Firestore write');
    }
  }, [user, addPoints, addQuestionsSolved]);

  const triggerAchievementCheck = useCallback(
    (eventType: string, eventData: Record<string, any> = {}): string[] => {
      if (!progressLoaded.current) return [];
      const newlyUnlocked = AchievementService.checkAndUnlockAchievements(eventType, eventData);
      pushAchievementPopups(newlyUnlocked);
      return newlyUnlocked;
    },
    [pushAchievementPopups]
  );

  const resetGame = useCallback(() => {
    setGame(g => ({ ...defaultGame, worldProgress: g.worldProgress }));
  }, []);

  const dismissAchievementPopup = useCallback(() => {
    setGame((g) => ({ ...g, pendingAchievementPopups: g.pendingAchievementPopups.slice(1) }));
  }, []);

  return (
    <GameContext.Provider
      value={{
        game,
        startLevel,
        startBoss,
        answerQuestion,
        completeLevel,
        completeBoss,
        savePartialSession,
        loseLife,
        resetGame,
        setWorldProgress,
        triggerAchievementCheck,
        dismissAchievementPopup,
        markFinalBossDefeated,
      }}
    >
      {children}
      <AchievementUnlockPopup
        queue={game.pendingAchievementPopups}
        onDismiss={dismissAchievementPopup}
      />
    </GameContext.Provider>
  );
}
