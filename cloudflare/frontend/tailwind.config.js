/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    // Swiss / International Typographic Style: everything is built on a strict
    // rectangular grid. Flatten every radius token to 0 so the whole UI reads
    // as sharp, geometric blocks without touching each component.
    borderRadius: {
      none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0',
      xl: '0', '2xl': '0', '3xl': '0', full: '0',
    },
    extend: {
      fontFamily: {
        // Helvetica is the canonical Swiss-style typeface. Apple devices ship
        // Helvetica Neue; Archivo is the free grotesque fallback webfont for
        // everyone else, then generic sans.
        sans: ['Helvetica Neue', 'Archivo', 'Helvetica', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        eyebrow: '0.14em',
      },
      colors: {
        // Minimal Swiss palette: paper white, near-black ink, hairline grey,
        // and a single saturated accent (classic Swiss red). Exposed as CSS
        // variables so the same class names drive both themes.
        bg:        'rgb(var(--bg) / <alpha-value>)',
        elev:      'rgb(var(--elev) / <alpha-value>)',
        ink:       'rgb(var(--ink) / <alpha-value>)',
        muted:     'rgb(var(--muted) / <alpha-value>)',
        // `wood` is retained as the semantic accent token (now Swiss red) so
        // existing accent usages flip without renaming across the codebase.
        wood:      'rgb(var(--wood) / <alpha-value>)',
        'wood-2':  'rgb(var(--wood-2) / <alpha-value>)',
        border:    'rgb(var(--border) / <alpha-value>)',
        highlight: 'rgb(var(--highlight) / <alpha-value>)',
      },
      boxShadow: {
        // Swiss style is flat — separation comes from rules, not shadows.
        soft: 'none',
      },
    },
  },
  plugins: [],
};
