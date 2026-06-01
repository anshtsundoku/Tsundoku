/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    // Radius is driven by CSS variables so each interface style (Wood / Swiss /
    // Bohemian) defines its own corner language. Swiss flattens them all to 0,
    // Wood uses gentle curves, Bohemian uses generous organic ones.
    borderRadius: {
      none: '0',
      sm: 'var(--r-sm)',
      DEFAULT: 'var(--r-md)',
      md: 'var(--r-md)',
      lg: 'var(--r-lg)',
      xl: 'var(--r-xl)',
      '2xl': 'var(--r-2xl)',
      '3xl': 'var(--r-2xl)',
      full: 'var(--r-full)',
    },
    extend: {
      fontFamily: {
        // The active style swaps the whole family via --font-ui.
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        // Eyebrow/kicker tracking varies per style (Swiss is widest).
        eyebrow: 'var(--ls-eyebrow)',
      },
      colors: {
        // Palette is exposed as CSS variables; the same class names drive all
        // three styles in both light and dark.
        bg:        'rgb(var(--bg) / <alpha-value>)',
        elev:      'rgb(var(--elev) / <alpha-value>)',
        ink:       'rgb(var(--ink) / <alpha-value>)',
        muted:     'rgb(var(--muted) / <alpha-value>)',
        wood:      'rgb(var(--wood) / <alpha-value>)',
        'wood-2':  'rgb(var(--wood-2) / <alpha-value>)',
        border:    'rgb(var(--border) / <alpha-value>)',
        highlight: 'rgb(var(--highlight) / <alpha-value>)',
        // Structural rule colour — strong (ink) for Swiss, soft (border) for
        // Wood/Bohemian — so dividers and the modular grid adapt per style.
        line:      'rgb(var(--line) / <alpha-value>)',
      },
      boxShadow: {
        // Flat for Swiss, soft warm elevation for Wood/Bohemian.
        soft: 'var(--shadow-soft)',
      },
    },
  },
  plugins: [],
};
