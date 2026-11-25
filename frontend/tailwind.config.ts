import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#070b12',
        surface: {
          DEFAULT: '#0c121e',
          elevated: '#11192a',
          muted: '#090e18',
        },
        navy: {
          950: '#070b12',
          900: '#0a0f1a',
          850: '#0c121e',
          800: '#11192a',
          700: '#1a253b',
          600: '#263552',
        },
        accent: {
          DEFAULT: '#3b82f6',
          light: '#60a5fa',
          dim: '#1d4ed8',
        },
        cyan: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
        },
        violet: {
          DEFAULT: '#7c6cf6',
          light: '#a599ff',
        },
        bull: '#10b981',
        bear: '#ef4444',
        neutral: '#94a3b8',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
