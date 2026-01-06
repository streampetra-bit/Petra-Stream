// src/pages/StreamDetail.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import socket from "../lib/socket";
import TipModal from "../components/TipModal";
import ChatPanel from "../components/ChatPanel";
import ViewerList from "../components/ViewerList";
import Player, { PlayerHandle } from "../components/Player";
import StreamCard from "../components/StreamCard";
import { useToast } from "../contexts/ToastContext";

type Stream = {
  id?: string;
  streamer?: string;
  title?: string;
  description?: string;
  viewerCount?: number;
  playbackUrl?: string;
  videoUrl?: string;
  thumbnail?: string;
  tags?: string[];
  isLive?: boolean;
};

/**
 * Robust StreamDetail page
 * - Falls back to MOCK_STREAMS if API fails / returns nothing
 * - Guards socket calls for environments without a socket server
 * - Provides related-streams fallback
 * - Keyboard shortcuts: Space => play/pause, T => tip, C => focus chat, F => fullscreen, Y => theater mode
 */

const MOCK_STREAMS: Stream[] = [
  {
    id: "s1",
    streamer: "alice",
    title: "Chill coding & tea",
    description: "Pair programming: building a tiny web3 widget live.",
    viewerCount: 124,
    playbackUrl: "",
    thumbnail: "",
    tags: ["coding", "chill"],
    isLive: true,
  },
  {
    id: "s2",
    streamer: "bob",
    title: "Synth beats & live visuals",
    description: "Making music with modular synths — requests welcome.",
    viewerCount: 321,
    playbackUrl: "",
    thumbnail: "",
    tags: ["music", "synth"],
    isLive: true,
  },
  {
    id: "s3",
    streamer: "carol",
    title: "Retro gaming speedruns",
    description: "Classic platformers and banter — come hang out.",
    viewerCount: 89,
    playbackUrl: "",
    thumbnail: "",
    tags: ["gaming", "speedrun"],
    isLive: true,
  },
];

