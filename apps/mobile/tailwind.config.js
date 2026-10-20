/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'rgb(var(--cp-primary) / <alpha-value>)', dark: 'rgb(var(--cp-primary-dark) / <alpha-value>)', soft: 'rgb(var(--cp-primary-soft) / <alpha-value>)' },
        ink: 'rgb(var(--cp-ink) / <alpha-value>)',
        muted: 'rgb(var(--cp-muted) / <alpha-value>)',
        surface: 'rgb(var(--cp-surface) / <alpha-value>)',
        line: 'rgb(var(--cp-line) / <alpha-value>)',
      },
      fontFamily: { sans: ['Vazirmatn', 'Tahoma', 'sans-serif'] },
    },
  },
  plugins: [],
};
