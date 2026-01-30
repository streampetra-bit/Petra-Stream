// src/pages/Monitor.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import Player from "../components/Player";
import ChatPanel from "../components/ChatPanel";
import ViewerList from "../components/ViewerList";
import { useToast } from "../contexts/ToastContext";
import { readAuthUser } from "../lib/auth";
import { defaultEmotes } from "../components/chat/emotes";

export default function Monitor(): JSX.Element {
  const toast = useToast();
  const [stream, setStream] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<any[]>([]);
  const [authUser, setAuthUser] = useState(readAuthUser());

  const currentUser =
    authUser?.displayName || authUser?.username || authUser?.address || authUser?.id || "You";

  useEffect(() => {
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    return () => window.removeEventListener("auth-changed", refresh);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/streams/me").catch(() => null);
        if (res?.data) {
          setStream(res.data);
          const id = res.data.streamer || res.data.id;
          if (id) {
            const t = await api.get(`/api/streams/${id}/tips`).catch(() => null);
            setTips(t?.data || []);
          }
        }
      } catch (err) {
        console.error("Monitor load failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const streamId = stream?.streamer || stream?.id || "unknown";
  const playbackUrl = stream?.playbackUrl || "";

  const stats = useMemo(() => {
    return {
      viewers: stream?.viewerCount ?? 0,
      tips: tips.length,
    };
  }, [stream, tips]);

  async function copyPlayback() {
    if (!playbackUrl) {
      toast.error("No playback URL");
      return;
    }
    try {
      await navigator.clipboard.writeText(playbackUrl);
      toast.success("Copied", "Playback URL copied", 1800);
    } catch (err) {
      toast.error("Copy failed");
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="h-4 w-48 bg-bg/20 rounded" />
        <div className="h-3 w-72 bg-bg/20 rounded mt-3" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="glass-card p-6">
        <h1 className="text-xl font-semibold">Stream monitor</h1>
        <p className="muted mt-2">No stream found. Start a stream in the Create page first.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Live Monitor</h1>
          <p className="muted mt-1">Track playback, chat, and tips in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyPlayback} className="px-3 py-2 rounded-md border text-sm">
            Copy playback URL
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <Player
            heightClass="aspect-video"
            title={stream.title || "Live"}
            src={playbackUrl || undefined}
            poster={stream.thumbnail || undefined}
          />

          <div className="glass-card p-4 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs subtle">Stream</div>
              <div className="font-mono text-sm">{streamId}</div>
            </div>
            <div>
              <div className="text-xs subtle">Viewers</div>
              <div className="text-lg font-semibold">{stats.viewers}</div>
            </div>
            <div>
              <div className="text-xs subtle">Tips</div>
              <div className="text-lg font-semibold">{stats.tips}</div>
            </div>
            <div>
              <div className="text-xs subtle">Status</div>
              <div className="text-sm font-semibold">{stream.status || "offline"}</div>
            </div>
          </div>

          <div className="glass-card p-4 flex flex-col min-h-0 h-[clamp(360px,70vh,720px)]">
            <div className="flex-1 min-h-0">
              <ChatPanel
                streamId={String(streamId)}
                currentUser={currentUser}
                variant="monitor"
                showModerationPanel
                isModerator
                currentBadges={["moderator"]}
                showTimestamps
                pinnedNotice="Monitoring mode: keep chat healthy and responsive."
                emotes={defaultEmotes}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">Current viewers</h3>
            <ViewerList streamId={String(streamId)} />
          </div>

          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">Recent tips</h3>
            {tips.length === 0 ? (
              <div className="text-xs subtle">No tips yet.</div>
            ) : (
              <div className="space-y-2">
                {tips.slice(0, 6).map((t: any) => (
                  <div key={t.id || t.txHash} className="text-xs">
                    <div className="text-subtle">{t.txHash || "onchain"}</div>
                    <div>{t.from} tipped {t.amount?.toString?.() ?? t.amount ?? "0"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
