export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'progress' | 'mastery' | 'streak' | 'social';
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_correct',   title: 'First Record',          description: 'Answer your first question correctly',              icon: '🌟', category: 'progress' },
  { id: 'world1_complete', title: 'Ancient Scholar',        description: 'Complete all levels in Ancient Civilisations',     icon: '🏺', category: 'progress' },
  { id: 'world2_complete', title: 'Medieval Knight',        description: 'Complete all levels in The Middle Ages',           icon: '⚔️', category: 'progress' },
  { id: 'world3_complete', title: 'World Explorer',         description: 'Complete all levels in Exploration & Empire',      icon: '⛵', category: 'progress' },
  { id: 'world4_complete', title: 'Modern Historian',       description: 'Complete all levels in The Modern World',          icon: '🏭', category: 'progress' },
  { id: 'all_worlds',      title: 'Apex Historian',         description: 'Complete all four worlds',                         icon: '🏆', category: 'mastery'  },
  { id: 'boss_first',      title: 'Titan Slayer',           description: 'Defeat your first boss',                           icon: '⚔️', category: 'mastery'  },
  { id: 'boss_all',        title: 'Grand Chronicler',       description: 'Defeat all four world bosses',                     icon: '👑', category: 'mastery'  },
  { id: 'streak_10',       title: 'On The Record!',         description: 'Get a 10-question answer streak',                  icon: '🔥', category: 'streak'   },
  { id: 'perfect_level',   title: 'Flawless',               description: 'Complete a level with 10/10 correct answers',     icon: '⭐', category: 'mastery'  },
  { id: '100_questions',   title: '100 Years',              description: 'Answer 100 questions correctly',                   icon: '💯', category: 'progress' },
  { id: '500_questions',   title: 'Time Traveller',         description: 'Answer 500 questions correctly',                   icon: '🧠', category: 'progress' },
  { id: 'login_7',         title: 'Diligent Scribe',        description: 'Log in 7 days in a row',                          icon: '📅', category: 'social'   },
];