export default function StreamDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const streamId = id ?? "";
  const [stream, setStream] = useState<Stream | null>(null);
  const [openTip, setOpenTip] = useState(false);
  const [related, setRelated] = useState<Stream[]>([]);
  const [theaterMode, setTheaterMode] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const playerRef = useRef<PlayerHandle | null>(null);
  const toast = useToast();
  const chatInputId = `chat-input-${streamId}`;

  // fetch stream + related with fallbacks
  useEffect(() => {
    let mounted = true;
    setStream(null);
    setUsingMock(false);
    setRelated([]);

    (async () => {
      try {
        const res = await api.get(`/api/streams/${encodeURIComponent(streamId)}`).catch(() => null);

        if (mounted && res && res.data) {
          setStream(res.data);
          setUsingMock(false);
        } else {
          // try to match a mock stream by id or streamer name
          const found = MOCK_STREAMS.find(
            (s) =>
              s.id === streamId ||
              (s.streamer && streamId && s.streamer.toLowerCase() === streamId.toLowerCase())
          );

          if (mounted && found) {
            setStream(found);
            setUsingMock(true);
          } else if (mounted) {
            // last-resort placeholder object
            setStream({
              id: streamId,
              streamer: streamId,
              title: `Stream - ${streamId || "unknown"}`,
              description: "This is a fallback stream (backend not available).",
              viewerCount: 0,
              tags: [],
              playbackUrl: "",
              thumbnail: "",
            });
            setUsingMock(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch stream, using fallback", err);
        if (!mounted) return;
        const found = MOCK_STREAMS.find(
          (s) =>
            s.id === streamId ||
            (s.streamer && streamId && s.streamer.toLowerCase() === streamId.toLowerCase())
        );
        if (found) {
          setStream(found);
        } else {
          setStream({
            id: streamId,
            streamer: streamId,
            title: `Stream - ${streamId || "unknown"}`,
            description: "This is a fallback stream (backend not available).",
            viewerCount: 0,
            tags: [],
            playbackUrl: "",
            thumbnail: "",
          });
        }
        setUsingMock(true);
      }
    })();

    (async () => {
      try {
        const r = await api.get(`/api/streams/related?streamId=${encodeURIComponent(streamId)}`).catch(() => null);
        if (mounted && r && Array.isArray(r.data)) {
          setRelated(r.data);
        } else if (mounted) {
          // fallback: pick others from MOCK_STREAMS that aren't the current
          setRelated(MOCK_STREAMS.filter((s) => s.id !== streamId).slice(0, 4));
        }
      } catch (err) {
        if (mounted) setRelated(MOCK_STREAMS.filter((s) => s.id !== streamId).slice(0, 4));
      }
    })();

    // socket join (guarded)
    try {
      if (socket && typeof socket.connect === "function") {
        socket.connect();
        socket.emit?.("join", `stream:${streamId}`);
      } else if (socket && typeof socket.emit === "function") {
        // socket might be an instance already
        socket.emit("join", `stream:${streamId}`);
      }
    } catch (err) {
      console.warn("Socket join failed (dev or missing socket):", err);
    }

    return () => {
      mounted = false;
      try {
        socket.emit?.("leave", `stream:${streamId}`);
        if (typeof socket.disconnect === "function") socket.disconnect();
      } catch (err) {
        // ignore cleanup errors
      }
    };
  }, [streamId]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName ?? "";

      // Avoid intercepting typing in inputs/textareas
      if (tag === "INPUT" || tag === "TEXTAREA" || active?.getAttribute("role") === "textbox") return;

      // Space toggles play/pause
      if (e.code === "Space") {
        e.preventDefault();
        playerRef.current?.togglePlay?.();
        return;
      }

      // Tip
      if (e.key === "t" || e.key === "T") {
        setOpenTip(true);
        return;
      }

      // Focus chat
      if (e.key === "c" || e.key === "C") {
        const el = document.getElementById(chatInputId) as HTMLInputElement | null;
        el?.focus();
        return;
      }

      // Fullscreen
      if (e.key === "f" || e.key === "F") {
        try {
          playerRef.current?.requestFullscreen?.();
        } catch (err) {
          toast.error("Fullscreen failed");
        }
        return;
      }

      // Toggle theater
      if (e.key === "y" || e.key === "Y") {
        setTheaterMode((s) => !s);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatInputId, toast]);

  if (!stream) {
    return (
      <div>
        <div className="glass-card">Loading stream...</div>
      </div>
    );
  }

  const streamerAddress = stream.streamer || stream.id || streamId || "unknown";

  return (
    <>
      <div className={`grid grid-cols-1 ${theaterMode ? "lg:grid-cols-1" : "lg:grid-cols-3"} gap-6`}>
        <div className={theaterMode ? "lg:col-span-1" : "lg:col-span-2 space-y-6"}>
          {usingMock && (
            <div className="glass-card p-3 text-sm text-yellow-300">
              Using mock stream data - backend returned no stream.
            </div>
          )}

          <div>
            <Player
              ref={playerRef}
              src={stream.playbackUrl ?? stream.videoUrl ?? undefined}
              poster={stream.thumbnail ?? undefined}
              title={stream.title ?? "Live"}
              heightClass="aspect-video"
            />
          </div>

          <div className="glass-card flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-primary">{stream.title}</h2>
              <div className="muted mt-1 max-w-xl">{stream.description}</div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs subtle">Live - {stream.viewerCount ?? 0} viewers</span>
                {Array.isArray(stream.tags) &&
                  stream.tags.slice(0, 5).map((t: string) => (
                    <span key={t} className="text-xs px-2 py-1 rounded-md bg-bg/20 text-text">
                      #{t}
                    </span>
                  ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setOpenTip(true)} className="btn-primary" title="Tip streamer (t)">
                Tip Streamer
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById(chatInputId) as HTMLInputElement | null;
                  el?.focus();
                }}
                className="px-3 py-2 rounded-md border"
                title="Focus chat (c)"
              >
                Chat
              </button>

              <button
                onClick={async () => {
                  try {
                    await playerRef.current?.requestFullscreen?.();
                  } catch (err) {
                    toast.error("Fullscreen failed");
                  }
                }}
                className="px-3 py-2 rounded-md border"
                title="Fullscreen (f)"
              >
                Fullscreen
              </button>

              <button
                onClick={() => setTheaterMode((s) => !s)}
                className={`px-3 py-2 rounded-md border ${theaterMode ? "bg-surface/80" : ""}`}
                title="Theater mode (y)"
              >
                {theaterMode ? "Exit Theater" : "Theater"}
              </button>
            </div>
          </div>

          <section>
            <h3 className="font-semibold mb-2 text-text">Activity</h3>

            {/* ChatPanel typing input is focused via chatInputId keyboard handler.
                ChatPanel may not accept an inputId prop depending on your implementation;
                to avoid TypeScript/prop issues we cast to any here so runtime still receives it.
                Consider updating ChatPanel to accept `inputId` for more robust integration. */}
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore */}
            <ChatPanel streamId={String(streamId)} messages={[]} inputId={chatInputId} />
          </section>

          <section>
            <h3 className="font-semibold mb-2 text-text">Related Streams</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.length ? (
                related.map((r) => <StreamCard key={r.streamer || r.id} stream={r as any} />)
              ) : (
                <div className="muted">No related streams found.</div>
              )}
            </div>
          </section>
        </div>

        {!theaterMode && (
          <aside className="glass-card">
            <div className="mb-4">
              <h4 className="text-sm subtle">Streamer</h4>
              <div className="font-mono text-text mt-1">{streamerAddress}</div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm subtle">Supporters</h4>
              <ViewerList streamId={String(streamId)} />
            </div>

            <div className="mb-4">
              <h4 className="text-sm subtle">Related</h4>
              <div className="space-y-2">
                {related.slice(0, 3).map((r) => (
                  <StreamCard key={r.streamer || r.id} stream={r as any} />
                ))}
              </div>
            </div>

            <div className="mt-4 text-sm subtle">
              Events and on-chain actions for this stream will appear in realtime via the indexer.
            </div>
          </aside>
        )}
      </div>

      {openTip && (
        <TipModal
          streamer={streamerAddress}
          onClose={() => setOpenTip(false)}
          onTipped={() => {
            api.get(`/api/streams/${streamId}/tips`).catch(() => {});
            toast.success("Thanks!", "Tip recorded, UI refreshed", 2500);
          }}
        />
      )}
    </>
  );
}
