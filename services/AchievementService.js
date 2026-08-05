// services/AchievementService.js
// Plain JS singleton — keep as JS, not TS (existing project pattern).
import { ACHIEVEMENTS } from '../data/achievements';

class AchievementService {
  constructor() {
    this.achievements = ACHIEVEMENTS;
    this.userProgress = {
      correctAnswers: 0,
      longestStreak: 0,
      currentStreak: 0,
      bossesDefeated: 0,
      worldsCompleted: [],     // array of worldIds (numbers)
      loginDays: 0,
      unlockedAchievements: [],
    };
  }

  /**
   * Hydrate from Firestore on login.
   * @param {object} progress - saved from getProgressCounters()
   * @param {string[]} unlockedIds - previously unlocked achievement IDs
   */
  loadProgress(progress = {}, unlockedIds = []) {
    this.userProgress = {
      correctAnswers: progress.correctAnswers ?? 0,
      longestStreak: progress.longestStreak ?? 0,
      currentStreak: progress.currentStreak ?? 0,
      bossesDefeated: progress.bossesDefeated ?? 0,
      worldsCompleted: progress.worldsCompleted ?? [],
      loginDays: progress.loginDays ?? 0,
      unlockedAchievements: [...unlockedIds],
    };
  }

  /**
   * Check for newly unlocked achievements.
   * @param {string} eventType - 'correct_answer'|'level_complete'|'boss_defeated'|'world_complete'|'login'
   * @param {object} eventData - { worldId?, streak?, correct?, total? }
   * @returns {string[]} newly unlocked achievement IDs
   */
  checkAndUnlockAchievements(eventType, eventData = {}) {
    const p = this.userProgress;
    const newlyUnlocked = [];

    // Update progress counters first
    if (eventType === 'correct_answer') {
      p.correctAnswers += 1;
      p.currentStreak = (eventData.streak ?? 0);
      if (p.currentStreak > p.longestStreak) p.longestStreak = p.currentStreak;
    }
    if (eventType === 'boss_defeated') {
      p.bossesDefeated += 1;
    }
    if (eventType === 'world_complete') {
      const wid = eventData.worldId;
      if (wid && !p.worldsCompleted.includes(wid)) {
        p.worldsCompleted.push(wid);
      }
    }
    if (eventType === 'login') {
      p.loginDays += 1;
    }

    // Evaluate each achievement
    for (const ach of this.achievements) {
      if (p.unlockedAchievements.includes(ach.id)) continue;

      let unlocked = false;
      switch (ach.id) {
        case 'first_correct':
          unlocked = p.correctAnswers >= 1;
          break;
        case 'world1_complete':
          unlocked = p.worldsCompleted.includes(1);
          break;
        case 'world2_complete':
          unlocked = p.worldsCompleted.includes(2);
          break;
        case 'world3_complete':
          unlocked = p.worldsCompleted.includes(3);
          break;
        case 'world4_complete':
          unlocked = p.worldsCompleted.includes(4);
          break;
        case 'all_worlds':
          unlocked = [1, 2, 3, 4].every(id => p.worldsCompleted.includes(id));
          break;
        case 'boss_first':
          unlocked = p.bossesDefeated >= 1;
          break;
        case 'boss_all':
          unlocked = p.bossesDefeated >= 4;
          break;
        case 'streak_10':
          unlocked = p.longestStreak >= 10;
          break;
        case 'perfect_level':
          unlocked = eventType === 'level_complete' && eventData.correct === 10 && eventData.total === 10;
          break;
        case '100_questions':
          unlocked = p.correctAnswers >= 100;
          break;
        case '500_questions':
          unlocked = p.correctAnswers >= 500;
          break;
        case 'login_7':
          unlocked = p.loginDays >= 7;
          break;
      }

      if (unlocked) {
        p.unlockedAchievements.push(ach.id);
        newlyUnlocked.push(ach.id);
      }
    }

    return newlyUnlocked;
  }

  /** Returns saveable counters (excludes unlockedAchievements array). */
  getProgressCounters() {
    const { unlockedAchievements: _u, ...counters } = this.userProgress;
    return counters;
  }

  getUnlockedIds() {
    return [...this.userProgress.unlockedAchievements];
  }

  isUnlocked(id) {
    return this.userProgress.unlockedAchievements.includes(id);
  }

  getAchievementById(id) {
    return this.achievements.find(a => a.id === id) ?? null;
  }
}

export default new AchievementService();
