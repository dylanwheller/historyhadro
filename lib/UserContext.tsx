import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  ensureUserDoc,
  getUserProfile,
  updateUserProfile,
} from '@/lib/firebase';
import type { AgeRange } from '@/lib/ageBand';

export type User = {
  id: string;
  name: string;
  avatarId: number;
  points: number;
  level: number;
  inventory: string[];
  totalQuestionsSolved?: number;
  ageRange: AgeRange;
  onboardingComplete: boolean;
  walkthroughComplete: boolean;
};

export type UserContextType = {
  user: User;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (user: Partial<User>) => void;
  logout: () => void;
  addPoints: (amount: number) => void;
  addQuestionsSolved: (amount: number) => void;
  addItem: (itemId: string) => void;
  updateLevel: (newLevel: number) => void;
  updateUserStats: (changes: Partial<User>) => void;
  setAgeRange: (range: AgeRange) => void;
  setAvatar: (id: number) => void;
};

const defaultUser: User = {
  id: '',
  name: 'HistoryHadro Explorer',
  avatarId: 0,
  points: 0,
  level: 1,
  inventory: [],
  totalQuestionsSolved: 0,
  ageRange: 'junior',
  onboardingComplete: false,
  walkthroughComplete: false,
};

const UserContext = createContext<UserContextType | null>(null);

// Points required to reach each level (index 0 = Level 1)
const LEVEL_THRESHOLDS = [0, 500, 1_500, 3_000, 5_500, 9_000, 13_500, 19_000, 26_000, 35_000];

function getLevelFromPoints(points: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User>(defaultUser);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const uid = authUser?.uid ?? null;

    if (!uid) {
      setUser(defaultUser);
      setIsLoggedIn(false);
      setIsLoading(false);
      return;
    }

    const displayName = authUser?.displayName ?? null;

    setUser(prev => ({
      ...prev,
      id: uid,
      name: displayName ?? prev.name,
    }));

    setIsLoading(true);

    (async () => {
      try {
        console.log('[UserContext] loading profile for uid:', uid);
        await ensureUserDoc(uid, {
          name: displayName ?? defaultUser.name,
        });
        console.log('[UserContext] ✅ ensureUserDoc succeeded');

        const rawProfile = await getUserProfile(uid);
        console.log('[UserContext] getUserProfile result:', JSON.stringify(rawProfile));
        if (rawProfile) {
          const profile = rawProfile as {
            name?: string;
            avatarId?: number;
            points?: number;
            level?: number;
            inventory?: string[];
            totalQuestionsSolved?: number;
            ageRange?: string;
            onboardingComplete?: boolean;
            walkthroughComplete?: boolean;
          };
          setUser({
            id: uid,
            name: profile.name ?? defaultUser.name,
            avatarId: profile.avatarId ?? 0,
            points: profile.points ?? 0,
            level: profile.level ?? 1,
            inventory: profile.inventory ?? [],
            totalQuestionsSolved: profile.totalQuestionsSolved ?? 0,
            ageRange: (profile.ageRange as AgeRange) ?? 'junior',
            onboardingComplete: profile.onboardingComplete ?? false,
            walkthroughComplete: profile.walkthroughComplete ?? false,
          });
        }

        setIsLoggedIn(true);
      } catch (err) {
        console.error('[UserContext] ❌ Firestore load error:', err);
        setIsLoggedIn(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [authUser?.uid]);

  const uid = authUser?.uid ?? null;

  const addPoints = (amount: number) => {
    setUser((prev) => {
      const newPoints = prev.points + amount;
      const newLevel = getLevelFromPoints(newPoints);
      const updates: Record<string, any> = { points: newPoints };
      if (newLevel !== prev.level) updates.level = newLevel;
      if (uid) updateUserProfile(uid, updates).catch(console.warn);
      return { ...prev, points: newPoints, level: newLevel };
    });
  };

  const addQuestionsSolved = (amount: number) => {
    setUser((prev) => {
      const newTotal = (prev.totalQuestionsSolved ?? 0) + amount;
      if (uid) updateUserProfile(uid, { totalQuestionsSolved: newTotal }).catch(console.warn);
      return { ...prev, totalQuestionsSolved: newTotal };
    });
  };

  const addItem = (itemId: string) => {
    setUser((prev) => {
      const newInventory = [...prev.inventory, itemId];
      if (uid) updateUserProfile(uid, { inventory: newInventory }).catch(console.warn);
      return { ...prev, inventory: newInventory };
    });
  };

  const updateLevel = (newLevel: number) => {
    setUser((prev) => {
      if (uid) updateUserProfile(uid, { level: newLevel }).catch(console.warn);
      return { ...prev, level: newLevel };
    });
  };

  const login = (updates: Partial<User>) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      if (uid) {
        const { id: _id, ...firestoreFields } = updates;
        updateUserProfile(uid, firestoreFields).catch(console.warn);
      }
      return next;
    });
    setIsLoggedIn(true);
  };

  const logout = () => {
    setUser(defaultUser);
    setIsLoggedIn(false);
  };

  const setAgeRange = (range: AgeRange) => {
    setUser((prev) => {
      const next = { ...prev, ageRange: range };
      if (uid) updateUserProfile(uid, { ageRange: range }).catch(console.warn);
      return next;
    });
  };

  const setAvatar = (id: number) => {
    setUser((prev) => {
      const next = { ...prev, avatarId: id };
      if (uid) updateUserProfile(uid, { avatarId: id }).catch(console.warn);
      return next;
    });
  };

  const updateUserStats = (changes: Partial<User>) => {
    setUser((prev) => {
      const next = { ...prev, ...changes };
      if ('points' in changes) {
        next.level = getLevelFromPoints(next.points);
      }
      if (uid) {
        const { id: _id, ...firestoreFields } = changes as any;
        if (next.level !== prev.level) {
          (firestoreFields as any).level = next.level;
        }
        updateUserProfile(uid, firestoreFields).catch(console.warn);
      }
      return next;
    });
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoggedIn,
        isLoading,
        login,
        logout,
        addPoints,
        addQuestionsSolved,
        addItem,
        updateLevel,
        updateUserStats,
        setAgeRange,
        setAvatar,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};
