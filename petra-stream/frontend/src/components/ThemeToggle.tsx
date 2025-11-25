// src/components/ThemeToggle.tsx
import React from 'react';
import { useTheme, ThemeKey } from '../contexts/ThemeContext';

const LABELS: Record<ThemeKey, string> = {
  'onchain-pulse': 'Onchain Pulse',
  'neon-petra': 'Neon Petra',
  'midnight-ledger': 'Midnight Ledger',
  'crpto-glow': 'Crpto Glow',
  'aurora-petra': 'Aurora Petra',
  'prime-beauty': 'Prime Beauty',
};

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor="theme-select" className="sr-only">
        Choose theme
      </label>

      <select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeKey)}
        className="rounded-md border border-white/6 px-3 py-1 text-sm font-medium bg-transparent text-text outline-none transition-shadow outline-neon"
        aria-label="Select theme"
      >
        {themes.map((t) => (
          <option key={t} value={t}>
            {LABELS[t]}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ThemeToggle;
