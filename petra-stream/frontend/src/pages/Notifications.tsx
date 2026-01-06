// src/pages/Notifications.tsx
import React, { useEffect, useState } from "react";
import api from "../lib/api";

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time?: string;
  ts?: number;
  kind: "tip" | "system" | "stream";
};

const SAMPLE: NotificationItem[] = [
  {
    id: "n1",
    title: "Welcome to Petra Stream",
    description: "You are all set. Connect a wallet to start tipping.",
    time: "Just now",
    kind: "system",
  },
];

export default function Notifications(): JSX.Element {
  const [items, setItems] = useState<NotificationItem[]>(SAMPLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/notifications").catch(() => null);
        if (res?.data?.data && Array.isArray(res.data.data)) {
          setItems(res.data.data);
        }
      } catch {
        // keep sample
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatTime = (n: NotificationItem) => {
    if (n.time) return n.time;
    if (typeof n.ts === "number") {
      return new Date(n.ts).toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "Recently";
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <p className="muted mt-1">Tips, stream updates, and system alerts.</p>
      </header>

      {loading ? (
        <div className="glass-card p-6 animate-pulse">
          <div className="h-4 w-48 bg-bg/20 rounded" />
          <div className="h-3 w-72 bg-bg/20 rounded mt-3" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold">No notifications yet</h3>
          <p className="muted mt-2">Join a stream or send a tip to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div key={n.id} className="glass-card p-4 flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{n.title}</div>
                {n.description ? <div className="text-xs subtle mt-1">{n.description}</div> : null}
              </div>
              <div className="text-xs subtle">{formatTime(n)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
