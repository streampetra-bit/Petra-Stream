// src/pages/Settings.tsx
import React, { useEffect, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../contexts/ToastContext";

type LocalSettings = {
  notifications: boolean;
  autoplay: boolean;
  compactMode: boolean;
};

const STORAGE_KEY = "app_settings";

export default function Settings(): JSX.Element {
  const toast = useToast();
  const [settings, setSettings] = useState<LocalSettings>({
    notifications: true,
    autoplay: true,
    compactMode: false,
  });

  const allowVpsFallback =
    String(import.meta.env.VITE_ALLOW_VPS_FALLBACK || "false").toLowerCase() === "true";
  const ingestUrl = import.meta.env.VITE_INGEST_URL || "rtmp://165.227.224.72/live";
  const hlsBase = allowVpsFallback ? import.meta.env.VITE_HLS_BASE_URL || "" : "";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...settings, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  }, []);

  function update(next: Partial<LocalSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="muted mt-1">Personalize your experience and streaming preferences.</p>
      </header>

      <div className="glass-card p-5 space-y-3">
        <h3 className="text-lg font-semibold">Appearance</h3>
        <div className="flex items-center justify-between">
          <div className="text-sm muted">Theme</div>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm muted">Compact mode</div>
          <button
            onClick={() => update({ compactMode: !settings.compactMode })}
            className="px-3 py-2 rounded-md border text-sm"
          >
            {settings.compactMode ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <div className="flex items-center justify-between">
          <div className="text-sm muted">Live alerts and tips</div>
          <button
            onClick={() => update({ notifications: !settings.notifications })}
            className="px-3 py-2 rounded-md border text-sm"
          >
            {settings.notifications ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="text-lg font-semibold">Playback</h3>
        <div className="flex items-center justify-between">
          <div className="text-sm muted">Autoplay live streams</div>
          <button
            onClick={() => update({ autoplay: !settings.autoplay })}
            className="px-3 py-2 rounded-md border text-sm"
          >
            {settings.autoplay ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="text-lg font-semibold">Streaming Defaults</h3>
        <div className="text-sm muted">Ingest URL</div>
        <div className="font-mono text-sm">{ingestUrl}</div>
        <div className="text-sm muted mt-2">HLS base URL</div>
        <div className="font-mono text-sm">{hlsBase || "disabled"}</div>
        <div className="mt-3">
          <button
            onClick={() => toast.info("Update .env to change defaults", undefined, 2200)}
            className="px-3 py-2 rounded-md border text-sm"
          >
            How to update
          </button>
        </div>
      </div>
    </section>
  );
}
