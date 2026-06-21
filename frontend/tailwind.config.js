/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Semantic tokens backed by CSS variables (see index.css). Defined as RGB
      // channel triplets so Tailwind opacity modifiers (e.g. bg-surface-2/60) work.
      colors: {
        bg:           'rgb(var(--bg) / <alpha-value>)',
        surface:      'rgb(var(--surface) / <alpha-value>)',
        'surface-2':  'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3':  'rgb(var(--surface-3) / <alpha-value>)',
        line:         'rgb(var(--line) / <alpha-value>)',
        ink:          'rgb(var(--ink) / <alpha-value>)',
        'ink-muted':  'rgb(var(--ink-muted) / <alpha-value>)',
        'ink-faint':  'rgb(var(--ink-faint) / <alpha-value>)',
        accent:       'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        'accent-soft':'rgb(var(--accent-soft) / <alpha-value>)',
        warn:         'rgb(var(--warn) / <alpha-value>)',
        'warn-soft':  'rgb(var(--warn-soft) / <alpha-value>)',
        danger:       'rgb(var(--danger) / <alpha-value>)',
        'danger-soft':'rgb(var(--danger-soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
