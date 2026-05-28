/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Calibri preferred; Carlito is the free, metric-compatible
        // open-source twin (loaded as a webfont) and falls through to
        // system sans for older devices.
        sans: ['Calibri', 'Carlito', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        // Wood-brown & light-grey palette. Exposed as CSS variables so the
        // same class names work in both themes.
        bg:        'rgb(var(--bg) / <alpha-value>)',
        elev:      'rgb(var(--elev) / <alpha-value>)',
        ink:       'rgb(var(--ink) / <alpha-value>)',
        muted:     'rgb(var(--muted) / <alpha-value>)',
        wood:      'rgb(var(--wood) / <alpha-value>)',
        'wood-2':  'rgb(var(--wood-2) / <alpha-value>)',
        border:    'rgb(var(--border) / <alpha-value>)',
        highlight: 'rgb(var(--highlight) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 1px 12px rgba(60,40,30,0.05)',
      },
    },
  },
  plugins: [],
};
