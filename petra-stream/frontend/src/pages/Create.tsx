
// src/pages/Create.tsx
import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import StreamKeyPanel from "../components/StreamKeyPanel";
import { useToast } from "../contexts/ToastContext";
import Player from "../components/Player";
import LocalRecorder from "../components/LocalRecorder";
import SignInModal from "../components/SignInModal";
import { getAuthToken } from "../lib/auth";

export default function CreatePage(): JSX.Element {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [autoPlayback, setAutoPlayback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingPlayback, setCheckingPlayback] = useState(false);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [showPublisher, setShowPublisher] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [tokenGated, setTokenGated] = useState(true);
  const [royaltyPct, setRoyaltyPct] = useState(8);
  const [lastPlaybackCheck, setLastPlaybackCheck] = useState<{
    ok: boolean;
    status?: number;
    reason?: string;
    at: string;
  } | null>(null);
  const [stats, setStats] = useState<{ viewers: number; tips: number; uptimeSec: number }>({
    viewers: 0,
    tips: 0,
    uptimeSec: 0,
  });

  const ingestUrl = import.meta.env.VITE_INGEST_URL || "";
  const hlsBaseUrl = import.meta.env.VITE_HLS_BASE_URL || "";
  const webrtcBaseUrl = import.meta.env.VITE_WEBRTC_PUBLISH_URL || "";
  const uptimeTimer = useRef<number | null>(null);

  useEffect(() => {
    // Load existing stream state if present
    (async () => {
      try {
        if (!getAuthToken()) return;
        const res = await api.get("/api/streams/me").catch(() => null);
        if (res?.data) {
          setTitle(res.data.title ?? "");
          setDescription(res.data.description ?? "");
          setStreamKey(res.data.streamKey ?? null);
          const status = String(res.data.status ?? "");
          setIsLive(status === "online");
          setPlaybackUrl(res.data.playbackUrl ?? "");
          setIsPrepared(!!res.data.streamKey || !!res.data.title || !!res.data.playbackUrl);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      if (uptimeTimer.current) window.clearInterval(uptimeTimer.current);
    };
  }, []);

  function requireAuth(nextMode: "login" | "register" = "login") {
    if (getAuthToken()) return true;
    toast.info("Sign in required", "Create an account or sign in to go live.", 2600);
    setAuthMode(nextMode);
    return false;
  }
  useEffect(() => {
    if (!autoPlayback) return;
    if (streamKey && hlsBaseUrl) {
      const base = hlsBaseUrl.endsWith("/") ? hlsBaseUrl.slice(0, -1) : hlsBaseUrl;
      setPlaybackUrl(`${base}/${streamKey}/index.m3u8`);
    }
  }, [streamKey, hlsBaseUrl, autoPlayback]);

  useEffect(() => {
    // simple uptime increment while live
    if (isLive) {
      uptimeTimer.current = window.setInterval(() => {
        setStats((s) => ({ ...s, uptimeSec: s.uptimeSec + 1 }));
      }, 1000) as unknown as number;
    } else {
      if (uptimeTimer.current) {
        window.clearInterval(uptimeTimer.current);
        uptimeTimer.current = null;
      }
    }
    return () => {
      if (uptimeTimer.current) window.clearInterval(uptimeTimer.current);
    };
  }, [isLive]);

  function handleAuthFailure() {
    toast.info("Session expired", "Please sign in again to go live.", 3000);
    setAuthMode("login");
  }

  async function ensureStreamKey(): Promise<string | null> {
    if (streamKey) return streamKey;
    if (!requireAuth()) return null;
    try {
      const res = await api.post("/api/streams/generate-key");
      const key = res?.data?.key;
      if (!key) {
        toast.error("Stream key unavailable", "Please try again.");
        return null;
      }
      setStreamKey(key);
      return key;
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return null;
      }
      toast.error("Stream key unavailable", "Please sign in and try again.");
      return null;
    }
  }

  async function checkPlaybackUrl(silent = false, overrideUrl?: string) {
    const url = (overrideUrl ?? playbackUrl).trim();
    if (!url) {
      if (!silent) toast.error("Playback URL required", "Set a playback URL first");
      return false;
    }
    if (!silent) setCheckingPlayback(true);
    try {
      const res = await api.post("/api/streams/playback/check", { playbackUrl: url }).catch(() => null);
      if (res?.data?.ok) {
        if (!silent) toast.success("Playback ready", `HTTP ${res.data.status}`);
        setLastPlaybackCheck({ ok: true, status: res.data.status, at: new Date().toISOString() });
        return true;
      }
      setLastPlaybackCheck({
        ok: false,
        status: res?.data?.status,
        reason: res?.data?.reason || "No response",
        at: new Date().toISOString(),
      });
      if (!silent) toast.error("Playback not ready", res?.data?.reason || "No response");
      return false;
    } catch (err) {
      console.error(err);
      setLastPlaybackCheck({
        ok: false,
        reason: (err as any)?.message || "fetch_failed",
        at: new Date().toISOString(),
      });
      if (!silent) toast.error("Playback check failed");
      return false;
    } finally {
      if (!silent) setCheckingPlayback(false);
    }
  }
  function normalizeBaseUrl(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  function buildWebrtcPublishUrl(key: string | null) {
    if (!key) return "";
    const base = normalizeBaseUrl(webrtcBaseUrl);
    if (!base) return "";
    try {
      const url = new URL(base);
      const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
      url.pathname = `${basePath}/${key}/publish`;

      const params = url.searchParams;
      if (!params.has("video-codec")) params.set("video-codec", "h264/90000");
      if (!params.has("audio-codec")) params.set("audio-codec", "opus/48000");
      if (!params.has("video-bitrate")) params.set("video-bitrate", "800");
      if (!params.has("audio-bitrate")) params.set("audio-bitrate", "48");
      if (!params.has("video-framerate")) params.set("video-framerate", "15");
      if (!params.has("video-width")) params.set("video-width", "640");
      if (!params.has("video-height")) params.set("video-height", "360");
      if (!params.has("audio-voice")) params.set("audio-voice", "true");

      return url.toString();
    } catch {
      return "";
    }
  }

  async function startStream(): Promise<boolean> {
    if (!requireAuth()) return false;
    setLoading(true);
    try {
      const key = await ensureStreamKey();
      if (!key) return false;
      const finalTitle = title.trim() || "Live Stream";
      if (!title.trim()) setTitle(finalTitle);
      const base = hlsBaseUrl.endsWith("/") ? hlsBaseUrl.slice(0, -1) : hlsBaseUrl;
      const derivedPlaybackUrl = autoPlayback && base && key ? `${base}/${key}/index.m3u8` : playbackUrl.trim();
      if (derivedPlaybackUrl) setPlaybackUrl(derivedPlaybackUrl);
      const payload = { title: finalTitle, description: description.trim(), key, playbackUrl: derivedPlaybackUrl };
      const res = await api.post("/api/streams/start", payload);
      if (res?.data?.ok ?? true) {
        toast.success("Stream ready", "Go live in browser or OBS.", 2500);
      } else {
        toast.success("Stream prepared", "Stream details saved.", 2000);
      }
      setIsPrepared(true);
      const ok = await checkPlaybackUrl(true, derivedPlaybackUrl);
      setIsLive(ok);
      return true;
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return false;
      }
      console.error(err);
      toast.error("Failed to prepare stream");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function stopStream() {
    if (!requireAuth()) return;
    setLoading(true);
    try {
      await api.post("/api/streams/stop");
      setIsLive(false);
      setIsPrepared(true);
      toast.info("Stream offline", "You can go live again with the same key.", 2200);
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      console.error(err);
      toast.error("Failed to stop stream");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateKey() {
    if (!requireAuth()) return;
    setLoading(true);
    try {
      const res = await api.post("/api/streams/regenerate-key");
      const key = res?.data?.key;
      if (!key) {
        toast.error("Failed to regenerate key", "Please try again.");
        return;
      }
      setStreamKey(key);
      setIsPrepared(true);
      toast.success("Stream key regenerated", undefined, 2000);
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      console.error(err);
      toast.error("Failed to regenerate key");
    } finally {
      setLoading(false);
    }
  }

  async function testPlayback() {
    const ok = await checkPlaybackUrl(false);
    if (ok) setIsLive(true);
  }

  async function goLiveInBrowser() {
    if (!requireAuth()) return;
    if (!isPrepared) {
      const ok = await startStream();
      if (!ok) return;
    }
    const key = await ensureStreamKey();
    if (!key) return;
    const publishUrl = buildWebrtcPublishUrl(key);
    if (!publishUrl) {
      toast.error("WebRTC publish URL not configured", "Set VITE_WEBRTC_PUBLISH_URL or VITE_HLS_BASE_URL");
      return;
    }
    setShowPublisher(true);
    toast.info("Browser studio ready", "Allow camera and mic to go live.", 2200);
  }

  async function copyText(label: string, value?: string) {
    if (!value) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied", label, 1800);
    } catch (err) {
      console.error(err);
      toast.error("Copy failed");
    }
  }
  const ingestServer = ingestUrl || "rtmp://165.227.224.72/live";
  const statusLabel = isLive ? "Live" : isPrepared ? "Waiting for live" : "Draft";
  const previewSrc = playbackUrl || undefined;
  const webrtcPublishUrl = buildWebrtcPublishUrl(streamKey);
  const supportsBrowserStudio = Boolean(normalizeBaseUrl(webrtcBaseUrl));
  const isAuthed = Boolean(getAuthToken());
  const readinessLabel = isLive ? "Live to viewers" : isPrepared ? "Waiting for video" : "Not started";
  const statusTone = isLive
    ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/30"
    : isPrepared
      ? "bg-amber-400/10 text-amber-200 border-amber-400/30"
      : "bg-white/5 text-white/70 border-white/10";
  const primaryCtaLabel = isLive
    ? "End broadcast"
    : supportsBrowserStudio
      ? "Start broadcast"
      : "Prepare broadcast";
  const primaryCtaAction = isLive ? stopStream : supportsBrowserStudio ? goLiveInBrowser : startStream;
  const broadcastLabel = isLive ? "Broadcast live" : isPrepared ? "Broadcast ready" : "Broadcast idle";

  useEffect(() => {
    if (!isPrepared || !playbackUrl || isLive) return;
    const timer = window.setInterval(async () => {
      const ok = await checkPlaybackUrl(true);
      if (ok) {
        setIsLive(true);
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isPrepared, playbackUrl, isLive]);

  return (
    <div className="relative overflow-hidden create-page">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "rgb(var(--color-bg-rgb))",
            backgroundImage:
              "radial-gradient(at 0% 0%, rgba(0, 163, 255, 0.25) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(124, 255, 109, 0.18) 0px, transparent 55%), radial-gradient(at 50% 50%, rgba(0, 163, 255, 0.12) 0px, transparent 60%)",
          }}
        />
        <div className="absolute top-1/4 -left-64 h-[800px] w-[800px] rounded-full bg-primary/5 blur-[180px]" />
        <div className="absolute bottom-0 -right-64 h-[900px] w-[900px] rounded-full bg-accent/5 blur-[200px]" />
      </div>

      <div className="max-w-[1700px] mx-auto px-6 lg:px-10 py-12 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-10">
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-primary/50" />
                <p className="text-primary font-bold tracking-[0.3em] uppercase text-[10px]">
                  Production Interface
                </p>
              </div>
              <h2 className="text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight text-text leading-[1.1]">
                Go live in
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                  one click.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-subtle max-w-xl leading-relaxed font-medium">
                Unified creator environment for high fidelity broadcasting. Professional encoding meets decentralized
                distribution.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-3 py-1.5 rounded-full border ${statusTone}`}>Status: {statusLabel}</span>
                <span className="px-3 py-1.5 rounded-full border border-white/10 text-white/70">
                  {readinessLabel}
                </span>
                {supportsBrowserStudio ? (
                  <span className="px-3 py-1.5 rounded-full border border-white/10 text-white/70">
                    Browser studio ready
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full border border-rose-500/30 text-rose-200/80">
                    Browser studio disabled
                  </span>
                )}
              </div>
              {!supportsBrowserStudio ? (
                <div className="text-xs text-amber-200/80">
                  Browser streaming is disabled. Set VITE_WEBRTC_PUBLISH_URL to enable in-browser streaming.
                </div>
              ) : null}
            </section>

            <section className="relative">
              <div className="absolute -inset-1.5 rounded-[2.5rem] bg-gradient-to-r from-primary/30 to-accent/30 blur-2xl opacity-40" />
              <div className="relative glass-card rounded-[2.5rem] p-3">
                <div className="relative rounded-[2rem] overflow-hidden bg-bg/70">
                  <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-bg/20 pointer-events-none" />
                  <Player heightClass="aspect-video" title={title || "Broadcast preview"} src={previewSrc} autoPlay startMuted />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-bg/60 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-text">
                    {broadcastLabel}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-white/50 px-2">
                <span>Live preview</span>
                <button
                  type="button"
                  onClick={testPlayback}
                  className="px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
                  disabled={checkingPlayback}
                >
                  {checkingPlayback ? "Checking" : "Refresh status"}
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-2">
              <div className="space-y-1">
                <p className="text-white/40 text-[9px] uppercase font-bold tracking-[0.2em]">Bitrate output</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono tracking-tight">9,420</span>
                  <span className="text-primary/60 text-xs font-bold uppercase">Kbps</span>
                </div>
              </div>
              <div className="space-y-1 border-l border-white/10 pl-4">
                <p className="text-white/40 text-[9px] uppercase font-bold tracking-[0.2em]">Stream latency</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono tracking-tight">0.8</span>
                  <span className="text-primary/60 text-xs font-bold uppercase">Sec</span>
                </div>
              </div>
              <div className="space-y-1 border-l border-white/10 pl-4">
                <p className="text-white/40 text-[9px] uppercase font-bold tracking-[0.2em]">Security protocol</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold font-mono tracking-widest text-emerald-400 uppercase">
                    Encrypted
                  </span>
                </div>
              </div>
            </div>

            <section className="glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Live Studio</h3>
                  <p className="muted text-sm mt-1">Broadcast directly from your browser without leaving the site.</p>
                </div>
                {supportsBrowserStudio ? (
                  <button
                    className="px-3 py-2 rounded-full border border-white/10 text-xs"
                    onClick={() => setShowPublisher((s) => !s)}
                    disabled={!webrtcPublishUrl}
                  >
                    {showPublisher ? "Hide studio" : "Show studio"}
                  </button>
                ) : null}
              </div>
              {supportsBrowserStudio ? (
                showPublisher ? (
                  <div className="rounded-2xl overflow-hidden border border-white/10">
                    <iframe
                      title="Broadcast studio"
                      src={webrtcPublishUrl}
                      className="w-full h-[520px] bg-black"
                      allow="camera; microphone; autoplay; clipboard-write; display-capture"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/70">
                    Click "Start broadcast" to open the in-browser studio and go live.
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-400/30 p-6 text-center text-sm text-amber-200/80">
                  Browser studio is disabled. Enable WebRTC and set VITE_WEBRTC_PUBLISH_URL.
                </div>
              )}
            </section>
          </div>
          <div className="lg:col-span-5">
            <div className="glass-card p-8 lg:p-10 rounded-[2.5rem] sticky top-28 max-h-[calc(100vh-180px)] overflow-y-auto">
              <div className="mb-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-text flex items-center gap-3">
                    <span className="text-primary">Stream Details</span>
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/40 tracking-widest uppercase">
                    Autosave on
                  </span>
                </div>
                <p className="text-white/40 text-sm font-medium">
                  Configure your on-chain broadcast identity.
                </p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                    Broadcast title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-2xl h-14 px-6 text-text font-semibold placeholder:text-white/20 text-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="A cinematic title..."
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                    Broadcast description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-2xl p-5 text-text font-medium placeholder:text-white/20 min-h-[140px] resize-none leading-relaxed bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Tell your audience what is happening..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                      Category
                    </label>
                    <div className="relative">
                      <select className="w-full rounded-2xl h-12 px-5 appearance-none text-text font-semibold text-sm tracking-wide bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40">
                        <option>Crypto Gaming</option>
                        <option>Metaverse Explorers</option>
                        <option>DAO Governance</option>
                        <option>Creative Arts</option>
                      </select>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                        v
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                      Tags
                    </label>
                    <input
                      className="w-full rounded-2xl h-12 px-5 text-text font-semibold text-sm bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="#web3 #live #nft"
                    />
                  </div>
                </div>
              </div>

              <section className="mt-10">
                <h4 className="text-xs font-black text-primary uppercase tracking-[0.25em] mb-4">Session</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-2xl font-bold text-text">{stats.viewers}</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Viewers</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-2xl font-bold text-text">{stats.tips}</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Tips</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-2xl font-bold text-text">{Math.floor(stats.uptimeSec / 60)}m</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Uptime</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => copyText("Playback URL", playbackUrl)}
                    className="px-3 py-2 rounded-full border border-white/10 text-xs"
                    disabled={!playbackUrl}
                  >
                    Copy playback link
                  </button>
                  <button
                    onClick={() => copyText("RTMP server URL", ingestServer)}
                    className="px-3 py-2 rounded-full border border-white/10 text-xs"
                  >
                    Copy RTMP info
                  </button>
                </div>
              </section>

              <section className="mt-10 space-y-6">
                <h4 className="text-xs font-black text-primary uppercase tracking-[0.25em]">Web3 Monetization</h4>
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <h5 className="text-sm font-bold text-text">Token-Gating</h5>
                      <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                        Restrict to verified NFT holders
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={tokenGated}
                        onChange={(e) => setTokenGated(e.target.checked)}
                      />
                      <div className="relative h-7 w-14 rounded-full border border-white/10 bg-white/10 transition peer-checked:bg-primary/80 peer-checked:border-primary/60 after:absolute after:left-[4px] after:top-[4px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-7" />
                    </label>
                  </div>

                  <div className="space-y-4 px-1">
                    <div className="flex items-center justify-between">
                      <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Creator Royalties
                      </label>
                      <span className="text-primary font-mono font-black text-xl">{royaltyPct.toFixed(1)}%</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${(royaltyPct / 15) * 100}%` }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={15}
                        step={0.5}
                        value={royaltyPct}
                        onChange={(e) => setRoyaltyPct(Number(e.target.value))}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-white/30 font-bold uppercase tracking-widest">
                      <span>Min 0%</span>
                      <span>Max 15%</span>
                    </div>
                  </div>
                </div>
              </section>

              <details className="mt-10 border-t border-white/10 pt-8">
                <summary className="cursor-pointer text-sm font-semibold text-text">
                  Advanced settings
                </summary>
                <div className="mt-6 space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs subtle">Playback URL (HLS)</label>
                      <button
                        type="button"
                        onClick={() => setAutoPlayback((s) => !s)}
                        className="text-xs px-2 py-1 rounded-md border border-white/10"
                      >
                        {autoPlayback ? "Use custom URL" : "Use auto URL"}
                      </button>
                    </div>
                    <input
                      value={playbackUrl}
                      onChange={(e) => setPlaybackUrl(e.target.value)}
                      className="w-full p-3 mt-2 rounded-xl border border-white/10 bg-white/5 text-text"
                      placeholder={autoPlayback ? "Auto-generated from your stream key" : "https://your-cdn/stream.m3u8"}
                      disabled={autoPlayback}
                    />
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={testPlayback}
                        className="px-3 py-2 rounded-md border border-white/10 text-xs"
                        disabled={checkingPlayback}
                      >
                        {checkingPlayback ? "Checking..." : "Test playback"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 p-4 bg-white/5">
                    <div className="text-xs subtle">OBS / External encoder</div>
                    <div className="mt-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-subtle">Server</span>
                        <span className="font-mono text-text">{ingestServer}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="text-subtle">Stream key</span>
                        <span className="font-mono text-text">{streamKey || "generate to see"}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs subtle">
                      Use OBS if you need advanced scenes, overlays, or desktop capture.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText("RTMP server URL", ingestServer)}
                        className="px-3 py-2 rounded-md border border-white/10 text-xs"
                      >
                        Copy RTMP server
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText("Stream key", streamKey ?? "")}
                        className="px-3 py-2 rounded-md border border-white/10 text-xs"
                        disabled={!streamKey}
                      >
                        Copy stream key
                      </button>
                    </div>
                  </div>

                  <StreamKeyPanel streamKey={streamKey} onRegenerate={regenerateKey} />
                  <LocalRecorder />

                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold">Diagnostics</h3>
                    <p className="muted text-xs mt-1">Use this to verify stream URLs and auth status.</p>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="subtle">Auth</span>
                        <span className="text-text">{isAuthed ? "Signed in" : "Signed out"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="subtle">Studio URL</span>
                        <span className="font-mono text-[10px] text-text">{webrtcPublishUrl || "not-set"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="subtle">Playback URL</span>
                        <span className="font-mono text-[10px] text-text">{playbackUrl || "not-set"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="subtle">Last check</span>
                        <span className="text-text">
                          {lastPlaybackCheck
                            ? `${lastPlaybackCheck.ok ? "OK" : "Fail"}${lastPlaybackCheck.status ? ` (${lastPlaybackCheck.status})` : ""}`
                            : "not-run"}
                        </span>
                      </div>
                    </div>
                    {lastPlaybackCheck?.reason ? (
                      <div className="mt-2 text-[11px] text-amber-200/80">Reason: {lastPlaybackCheck.reason}</div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={testPlayback}
                        className="px-3 py-2 rounded-md border border-white/10 text-xs"
                        disabled={checkingPlayback}
                      >
                        {checkingPlayback ? "Checking..." : "Check playback"}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText("Playback URL", playbackUrl)}
                        className="px-3 py-2 rounded-md border border-white/10 text-xs"
                        disabled={!playbackUrl}
                      >
                        Copy HLS URL
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText("Studio URL", webrtcPublishUrl)}
                        className="px-3 py-2 rounded-md border border-white/10 text-xs"
                        disabled={!webrtcPublishUrl}
                      >
                        Copy studio URL
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              <div className="pt-8">
                <button
                  onClick={primaryCtaAction}
                  disabled={loading}
                  className="w-full h-16 bg-primary text-bg font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-glow-primary flex items-center justify-center gap-3"
                >
                  {loading ? "Working..." : primaryCtaLabel}
                </button>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-emerald-400 text-xs">*</span>
                  <p className="text-white/30 text-[9px] uppercase font-bold tracking-[0.2em]">
                    Secured by on-chain multisig
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {authMode && (
          <SignInModal
            defaultMode={authMode}
            onClose={() => setAuthMode(null)}
            onSignedIn={() => setAuthMode(null)}
          />
        )}
      </div>
    </div>
  );
}
