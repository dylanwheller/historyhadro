import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  increment,
  serverTimestamp,
} from 'firebase/firestore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const firebaseConfig = require('../firebaseConfig');

// Firebase JS SDK v12 removed getReactNativePersistence.
// initializeAuth internally calls `new cls()` so we pass a class constructor,
// not a plain object instance.
class AsyncStoragePersistence {
  static readonly type: 'LOCAL' = 'LOCAL';
  readonly type: 'LOCAL' = 'LOCAL';

  _isAvailable() { return Promise.resolve(true); }

  _set(key: string, value: unknown) {
    return AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async _get(key: string) {
    try {
      const val = await AsyncStorage.getItem(key);
      return val !== null ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  _remove(key: string) { return AsyncStorage.removeItem(key); }
  _addListener(_key: string, _listener: unknown)    {}
  _removeListener(_key: string, _listener: unknown) {}
}

const appAlreadyExists = getApps().length > 0;
const app = appAlreadyExists ? getApp() : initializeApp(firebaseConfig);

export const auth = appAlreadyExists
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: AsyncStoragePersistence as unknown as Persistence,
    });

export const db = getFirestore(app, 'smarty-pants');

const userDoc    = (uid: string) => doc(db, 'historyhadro_users', uid);
const progressDoc = (uid: string, worldId: number) =>
  doc(db, 'historyhadro_users', uid, 'worldProgress', String(worldId));
const achievementDoc = (uid: string, achId: string) =>
  doc(db, 'historyhadro_users', uid, 'achievements', achId);
const dailyStatDoc = (uid: string, dateKey: string) =>
  doc(db, 'historyhadro_users', uid, 'dailyStats', dateKey);
const leaderboardDoc = (uid: string) => doc(db, 'historyhadro_leaderboard', uid);

export async function ensureUserDoc(uid: string, defaults: { name?: string }): Promise<void> {
  const ref = userDoc(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name:               defaults.name ?? 'HistoryHadro Explorer',
      avatarId:           0,
      points:             0,
      level:              1,
      inventory:          [],
      totalQuestionsSolved: 0,
      ageRange:           'junior',
      onboardingComplete: false,
      walkthroughComplete: false,
      createdAt:          serverTimestamp(),
    });
  }
}

export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function updateUserProfile(uid: string, updates: Record<string, unknown>): Promise<void> {
  await updateDoc(userDoc(uid), { ...updates, updatedAt: serverTimestamp() });
}

export type WorldProgressDoc = {
  highestLevelUnlocked?: number;
  levelsCompleted?: number;
  bossDefeated?: boolean;
  levels?: Record<string, { stars: number; completed: boolean }>;
};

export async function getWorldProgress(uid: string): Promise<Record<string, WorldProgressDoc>> {
  const colRef = collection(db, 'historyhadro_users', uid, 'worldProgress');
  const snap = await getDocs(colRef);
  const result: Record<string, WorldProgressDoc> = {};
  snap.forEach(d => { result[d.id] = d.data() as WorldProgressDoc; });
  return result;
}

export async function saveWorldLevelProgress(
  uid: string, worldId: number, levelId: number, stars: number,
): Promise<void> {
  const ref = progressDoc(uid, worldId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  const existingStars = (existing as any)?.levels?.[String(levelId)]?.stars ?? 0;
  if (stars <= existingStars) return;
  await setDoc(ref, {
    highestLevelUnlocked: Math.max((existing as any)?.highestLevelUnlocked ?? 1, levelId + 1),
    levelsCompleted:      ((existing as any)?.levelsCompleted ?? 0) + (existingStars === 0 && stars > 0 ? 1 : 0),
    bossDefeated:         (existing as any)?.bossDefeated ?? false,
    levels: { ...((existing as any)?.levels ?? {}), [String(levelId)]: { stars, completed: stars > 0 } },
  }, { merge: true });
}

export async function saveBossDefeated(uid: string, worldId: number): Promise<void> {
  await setDoc(progressDoc(uid, worldId), { bossDefeated: true }, { merge: true });
}

export async function getUserAchievements(uid: string): Promise<string[]> {
  const colRef = collection(db, 'historyhadro_users', uid, 'achievements');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => d.id);
}

export async function saveAchievement(uid: string, achievementId: string): Promise<void> {
  await setDoc(achievementDoc(uid, achievementId), { unlockedAt: serverTimestamp() });
}

export async function getUserDailyStats(uid: string): Promise<Array<{dateKey: string; questionsSolved?: number; pointsEarned?: number; loggedIn?: boolean}>> {
  const colRef = collection(db, 'historyhadro_users', uid, 'dailyStats');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ dateKey: d.id, ...(d.data() as any) }));
}

export async function updateDailyStat(
  uid: string,
  dateKey: string,
  updates: {
    questionsSolved?: number;
    pointsEarned?: number;
    loggedIn?: boolean;
    dailyChallengeCompleted?: boolean;
    dailyChallengeCorrect?: number;
    dailyChallengePts?: number;
  },
): Promise<void> {
  const ref = dailyStatDoc(uid, dateKey);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.questionsSolved)         payload.questionsSolved         = increment(updates.questionsSolved);
  if (updates.pointsEarned)            payload.pointsEarned            = increment(updates.pointsEarned);
  if (updates.loggedIn)                payload.loggedIn                = true;
  if (updates.dailyChallengeCompleted) payload.dailyChallengeCompleted = true;
  if (updates.dailyChallengeCorrect)   payload.dailyChallengeCorrect   = updates.dailyChallengeCorrect;
  if (updates.dailyChallengePts)       payload.dailyChallengePts       = updates.dailyChallengePts;
  await setDoc(ref, payload, { merge: true });
}

export async function updateLeaderboard(
  uid: string,
  data: { displayName: string; points: number },
): Promise<void> {
  await setDoc(leaderboardDoc(uid), {
    displayName: data.displayName,
    points:      data.points,
    updatedAt:   serverTimestamp(),
  }, { merge: true });
}

export async function getLeaderboard(limitCount = 50): Promise<Array<{uid: string; displayName: string; points: number; updatedAt?: unknown}>> {
  const q = query(
    collection(db, 'historyhadro_leaderboard'),
    orderBy('points', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
}
