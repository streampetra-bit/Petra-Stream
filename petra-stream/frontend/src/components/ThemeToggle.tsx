// src/components/ThemeToggle.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme, ThemeKey } from "../contexts/ThemeContext";

type ThemePreset = {
  label: string;
  primary: string;
  accent: string;
  bg: string;
};

const PRESETS: Record<ThemeKey, ThemePreset> = {
  "onchain-pulse": {
    label: "Onchain Pulse",
    primary: "#00A3FF",
    accent: "#7CFF6D",
    bg: "#071028",
  },
  "neon-petra": {
    label: "Neon Petra",
    primary: "#FF4DFF",
    accent: "#00FFF0",
    bg: "#070617",
  },
  "midnight-ledger": {
    label: "Midnight Ledger",
    primary: "#0B1B3A",
    accent: "#FFC857",
    bg: "#020617",
  },
  "crpto-glow": {
    label: "Crpto Glow",
    primary: "#39FF14",
    accent: "#8A2BE2",
    bg: "#000000",
  },
  "aurora-petra": {
    label: "Aurora Petra",
    primary: "#00E5A8",
    accent: "#7E5AFF",
    bg: "#071028",
  },
  "prime-beauty": {
    label: "Prime Beauty",
    primary: "#7E5AFF",
    accent: "#00FFF0",
    bg: "#0A0C14",
  },
};

export default function ThemeToggle(): JSX.Element {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const current = PRESETS[theme];
  const orderedThemes = useMemo(() => themes, [themes]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface/70 px-3 py-1.5 text-xs font-semibold text-text hover:bg-white/5 transition"
      >
        <span
          className="h-4 w-4 rounded-full border border-white/20"
          style={{ background: `linear-gradient(135deg, ${current.primary}, ${current.accent})` }}
        />
        <span className="hidden sm:block">{current.label}</span>
        <svg className={`h-4 w-4 text-subtle transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L10 5.414 5.707 9.707A1 1 0 114.293 8.293l5-5A1 1 0 0110 3z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-white/10 bg-bg/95 backdrop-blur-xl shadow-lg z-50"
        >
          <div className="p-2">
            {orderedThemes.map((key) => {
              const preset = PRESETS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTheme(key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                    theme === key ? "bg-white/5" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className="h-8 w-8 rounded-xl border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                  />
                  <span className="flex-1">
                    <div className="text-sm font-semibold text-text">{preset.label}</div>
                    <div className="text-[10px] subtle">{preset.primary} / {preset.accent}</div>
                  </span>
                  {theme === key && (
                    <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
