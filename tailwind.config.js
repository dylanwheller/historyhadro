/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background:           'rgb(var(--color-background) / <alpha-value>)',
        foreground:           'rgb(var(--color-foreground) / <alpha-value>)',
        card:                 'rgb(var(--color-card) / <alpha-value>)',
        border:               'rgb(var(--color-border) / <alpha-value>)',
        primary:              'rgb(var(--color-primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        muted:                'rgb(var(--color-muted) / <alpha-value>)',
        'muted-foreground':   'rgb(var(--color-muted-foreground) / <alpha-value>)',
        destructive:          'rgb(var(--color-destructive) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--color-destructive-foreground) / <alpha-value>)',
      },
      fontFamily: {
        nunito:            ['Nunito_400Regular'],
        'nunito-bold':     ['Nunito_700Bold'],
        'nunito-extrabold':['Nunito_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
