import type { Question } from './worlds';
import { WORLD1_QUESTIONS } from './questions/world1';
import { WORLD2_QUESTIONS } from './questions/world2';
import { WORLD3_QUESTIONS } from './questions/world3';
import { WORLD4_QUESTIONS } from './questions/world4';

export const ALL_QUESTIONS: Question[] = [
  ...WORLD1_QUESTIONS,
  ...WORLD2_QUESTIONS,
  ...WORLD3_QUESTIONS,
  ...WORLD4_QUESTIONS,
];
