import { vars } from 'nativewind';

export const lightTheme = vars({
  '--color-background':        '26 19 0',
  '--color-foreground':        '240 249 255',
  '--color-card':              '38 28 0',
  '--color-border':            '64 47 0',
  '--color-primary':           '234 179 8',
  '--color-primary-foreground':'255 255 255',
  '--color-muted':             '20 15 0',
  '--color-muted-foreground':  '148 163 184',
  '--color-destructive':       '239 68 68',
  '--color-destructive-foreground': '255 255 255',
});

// HistoryHadro is dark-only; darkTheme = same values
export const darkTheme = lightTheme;
