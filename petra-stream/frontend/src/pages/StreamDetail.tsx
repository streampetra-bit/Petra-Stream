// src/pages/StreamDetail.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import TipModal from "../components/TipModal";
import ChatPanel from "../components/ChatPanel";
import { defaultEmotes } from "../components/chat/emotes";
import ViewerList from "../components/ViewerList";
import Player, { PlayerHandle } from "../components/Player";
import WebRTCPlayer from "../components/WebRTCPlayer";
import CloudflareIframePlayer from "../components/CloudflareIframePlayer";
import StreamCard from "../components/StreamCard";
import { useToast } from "../contexts/ToastContext";
import { readAuthUser } from "../lib/auth";
import socket from "../lib/socket";

type Stream = {
  id?: string;
  streamer?: string;
  title?: string;
  description?: string;
  viewerCount?: number;
  playbackUrl?: string;
  videoUrl?: string;
  screenPlaybackUrl?: string;
  cameraPlaybackUrl?: string;
  webrtcPlaybackUrl?: string;
  screenWebrtcPlaybackUrl?: string;
  cameraWebrtcPlaybackUrl?: string;
  cloudflareCustomerCode?: string;
  cloudflareScreenInputId?: string;
  cloudflareCameraInputId?: string;
  screenUrl?: string;
  cameraUrl?: string;
  thumbnail?: string;
  tags?: string[];
  isLive?: boolean;
  sourceMode?: "camera" | "screen";
};

type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  kind: "tip" | "system" | "stream";
  ts: number;
};

