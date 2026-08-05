export type AgeRange = 'junior' | 'senior';

export const AGE_RANGES: AgeRange[] = ['junior', 'senior'];

export const AGE_BAND_LABELS: Record<AgeRange, string> = {
  junior: 'Ages 6–9 · Foundation level',
  senior: 'Ages 10–13 · Advanced level',
};
