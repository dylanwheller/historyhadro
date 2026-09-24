export type Mood = 'idle' | 'happy' | 'sad' | 'celebrate';

export type Reaction = {
  mood: Mood;
  message: string;
  confetti: number;
};

const CORRECT_MESSAGES = ['Nice one!', 'Yes!', 'Brilliant!', 'You got it!', 'Awesome!'];
const WRONG_MESSAGES = ['So close!', 'Good try!', 'Oops! Next one!'];
const STREAK_MILESTONES = [3, 5, 7, 10];

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export function reactionFor(isCorrect: boolean, newStreak: number): Reaction {
  if (!isCorrect) return { mood: 'sad', message: pick(WRONG_MESSAGES), confetti: 0 };
  if (STREAK_MILESTONES.includes(newStreak)) {
    return { mood: 'celebrate', message: `🔥 ${newStreak} in a row!`, confetti: 44 };
  }
  return { mood: 'happy', message: pick(CORRECT_MESSAGES), confetti: 16 };
}
