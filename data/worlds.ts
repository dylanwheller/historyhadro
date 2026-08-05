export type AgeRange = 'junior' | 'senior';

export type Question = {
  id: string;
  worldId: number;
  levelId: number;
  difficulty: AgeRange;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation?: string;
  boss?: boolean;
};

export type World = {
  id: number;
  name: string;
  subject: string;
  description: string;
  icon: string;
  accentColor: string;
  levels: number;
  bossName: string;
};

export const WORLDS: World[] = [
  {
    id: 1,
    name: 'Ancient Civilisations',
    subject: 'Ancient Civilisations',
    description: 'Uncover Egypt, Greece, Rome, Mesopotamia, and the ancient world',
    icon: '🏺',
    accentColor: '#eab308',
    levels: 5,
    bossName: 'The Pharaoh Titan',
  },
  {
    id: 2,
    name: 'The Middle Ages',
    subject: 'The Middle Ages',
    description: 'Knights, castles, plagues, and the rise of kingdoms',
    icon: '⚔️',
    accentColor: '#eab308',
    levels: 5,
    bossName: 'The Iron Warlord',
  },
  {
    id: 3,
    name: 'Exploration & Empire',
    subject: 'Exploration & Empire',
    description: 'Age of discovery, colonisation, revolutions, and trade routes',
    icon: '⛵',
    accentColor: '#eab308',
    levels: 5,
    bossName: 'The Sea Conqueror',
  },
  {
    id: 4,
    name: 'The Modern World',
    subject: 'The Modern World',
    description: 'Industrial revolution, World Wars, and the road to today',
    icon: '🏭',
    accentColor: '#eab308',
    levels: 5,
    bossName: 'The Industrial Giant',
  },
];

export const RANK_NAMES = [
  'Apprentice',
  'Chronicler',
  'Scribe',
  'Historian',
  'Scholar',
  'Archivist',
  'Sage',
  'Antiquarian',
  'Academician',
  'HistoryMaster',
];

export const RANK_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];

export function getRankLevel(points: number): number {
  let rank = 1;
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (points >= RANK_THRESHOLDS[i]) rank = i + 1;
    else break;
  }
  return rank;
}

export function getRankName(points: number): string {
  return RANK_NAMES[getRankLevel(points) - 1];
}
