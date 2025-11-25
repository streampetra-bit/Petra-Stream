/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      // CSS-variable-backed tokens with alpha support
      colors: {
        primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        bg: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
        text: 'rgb(var(--color-text-rgb) / <alpha-value>)',
        glow: 'rgb(var(--color-glow-rgb) / <alpha-value>)',

        // Named palettes (for static references)
        'neon-petra': {
          DEFAULT: '#FF4DFF',
          accent: '#00FFF0',
          bg: '#070617',
          surface: '#0F1224',
          text: '#E6F0FF',
        },
        'onchain-pulse': {
          DEFAULT: '#00A3FF',
          accent: '#7CFF6D',
          bg: '#071028',
          surface: '#0B1A2B',
          text: '#E6F8FF',
        },
        'midnight-ledger': {
          DEFAULT: '#0B1B3A',
          accent: '#FFC857',
          bg: '#020617',
          surface: '#0F2A44',
          text: '#F4F7FA',
        },
        'crypto-glow': {
          DEFAULT: '#39FF14',
          accent: '#8A2BE2',
          bg: '#000000',
          surface: '#0A0A0A',
          text: '#EFFEED',
        },
        'aurora-petra': {
          DEFAULT: '#00E5A8',
          accent: '#7E5AFF',
          bg: '#071028',
          surface: '#0D2233',
          text: '#FCFDFF',
        },
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Poppins', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
      },

      boxShadow: {
        'neon-sm': '0 2px 12px rgba(0,163,255,0.08)',
        'neon-lg': '0 8px 40px rgba(0,163,255,0.14)',
        'glow-primary': '0 0 18px rgba(0,163,255,0.28)',
        'glow-accent': '0 0 26px rgba(124,255,109,0.16)',
      },

      keyframes: {
        'pulse-glow': {
          '0%': { boxShadow: '0 0 0 rgba(0,0,0,0)' },
          '50%': { boxShadow: '0 0 32px rgba(0,163,255,0.14)' },
          '100%': { boxShadow: '0 0 0 rgba(0,0,0,0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },

      // Combined “Prime Beauty” gradient
      backgroundImage: {
        'prime-beauty':
          'linear-gradient(135deg, #FF4DFF 0%, #00FFF0 18%, #00A3FF 36%, #7CFF6D 56%, #FFC857 76%, #39FF14 100%)',
      },

      borderRadius: {
        'lg-2xl': '1.25rem',
      },

      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
