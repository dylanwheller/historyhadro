// components/AchievementSystem.tsx
import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
} from 'react';
import AchievementService from '@/services/AchievementService';
import { ACHIEVEMENTS } from '@/data/achievements';
import type { Achievement } from '@/data/achievements';

// ─── Context ──────────────────────────────────────────────────────────────────

type AchievementContextType = {
  getUnlockedAchievements: () => Achievement[];
};

const AchievementContext = createContext<AchievementContextType>({
  getUnlockedAchievements: () => [],
});

export const useAchievements = () => useContext(AchievementContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AchievementProvider({ children }: { children: ReactNode }) {
  const getUnlockedAchievements = useCallback((): Achievement[] => {
    const ids: string[] = AchievementService.getUnlockedIds() as string[];
    return ACHIEVEMENTS.filter(a => ids.includes(a.id));
  }, []);

  return (
    <AchievementContext.Provider value={{ getUnlockedAchievements }}>
      {children}
    </AchievementContext.Provider>
  );
}
