// src/pages/Notifications.tsx
import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { readAuthUser } from "../lib/auth";
import socket from "../lib/socket";

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time?: string;
  ts?: number;
  kind: "tip" | "system" | "stream" | "follow" | "mention" | "reply";
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
  const [authUser, setAuthUser] = useState(() => readAuthUser());

  useEffect(() => {
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    return () => window.removeEventListener("auth-changed", refresh);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/notifications/me").catch(() => null);
        if (res?.data?.data && Array.isArray(res.data.data)) {
          setItems(res.data.data);
        }
      } catch {
        // keep sample
      } finally {
        setLoading(false);
      }
    })();
  }, [authUser]);

  useEffect(() => {
    const identity =
      authUser?.username || authUser?.address || authUser?.id || authUser?.displayName || "";
    if (!identity) return;
    const room = `user:${identity}`;

    try {
      if (socket && typeof socket.connect === "function" && !socket.connected) {
        socket.auth = { user: identity };
        socket.connect();
      }
      socket.emit?.("join", { room, user: identity });
    } catch (err) {
      console.warn("Notifications socket join failed", err);
    }

    const onNotification = (payload: any) => {
      if (!payload) return;
      const item: NotificationItem = {
        id: String(payload.id ?? `n-${Date.now()}`),
        title: String(payload.title ?? "Notification"),
        description: payload.description ? String(payload.description) : undefined,
        kind: (payload.kind as NotificationItem["kind"]) || "system",
        ts: Number(payload.ts ?? Date.now()),
      };
      setItems((prev) => {
        if (prev.some((n) => n.id === item.id)) return prev;
        return [item, ...prev].slice(0, 50);
      });
    };

    socket.on("notification", onNotification);
    return () => {
      socket.off("notification", onNotification);
      try {
        socket.emit?.("leave", { room });
      } catch {}
    };
  }, [authUser]);

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
