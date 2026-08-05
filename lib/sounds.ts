import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@historyhadro_sound_enabled';

export type SoundName =
  | 'correct'
  | 'incorrect'
  | 'gameOver'
  | 'levelComplete'
  | 'bossDefeated'
  | 'defeatedByBoss'
  | 'dailyChallengeComplete'
  | 'achievementUnlocked';

const SOUND_FILES: Record<SoundName, number> = {
  correct: require('../assets/sounds/correct.wav'),
  incorrect: require('../assets/sounds/incorrect.wav'),
  gameOver: require('../assets/sounds/game-over.wav'),
  levelComplete: require('../assets/sounds/level-complete.wav'),
  bossDefeated: require('../assets/sounds/boss-defeated.wav'),
  defeatedByBoss: require('../assets/sounds/defeated-by-boss.wav'),
  dailyChallengeComplete: require('../assets/sounds/daily-challenge-complete.wav'),
  achievementUnlocked: require('../assets/sounds/achievement-unlocked.wav'),
};

class SoundManager {
  private players: Partial<Record<SoundName, AudioPlayer>> = {};
  private enabled = true;
  private sessionMuted = false;
  private ready = false;

  async preload(): Promise<void> {
    if (this.ready) return;
    try {
      const stored = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      if (stored !== null) this.enabled = stored === 'true';
    } catch {
      // ignore — default stays true
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    } catch (e) {
      console.warn('[SoundManager] setAudioModeAsync failed:', e);
    }
    for (const name of Object.keys(SOUND_FILES) as SoundName[]) {
      try {
        this.players[name] = createAudioPlayer(SOUND_FILES[name]);
      } catch (e) {
        console.warn(`[SoundManager] failed to load sound "${name}":`, e);
      }
    }
    this.ready = true;
  }

  async play(name: SoundName): Promise<void> {
    if (!this.enabled || this.sessionMuted) return;
    const player = this.players[name];
    if (!player) return;
    try {
      await player.seekTo(0);
      player.play();
    } catch (e) {
      console.warn(`[SoundManager] failed to play "${name}":`, e);
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    AsyncStorage.setItem(SOUND_ENABLED_KEY, String(value)).catch(() => {});
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setSessionMuted(value: boolean): void {
    this.sessionMuted = value;
  }

  isSessionMuted(): boolean {
    return this.sessionMuted;
  }

  unload(): void {
    for (const player of Object.values(this.players)) {
      try { player?.remove(); } catch { /* ignore */ }
    }
    this.players = {};
    this.ready = false;
  }
}

export const soundManager = new SoundManager();