/**
 * Robust StreamDetail page
 * - Falls back to MOCK_STREAMS if API fails / returns nothing
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
    description: "Making music with modular synths - requests welcome.",
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
    description: "Classic platformers and banter - come hang out.",
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
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"stream" | "chat" | "activity" | "support">("stream");
  const [authUser, setAuthUser] = useState(readAuthUser());
  const playerRef = useRef<PlayerHandle | null>(null);
  const toast = useToast();
  const chatInputId = `chat-input-${streamId}`;
  const allowVpsFallback =
    String(import.meta.env.VITE_ALLOW_VPS_FALLBACK || "false").toLowerCase() === "true";
  const hlsBaseUrl = allowVpsFallback ? String(import.meta.env.VITE_HLS_BASE_URL || "") : "";
  const currentUser =
    authUser?.displayName || authUser?.username || authUser?.address || authUser?.id || "You";

  useEffect(() => {
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    return () => window.removeEventListener("auth-changed", refresh);
  }, []);

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

    return () => {
      mounted = false;
    };
  }, [streamId]);

  const activityStreamId = stream?.streamer || stream?.id || streamId;

  useEffect(() => {
    if (!activityStreamId) return;
    let active = true;
    setActivityLoading(true);
    setActivity([]);
    api
      .get(`/api/notifications?streamer=${encodeURIComponent(activityStreamId)}&limit=8`)
      .then((res) => {
        if (!active) return;
        const raw = res?.data?.data;
        if (!Array.isArray(raw)) {
          setActivity([]);
          return;
        }
        const normalized = raw.map((item: any) => ({
          id: String(item?.id ?? `${activityStreamId}-${item?.ts ?? Date.now()}`),
          title: String(item?.title ?? "Activity"),
          description: item?.description ? String(item.description) : undefined,
          kind: (item?.kind as ActivityItem["kind"]) || "system",
          ts: Number(item?.ts ?? Date.now()),
        }));
        setActivity(normalized);
      })
      .catch(() => {
        if (active) setActivity([]);
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activityStreamId]);

  useEffect(() => {
    if (!activityStreamId) return;
    const room = `stream:${activityStreamId}`;

    try {
      if (socket && typeof socket.connect === "function" && !socket.connected) {
        socket.auth = { user: currentUser };
        socket.connect();
      }
      socket.emit?.("join", { room, user: currentUser });
    } catch (err) {
      console.warn("Activity socket join failed", err);
    }

    const onTip = (payload: any) => {
      if (!payload) return;
      const amount = payload.amount ?? payload.netAmount ?? "0";
      const kind = payload.kind === "nft" ? "stream" : "tip";
      const title = kind === "tip" ? "Tip received" : "NFT gift received";
      const description =
        kind === "tip"
          ? `${payload.from ?? "Viewer"} tipped ${amount}`
          : `${payload.from ?? "Viewer"} sent an NFT gift`;
      const id = payload.txHash ? `tip-${payload.txHash}` : `tip-${Date.now()}`;
      const nextItem: ActivityItem = {
        id,
        title,
        description,
        kind,
        ts: Date.now(),
      };
      setActivity((prev) => {
        if (prev.some((item) => item.id === nextItem.id)) return prev;
        return [nextItem, ...prev].slice(0, 12);
      });
    };

    const onChat = (payload: any) => {
      if (!payload || payload.streamId !== activityStreamId) return;
      if (payload.system) return;
      const user = payload.user ?? "Viewer";
      const text = payload.text ?? "";
      if (!text) return;
      const id = payload.id ? `chat-${payload.id}` : `chat-${Date.now()}`;
      const nextItem: ActivityItem = {
        id,
        title: `${user} says`,
        description: String(text),
        kind: "stream",
        ts: Number(payload.ts ?? Date.now()),
      };
      setActivity((prev) => {
        if (prev.some((item) => item.id === nextItem.id)) return prev;
        return [nextItem, ...prev].slice(0, 12);
      });
    };

    socket.on("tip", onTip);
    socket.on("chat:message", onChat);

    return () => {
      socket.off("tip", onTip);
      socket.off("chat:message", onChat);
      try {
        socket.emit?.("leave", { room });
      } catch {}
    };
  }, [activityStreamId, currentUser]);

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

  const streamerAddress = stream?.streamer || stream?.id || streamId || "unknown";
  const streamerLabel = stream?.streamer || stream?.id || streamId || "creator";
  const streamerInitials = streamerLabel.slice(0, 2).toUpperCase() || "PS";
  const isLive = stream?.isLive ?? true;
  const viewerCount = stream?.viewerCount ?? 0;
  const tags = Array.isArray(stream?.tags) ? stream.tags : [];
  const followTarget = streamerLabel;
  const isOwner =
    !!authUser &&
    (authUser.username === followTarget ||
      authUser.address === followTarget ||
      authUser.id === followTarget);
  const fallbackPoster =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDiux0GO7MxQbxJ21SEoyp6z6VvJSxmNY60g-YK-BoJ4mYzHyuAfpDT3LhX_smt_Rddp6Uf2pDoYSi16COw16t1dXUOozZHnUVutpgChyuMpOiXj-GIAMPJMEkMldSxVCBe30rxMSsKHK2kSf3LHiRvy7Oa5IwkKCAHcJRi2TDE8r3bY8HYYficQy6qp4R9Ah6iDjVFewo0xxeBiJ7cVvCIwmYlFIjyDoKY0mrPf3Vp3xUZy4QUd5Ym0JYC_ue9Q1JvmLejy7lM2KU";
  const playbackSrc = isLive ? normalizePlaybackUrl(stream?.playbackUrl ?? stream?.videoUrl) : undefined;
  const screenSrc = isLive ? normalizePlaybackUrl(stream?.screenPlaybackUrl ?? stream?.screenUrl) : undefined;
  const cameraSrc = isLive ? normalizePlaybackUrl(stream?.cameraPlaybackUrl ?? stream?.cameraUrl) : undefined;
  const screenWebrtcSrc = isLive ? stream?.screenWebrtcPlaybackUrl : undefined;
  const cameraWebrtcSrc = isLive ? stream?.cameraWebrtcPlaybackUrl : undefined;
  const webrtcSrc = isLive ? stream?.webrtcPlaybackUrl : undefined;
  const showScreenWithPip = isLive && !!screenSrc && (!!cameraSrc || stream?.sourceMode === "screen");
  const mainSrc = screenSrc && stream?.sourceMode === "screen" ? screenSrc : (screenSrc || playbackSrc);
  const pipSrc = screenSrc && cameraSrc ? cameraSrc : undefined;
  const mainWebrtcSrc =
    (stream?.sourceMode === "screen" ? screenWebrtcSrc : cameraWebrtcSrc)
    || screenWebrtcSrc
    || cameraWebrtcSrc
    || webrtcSrc;
  const pipWebrtcSrc = screenWebrtcSrc && cameraWebrtcSrc ? cameraWebrtcSrc : undefined;
  const customerCode =
    stream?.cloudflareCustomerCode
    || extractCustomerCode(mainWebrtcSrc)
    || extractCustomerCode(screenSrc)
    || extractCustomerCode(cameraSrc)
    || extractCustomerCode(playbackSrc);
  const mainInputId =
    (stream?.sourceMode === "screen" ? stream?.cloudflareScreenInputId : stream?.cloudflareCameraInputId)
    || stream?.cloudflareScreenInputId
    || stream?.cloudflareCameraInputId
    || extractInputId(mainWebrtcSrc)
    || extractInputId(screenSrc)
    || extractInputId(cameraSrc)
    || extractInputId(playbackSrc);
  const pipInputId =
    stream?.cloudflareCameraInputId
    || extractInputId(pipWebrtcSrc)
    || extractInputId(cameraSrc);
  const posterSrc = stream?.thumbnail ?? fallbackPoster;

  function normalizePlaybackUrl(raw?: string) {
    if (!raw) return undefined;
    const trimmed = raw.trim().replace(/\?%22%22$/i, "").replace(/\?""$/i, "");
    if (!trimmed) return undefined;
    const base = hlsBaseUrl.replace(/\/+$/, "");
    const match = trimmed.match(/\/live\/([^/]+)\/index\.m3u8/i);
    if (base && match?.[1]) {
      const baseWithLive = /\/live$/i.test(base) ? base : `${base}/live`;
      return `${baseWithLive}/${match[1]}/index.m3u8`;
    }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && trimmed.startsWith("http://")) {
      return trimmed.replace(/^http:\/\//i, "https://");
    }
    return trimmed;
  }

  function extractCustomerCode(url?: string) {
    if (!url) return "";
    const match = url.match(/customer-([a-zA-Z0-9-]+)\.cloudflarestream\.com/);
    return match?.[1] || "";
  }

  function extractInputId(url?: string) {
    if (!url) return "";
    const match = url.match(/cloudflarestream\.com\/([^/]+)\//);
    return match?.[1] || "";
  }

  const focusChat = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("chat");
      setTimeout(() => {
        const el = document.getElementById(chatInputId) as HTMLInputElement | null;
        el?.focus();
      }, 60);
      return;
    }
    const el = document.getElementById(chatInputId) as HTMLInputElement | null;
    el?.focus();
  };

  const mintClip = () => {
    toast.info("Minting coming soon", "Clip minting is not enabled yet.", 2500);
  };

  useEffect(() => {
    if (!stream || !authUser || !followTarget || isOwner) {
      setFollowing(false);
      return;
    }
    let active = true;
    setFollowLoading(true);
    api
      .get(`/api/users/${encodeURIComponent(followTarget)}/following`)
      .then((res) => {
        if (!active) return;
        setFollowing(Boolean(res?.data?.following));
      })
      .catch(() => {
        if (active) setFollowing(false);
      })
      .finally(() => {
        if (active) setFollowLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authUser, followTarget, isOwner, stream]);

  if (!stream) {
    return (
      <div>
        <div className="glass-card">Loading stream...</div>
      </div>
    );
  }

  const toggleFollow = async () => {
    if (!authUser) {
      toast.info("Sign in required", "Please sign in to follow creators.", 2500);
      return;
    }
    if (isOwner || followLoading) return;
    const next = !following;
    setFollowing(next);
    setFollowLoading(true);
    try {
      await api.post(`/api/users/${encodeURIComponent(followTarget)}/follow`, {
        action: next ? "follow" : "unfollow",
      });
      toast.success(next ? "Followed" : "Unfollowed", undefined, 2000);
    } catch (err) {
      setFollowing(!next);
      toast.error("Action failed", undefined, 2500);
    } finally {
      setFollowLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return "Now";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Now";
    }
  };

  const activityMeta = (kind: ActivityItem["kind"]) => {
    switch (kind) {
      case "tip":
        return {
          label: "Tip",
          card: "border-primary/20 bg-primary/10",
          badge: "text-primary bg-primary/15 border-primary/30",
        };
      case "stream":
        return {
          label: "Stream",
          card: "border-emerald-400/20 bg-emerald-500/10",
          badge: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
        };
      default:
        return {
          label: "System",
          card: "border-white/10 bg-bg/70",
          badge: "text-subtle bg-white/5 border-white/10",
        };
    }
  };

  return (
    <>
      <div className="watch-page relative pb-[calc(env(safe-area-inset-bottom)+96px)] lg:pb-0">
        <div className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-primary/15 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[420px] w-[420px] rounded-full bg-accent/15 blur-[160px]" />

        <div
          className={`relative z-10 grid grid-cols-1 ${
            theaterMode ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_360px]"
          } gap-6`}
        >
          <section className="space-y-6">
            {usingMock && (
              <div className="glass-card p-3 text-sm text-yellow-300">
                Using mock stream data - backend returned no stream.
              </div>
            )}

            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-surface/60 shadow-[0_25px_60px_rgba(2,6,23,0.6)]">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-bg/60 to-accent/10" />
              <div className="relative">
                {(() => {
                  const preferIframe = true;
                  if (preferIframe && customerCode && mainInputId) {
                    return (
                      <CloudflareIframePlayer
                        customerCode={customerCode}
                        inputId={mainInputId}
                        title={stream.title ?? "Live"}
                        heightClass="aspect-video"
                        autoplay
                        muted
                        controls
                        preload="auto"
                      />
                    );
                  }
                  if (!mainSrc && mainWebrtcSrc) {
                    return (
                      <WebRTCPlayer
                        playbackUrl={mainWebrtcSrc}
                        title={stream.title ?? "Live"}
                        heightClass="aspect-video"
                        autoPlay
                        startMuted
                      />
                    );
                  }
                  return (
                    <Player
                      ref={playerRef}
                      src={mainSrc}
                      poster={posterSrc}
                      title={stream.title ?? "Live"}
                      heightClass="aspect-video"
                    />
                  );
                })()}
                {pipSrc ? (
                  <div className="absolute right-4 top-4 sm:right-6 sm:top-6 z-20">
                    <div className="relative w-28 sm:w-32 md:w-40 lg:w-56 rounded-2xl overflow-hidden border border-white/15 bg-bg/80 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                      {(() => {
                        const preferIframe = true;
                        if (preferIframe && customerCode && pipInputId) {
                          return (
                            <CloudflareIframePlayer
                              customerCode={customerCode}
                              inputId={pipInputId}
                              title={`${streamerLabel} camera`}
                              heightClass="aspect-video"
                              showBadge={false}
                              autoplay
                              muted
                              controls={false}
                              preload="auto"
                            />
                          );
                        }
                        if (!pipSrc && pipWebrtcSrc) {
                          return (
                            <WebRTCPlayer
                              playbackUrl={pipWebrtcSrc}
                              title={`${streamerLabel} camera`}
                              heightClass="aspect-video"
                              autoPlay
                              startMuted
                              showControls={false}
                            />
                          );
                        }
                        return (
                          <Player
                            src={pipSrc}
                            poster={posterSrc}
                            title={`${streamerLabel} camera`}
                            heightClass="aspect-video"
                            autoPlay
                            startMuted
                            showControls={false}
                          />
                        );
                      })()}
                      <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                        Creator cam
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-bg/90 via-bg/20 to-transparent" />
              </div>

              <div className="absolute inset-x-6 bottom-6 z-10 hidden lg:flex flex-col gap-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div
                        className="h-14 w-14 rounded-2xl p-[1px]"
                        style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
                      >
                        <div className="h-full w-full rounded-2xl bg-bg/80 flex items-center justify-center text-sm font-bold text-text">
                          {streamerInitials}
                        </div>
                      </div>
                      {isLive && (
                        <span className="absolute -bottom-2 -right-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
                          Live
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-semibold text-text">{stream.title ?? "Live stream"}</h2>
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                          Verified
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-subtle">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                          {viewerCount} viewers
                        </span>
                        <span>Live session</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isOwner && (
                      <button
                        onClick={toggleFollow}
                        className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
                        disabled={followLoading}
                      >
                        {followLoading ? "Loading..." : following ? "Following" : "Follow"}
                      </button>
                    )}
                    <button
                      onClick={focusChat}
                      className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setOpenTip(true)}
                      className="rounded-2xl bg-primary px-4 py-2 text-xs font-semibold text-bg shadow-lg shadow-primary/30 hover:brightness-110 transition"
                    >
                      Tip Streamer
                    </button>
                    <button
                      onClick={mintClip}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                    >
                      Mint Clip
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-bg/70 px-4 py-3">
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Low latency
                    </span>
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    <span>1080p 60fps</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTheaterMode((s) => !s)}
                      className={`rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                        theaterMode ? "bg-white/10 text-text" : "text-subtle hover:text-text"
                      }`}
                    >
                      {theaterMode ? "Exit Theater" : "Theater"}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await playerRef.current?.requestFullscreen?.();
                        } catch (err) {
                          toast.error("Fullscreen failed");
                        }
                      }}
                      className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-subtle hover:text-text transition"
                    >
                      Fullscreen
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card space-y-4 hidden lg:block">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-subtle">Stream brief</p>
                  <h2 className="mt-2 text-2xl font-semibold text-text">{stream.title ?? "Live stream"}</h2>
                  <p className="mt-2 text-sm text-subtle">
                    {stream.description ?? "Live on Petra Stream. Join the chat and support the creator."}
                  </p>
                </div>
                {isLive && (
                  <span className="rounded-full bg-rose-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200">
                    Live now
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {tags.length ? (
                  tags.slice(0, 6).map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-subtle">
                      #{t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-subtle">No tags yet</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  {viewerCount} viewers
                </span>
                <span className="font-mono">Streamer: {streamerLabel}</span>
              </div>

              <div className="flex flex-wrap gap-2 lg:hidden">
                {!isOwner && (
                  <button
                    onClick={toggleFollow}
                    className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
                    disabled={followLoading}
                  >
                    {followLoading ? "Loading..." : following ? "Following" : "Follow"}
                  </button>
                )}
                <button
                  onClick={focusChat}
                  className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
                >
                  Chat
                </button>
                <button
                  onClick={() => setOpenTip(true)}
                  className="rounded-2xl bg-primary px-4 py-2 text-xs font-semibold text-bg shadow-lg shadow-primary/30 hover:brightness-110 transition"
                >
                  Tip Streamer
                </button>
                <button
                  onClick={mintClip}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  Mint Clip
                </button>
                <button
                  onClick={() => setTheaterMode((s) => !s)}
                  className={`rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    theaterMode ? "bg-white/10 text-text" : "text-subtle hover:text-text"
                  }`}
                >
                  {theaterMode ? "Exit Theater" : "Theater"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await playerRef.current?.requestFullscreen?.();
                    } catch (err) {
                      toast.error("Fullscreen failed");
                    }
                  }}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-subtle hover:text-text transition"
                >
                  Fullscreen
                </button>
              </div>
            </div>

            <section className="hidden lg:block">
              <h3 className="font-semibold mb-2 text-text">Related Streams</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {related.length ? (
                  related.map((r) => <StreamCard key={r.streamer || r.id} stream={r as any} />)
                ) : (
                  <div className="muted">No related streams found.</div>
                )}
              </div>
            </section>

            <section className="lg:hidden space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-surface/70 p-5 shadow-[0_20px_40px_rgba(2,6,23,0.5)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-subtle">Stream brief</p>
                    <h2 className="mt-2 text-2xl font-semibold text-text">{stream.title ?? "Live stream"}</h2>
                    <p className="mt-2 text-sm text-subtle">
                      {stream.description ?? "Live on Petra Stream. Join the chat and support the creator."}
                    </p>
                  </div>
                  {isLive && (
                    <span className="rounded-full bg-rose-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200">
                      Live now
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {tags.length ? (
                    tags.slice(0, 6).map((t) => (
                      <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-subtle">
                        #{t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-subtle">No tags yet</span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-subtle">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    {viewerCount} viewers
                  </span>
                  <span className="font-mono">Streamer: {streamerLabel}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isOwner && (
                    <button
                      onClick={toggleFollow}
                      className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
                      disabled={followLoading}
                    >
                      {followLoading ? "Loading..." : following ? "Following" : "Follow"}
                    </button>
                  )}
                  <button
                    onClick={focusChat}
                    className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setOpenTip(true)}
                    className="rounded-2xl bg-primary px-4 py-2 text-xs font-semibold text-bg shadow-lg shadow-primary/30 hover:brightness-110 transition"
                  >
                    Tip Streamer
                  </button>
                  <button
                    onClick={mintClip}
                    className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                  >
                    Mint Clip
                  </button>
                </div>
              </div>

              {mobileTab === "chat" && (
                <div className="rounded-[28px] border border-white/10 bg-surface/70 p-4 flex flex-col min-h-0">
                  <div className="flex-1 min-h-0">
                    <ChatPanel
                      streamId={String(streamId)}
                      inputId={chatInputId}
                      currentUser={currentUser}
                      variant="viewer"
                      pinnedNotice="Be kind. Respect the community and support the creator."
                      emotes={defaultEmotes}
                      slowModeMs={1500}
                    />
                  </div>
                </div>
              )}

              {mobileTab === "activity" && (
                <div className="rounded-[28px] border border-white/10 bg-surface/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-text">Live Activity</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">On-chain indexer</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activityLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-bg/70 p-4 text-xs text-subtle">
                        Loading activity...
                      </div>
                    ) : activity.length ? (
                      activity.map((item) => {
                        const meta = activityMeta(item.kind);
                        return (
                          <div key={item.id} className={`rounded-2xl border p-4 ${meta.card}`}>
                            <div className="flex items-center justify-between text-xs text-subtle">
                              <span className="font-semibold text-text">{item.title}</span>
                              <span>{formatTime(item.ts)}</span>
                            </div>
                            {item.description && (
                              <p className="mt-2 text-sm text-subtle">{item.description}</p>
                            )}
                            <span
                              className={`mt-3 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-bg/70 p-4 text-xs text-subtle">
                        No activity yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mobileTab === "support" && (
                <div className="rounded-[28px] border border-white/10 bg-surface/70 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-text">Supporters</h4>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">On-chain</span>
                  </div>
                  <ViewerList streamId={String(streamId)} />
                </div>
              )}

              {mobileTab === "stream" && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-text">Related Streams</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {related.length ? (
                      related.map((r) => <StreamCard key={r.streamer || r.id} stream={r as any} />)
                    ) : (
                      <div className="muted">No related streams found.</div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </section>

          {!theaterMode && (
            <aside className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-surface/70 p-5 shadow-[0_20px_40px_rgba(2,6,23,0.5)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text">Live Activity</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">On-chain indexer</p>
                  </div>
                  <button className="rounded-full border border-white/10 p-2 text-subtle hover:text-text transition">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {activityLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-bg/70 p-4 text-xs text-subtle">
                      Loading activity...
                    </div>
                  ) : activity.length ? (
                    activity.map((item) => {
                      const meta = activityMeta(item.kind);
                      return (
                        <div key={item.id} className={`rounded-2xl border p-4 ${meta.card}`}>
                          <div className="flex items-center justify-between text-xs text-subtle">
                            <span className="font-semibold text-text">{item.title}</span>
                            <span>{formatTime(item.ts)}</span>
                          </div>
                          {item.description && (
                            <p className="mt-2 text-sm text-subtle">{item.description}</p>
                          )}
                          <span
                            className={`mt-3 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-bg/70 p-4 text-xs text-subtle">
                      No activity yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-surface/70 p-4 flex flex-col min-h-0">
                <div className="flex-1 min-h-0">
                  <ChatPanel
                    streamId={String(streamId)}
                    inputId={chatInputId}
                    currentUser={currentUser}
                    variant="viewer"
                    pinnedNotice="Be kind. Respect the community and support the creator."
                    emotes={defaultEmotes}
                    slowModeMs={1500}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-surface/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text">Supporters</h4>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">On-chain</span>
                </div>
                <ViewerList streamId={String(streamId)} />
              </div>
            </aside>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="rounded-2xl border border-white/10 bg-bg/90 backdrop-blur-xl shadow-[0_16px_40px_rgba(2,6,23,0.55)]">
            <div className="grid grid-cols-4">
              {[
                { key: "stream", label: "Home" },
                { key: "chat", label: "Chat" },
                { key: "activity", label: "Activity" },
                { key: "support", label: "Support" },
              ].map((tab) => {
                const active = mobileTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setMobileTab(tab.key as typeof mobileTab)}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                      active ? "text-primary" : "text-subtle"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        active ? "bg-primary shadow-[0_0_12px_rgba(124,255,109,0.7)]" : "bg-white/10"
                      }`}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
