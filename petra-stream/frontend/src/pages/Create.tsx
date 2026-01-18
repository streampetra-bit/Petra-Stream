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
    // Example: if API returns a saved / draft stream object, you can fetch it here.
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
      } catch (err) {
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
    } catch (err) {
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
      // ask backend to create/start stream session
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
      // optionally reset stats
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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B1C2B] via-[#0A1320] to-[#0B1B2A]">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,229,168,0.35),rgba(0,229,168,0))] blur-2xl" />
        <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(126,90,255,0.35),rgba(126,90,255,0))] blur-2xl" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.25em] text-white/60">Creator Studio</div>
              <h1 className="mt-3 text-3xl md:text-4xl font-extrabold text-white">Go live in one click.</h1>
              <p className="muted mt-3 text-sm md:text-base">
                Start broadcasting from your camera and mic inside Petra Stream. We handle stream keys, playback URLs, and live status in the background.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-3 py-1.5 rounded-full border ${statusTone}`}>Status: {statusLabel}</span>
                <span className="px-3 py-1.5 rounded-full border border-white/10 text-white/70">{readinessLabel}</span>
                {supportsBrowserStudio ? (
                  <span className="px-3 py-1.5 rounded-full border border-white/10 text-white/70">Browser studio ready</span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full border border-rose-500/30 text-rose-200/80">Browser studio disabled</span>
                )}
              </div>
              {!supportsBrowserStudio ? (
                <div className="mt-3 text-xs text-amber-200/80">
                  Browser streaming is disabled. Set `VITE_WEBRTC_PUBLISH_URL` to enable in-browser streaming.
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button
                onClick={isLive ? stopStream : goLiveInBrowser}
                disabled={loading || !supportsBrowserStudio}
                className="btn-primary px-6 py-3 rounded-xl"
              >
                {loading ? "Working..." : isLive ? "End live" : "Go Live"}
              </button>
              {supportsBrowserStudio ? (
                <button
                  onClick={() => setShowPublisher((s) => !s)}
                  className="px-4 py-2 rounded-xl border text-sm"
                  disabled={!webrtcPublishUrl}
                >
                  {showPublisher ? "Hide studio" : "Show studio"}
                </button>
              ) : null}
              <div className="text-xs text-white/60">
                {supportsBrowserStudio ? "Allow camera and mic when prompted." : "Enable WebRTC to stream inside the site."}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Live Studio</h2>
                <p className="muted text-sm mt-1">Broadcast directly from your browser without leaving the site.</p>
              </div>
              {supportsBrowserStudio ? (
                <button
                  className="px-3 py-2 rounded-md border text-xs"
                  onClick={() => setShowPublisher((s) => !s)}
                  disabled={!webrtcPublishUrl}
                >
                  {showPublisher ? "Hide studio" : "Show studio"}
                </button>
              ) : null}
            </div>
            {supportsBrowserStudio ? (
              showPublisher ? (
                <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
                  <iframe
                    title="Broadcast studio"
                    src={webrtcPublishUrl}
                    className="w-full h-[520px] bg-black"
                    allow="camera; microphone; autoplay; clipboard-write; display-capture"
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/70">
                  Click "Go Live" to open the in-browser studio and start streaming.
                </div>
              )
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-amber-400/30 p-6 text-center text-sm text-amber-200/80">
                Browser studio is disabled. Enable WebRTC on MediaMTX and set `VITE_WEBRTC_PUBLISH_URL`.
              </div>
            )}
          </section>

          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Live Preview</h2>
                <p className="muted text-sm mt-1">This appears for viewers when your stream is live.</p>
              </div>
              <button
                type="button"
                onClick={testPlayback}
                className="px-3 py-2 rounded-md border text-xs"
                disabled={checkingPlayback}
              >
                {checkingPlayback ? "Checking..." : "Refresh status"}
              </button>
            </div>
            <div className="mt-4">
              <Player
                heightClass="aspect-video"
                title={title || "Live preview"}
                src={previewSrc}
                autoPlay
                startMuted
              />
            </div>
            {!isLive ? (
              <div className="mt-3 text-xs subtle">
                Waiting for live video. Once your broadcast starts, this preview updates automatically.
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="glass-card p-5">
            <h2 className="text-lg font-semibold">Stream Details</h2>
            <p className="muted text-sm mt-1">Set the title and description viewers will see.</p>
            <label className="text-xs subtle mt-4">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 mt-2 rounded-xl border bg-bg/10 text-text"
              placeholder="Enter a clear stream title"
            />

            <label className="text-xs subtle mt-4">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 mt-2 rounded-xl border bg-bg/10 text-text"
              rows={4}
              placeholder="Let viewers know what you are streaming"
            />
            <div className="mt-3 text-xs subtle">Details save automatically when you go live.</div>
          </section>

          <section className="glass-card p-5">
            <h2 className="text-lg font-semibold">Session</h2>
            <p className="muted text-sm mt-1">Live stats update as viewers join.</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="p-3 rounded bg-bg/10 text-text text-center">
                <div className="text-2xl font-bold">{stats.viewers}</div>
                <div className="text-xs subtle">Viewers</div>
              </div>
              <div className="p-3 rounded bg-bg/10 text-text text-center">
                <div className="text-2xl font-bold">{stats.tips}</div>
                <div className="text-xs subtle">Tips</div>
              </div>
              <div className="p-3 rounded bg-bg/10 text-text text-center">
                <div className="text-2xl font-bold">{Math.floor(stats.uptimeSec / 60)}m</div>
                <div className="text-xs subtle">Uptime</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => copyText("Playback URL", playbackUrl)}
                className="px-3 py-2 rounded-md border text-xs"
                disabled={!playbackUrl}
              >
                Copy playback link
              </button>
              <button
                onClick={() => copyText("RTMP server URL", ingestServer)}
                className="px-3 py-2 rounded-md border text-xs"
              >
                Copy RTMP info
              </button>
            </div>
          </section>
        </div>
      </div>

      <details className="glass-card p-5">
        <summary className="cursor-pointer text-sm font-semibold">Advanced settings</summary>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs subtle">Playback URL (HLS)</label>
                <button
                  type="button"
                  onClick={() => setAutoPlayback((s) => !s)}
                  className="text-xs px-2 py-1 rounded-md border"
                >
                  {autoPlayback ? "Use custom URL" : "Use auto URL"}
                </button>
              </div>
              <input
                value={playbackUrl}
                onChange={(e) => setPlaybackUrl(e.target.value)}
                className="w-full p-3 mt-2 rounded border bg-bg/10 text-text"
                placeholder={autoPlayback ? "Auto-generated from your stream key" : "https://your-cdn/stream.m3u8"}
                disabled={autoPlayback}
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={testPlayback}
                  className="px-3 py-2 rounded-md border text-xs"
                  disabled={checkingPlayback}
                >
                  {checkingPlayback ? "Checking..." : "Test playback"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 p-4 bg-bg/10">
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
                  className="px-3 py-2 rounded-md border text-xs"
                >
                  Copy RTMP server
                </button>
                <button
                  type="button"
                  onClick={() => copyText("Stream key", streamKey ?? "")}
                  className="px-3 py-2 rounded-md border text-xs"
                  disabled={!streamKey}
                >
                  Copy stream key
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <StreamKeyPanel streamKey={streamKey} onRegenerate={regenerateKey} />
            <LocalRecorder />
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold">Diagnostics</h3>
              <p className="muted text-xs mt-1">Use this to verify the stream URLs and auth status.</p>
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
                  className="px-3 py-2 rounded-md border text-xs"
                  disabled={checkingPlayback}
                >
                  {checkingPlayback ? "Checking..." : "Check playback"}
                </button>
                <button
                  type="button"
                  onClick={() => copyText("Playback URL", playbackUrl)}
                  className="px-3 py-2 rounded-md border text-xs"
                  disabled={!playbackUrl}
                >
                  Copy HLS URL
                </button>
                <button
                  type="button"
                  onClick={() => copyText("Studio URL", webrtcPublishUrl)}
                  className="px-3 py-2 rounded-md border text-xs"
                  disabled={!webrtcPublishUrl}
                >
                  Copy studio URL
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>
      {authMode && (
        <SignInModal
          defaultMode={authMode}
          onClose={() => setAuthMode(null)}
          onSignedIn={() => setAuthMode(null)}
        />
      )}
    </div>
  );
}
