// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeKey =
  | 'onchain-pulse'
  | 'neon-petra'
  | 'midnight-ledger'
  | 'crpto-glow'
  | 'aurora-petra'
  | 'prime-beauty';

const THEME_KEY = 'theme';
const ALL_THEMES: ThemeKey[] = [
  'onchain-pulse',
  'neon-petra',
  'midnight-ledger',
  'crpto-glow',
  'aurora-petra',
  'prime-beauty',
];

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  themes: ThemeKey[];
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitial = (): ThemeKey => {
    if (typeof window === 'undefined') return 'onchain-pulse';
    const stored = localStorage.getItem(THEME_KEY);
    if (stored && (ALL_THEMES as string[]).includes(stored)) return stored as ThemeKey;
    return 'onchain-pulse';
  };

  const [theme, setThemeState] = useState<ThemeKey>(getInitial);

  useEffect(() => {
    const body = document.body;
    // Remove any prior theme-* classes
    Array.from(body.classList)
      .filter((c) => c.startsWith('theme-'))
      .forEach((c) => body.classList.remove(c));
    // Add the currently selected theme as a class on <body>
    body.classList.add(`theme-${theme}`);
    // persist
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = (t: ThemeKey) => setThemeState(t);

  return <ThemeContext.Provider value={{ theme, setTheme, themes: ALL_THEMES }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
