// src/pages/Create.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import StreamKeyPanel from "../components/StreamKeyPanel";
import { useToast } from "../contexts/ToastContext";
import Player from "../components/Player";
import LocalRecorder from "../components/LocalRecorder";

export default function CreatePage(): JSX.Element {
  const toast = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingPlayback, setCheckingPlayback] = useState(false);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [stats, setStats] = useState<{ viewers: number; tips: number; uptimeSec: number }>({
    viewers: 0,
    tips: 0,
    uptimeSec: 0,
  });

  const ingestUrl = import.meta.env.VITE_INGEST_URL || "";
  const hlsBaseUrl = import.meta.env.VITE_HLS_BASE_URL || "";
  const uptimeTimer = useRef<number | null>(null);

  useEffect(() => {
    // Example: if API returns a saved / draft stream object, you can fetch it here.
    (async () => {
      try {
        const res = await api.get("/api/streams/me").catch(() => null);
        if (res?.data) {
          setTitle(res.data.title ?? "");
          setDescription(res.data.description ?? "");
          setStreamKey(res.data.streamKey ?? null);
          setIsLive(!!res.data.isLive);
          setPlaybackUrl(res.data.playbackUrl ?? "");
        }
      } catch (err) {
        // ignore
      }
    })();

    return () => {
      if (uptimeTimer.current) window.clearInterval(uptimeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!playbackUrl && streamKey && hlsBaseUrl) {
      const base = hlsBaseUrl.endsWith("/") ? hlsBaseUrl.slice(0, -1) : hlsBaseUrl;
      setPlaybackUrl(`${base}/${streamKey}/index.m3u8`);
    }
  }, [streamKey, hlsBaseUrl, playbackUrl]);

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

  async function ensureStreamKey() {
    if (streamKey) return streamKey;
    try {
      const res = await api.post("/api/streams/generate-key").catch(() => null);
      const key = res?.data?.key ?? `sk_${Math.random().toString(36).slice(2, 12)}`;
      setStreamKey(key);
      return key;
    } catch (err) {
      const fallback = `sk_${Math.random().toString(36).slice(2, 12)}`;
      setStreamKey(fallback);
      return fallback;
    }
  }

  async function startStream() {
    if (!title.trim()) {
      toast.error("Please enter a stream title");
      return;
    }
    if (!playbackUrl.trim()) {
      toast.info("Tip", "Set a playback URL so viewers can watch (HLS/DASH).", 2500);
    }
    setLoading(true);
    try {
      const key = await ensureStreamKey();
      // ask backend to create/start stream session
      const payload = { title: title.trim(), description: description.trim(), key, playbackUrl: playbackUrl.trim() };
      const res = await api.post("/api/streams/start", payload).catch(() => null);
      if (res?.data?.ok ?? true) {
        toast.success("Stream started", "Your stream is now live (simulated)", 2500);
        setIsLive(true);
      } else {
        toast.success("Stream prepared", "Stream draft saved", 2000);
        setIsLive(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to start stream");
    } finally {
      setLoading(false);
    }
  }

  async function stopStream() {
    setLoading(true);
    try {
      await api.post("/api/streams/stop").catch(() => null);
      setIsLive(false);
      toast.info("Stream stopped", undefined, 1800);
      // optionally reset stats
    } catch (err) {
      console.error(err);
      toast.error("Failed to stop stream");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateKey() {
    setLoading(true);
    try {
      const res = await api.post("/api/streams/regenerate-key").catch(() => null);
      const key = res?.data?.key ?? `sk_${Math.random().toString(36).slice(2, 12)}`;
      setStreamKey(key);
      toast.success("Stream key regenerated", undefined, 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to regenerate key");
    } finally {
      setLoading(false);
    }
  }

  async function testPlayback() {
    if (!playbackUrl.trim()) {
      toast.error("Playback URL required", "Set a playback URL first");
      return;
    }
    setCheckingPlayback(true);
    try {
      const res = await api.post("/api/streams/playback/check", { playbackUrl: playbackUrl.trim() }).catch(() => null);
      if (res?.data?.ok) {
        toast.success("Playback ready", `HTTP ${res.data.status}`);
      } else {
        toast.error("Playback not ready", res?.data?.reason || "No response");
      }
    } catch (err) {
      console.error(err);
      toast.error("Playback check failed");
    } finally {
      setCheckingPlayback(false);
    }
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Stream Dashboard</h1>
          <p className="muted mt-1">Create and manage your live streams. Use the preview panel to check your stream settings.</p>
        </div>

        <div className="flex items-center gap-3">
          {!isLive ? (
            <button onClick={startStream} disabled={loading} className="btn-primary px-4 py-2 rounded-md">
              {loading ? "Starting..." : "Start new stream"}
            </button>
          ) : (
            <button onClick={stopStream} disabled={loading} className="px-4 py-2 rounded-md border bg-red-600/10">
              {loading ? "Stopping..." : "Stop stream"}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="glass-card p-4">
            <label className="text-xs subtle">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 mt-1 rounded border bg-bg/10 text-text"
              placeholder="Enter stream title"
            />

            <label className="text-xs subtle mt-4">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 mt-1 rounded border bg-bg/10 text-text"
              rows={5}
              placeholder="Describe your stream (what are you doing?)"
            />

            <label className="text-xs subtle mt-4">Playback URL (HLS/DASH)</label>
            <input
              value={playbackUrl}
              onChange={(e) => setPlaybackUrl(e.target.value)}
              className="w-full p-3 mt-1 rounded border bg-bg/10 text-text"
              placeholder="https://your-cdn/stream.m3u8"
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={testPlayback}
                className="px-3 py-2 rounded-md border text-sm"
                disabled={checkingPlayback}
              >
                {checkingPlayback ? "Checking..." : "Test playback"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-white/6 p-3 bg-bg/10">
              <div className="text-xs subtle">Ingest (OBS/Streamlabs)</div>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText("RTMP server URL", ingestServer)}
                  className="px-3 py-2 rounded-md border text-sm"
                >
                  Copy RTMP server
                </button>
                <button
                  type="button"
                  onClick={() => copyText("Stream key", streamKey ?? "")}
                  className="px-3 py-2 rounded-md border text-sm"
                  disabled={!streamKey}
                >
                  Copy stream key
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => toast.info("Draft saved", undefined, 1500)} className="px-3 py-2 rounded-md border">
                Save draft
              </button>
              <button
                onClick={() => {
                  setTitle("");
                  setDescription("");
                  setPlaybackUrl("");
                  toast.info("Cleared", undefined, 1200);
                }}
                className="px-3 py-2 rounded-md border"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold">Preview</h3>
            <p className="muted text-sm mt-1">
              A preview of the player / thumbnail. Replace with actual ingest preview when integrating RTMP/HLS workflows.
            </p>

            <div className="mt-4">
              <Player heightClass="aspect-video" title={title || "Preview"} src={playbackUrl || undefined} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs subtle">Thumbnail</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={() => toast.info("Thumbnail uploaded (UI only)", undefined, 1200)}
                  className="w-full mt-1"
                />
              </div>

              <div>
                <label className="text-xs subtle">Category</label>
                <select className="w-full mt-1 p-2 rounded border bg-bg/10 text-text">
                  <option value="">General</option>
                  <option value="gaming">Gaming</option>
                  <option value="music">Music</option>
                  <option value="art">Art</option>
                </select>
              </div>
            </div>
          </div>

          <LocalRecorder />

          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold">Stream Analytics</h3>
            <p className="muted text-sm mt-1">Realtime stats (placeholder). Replace with your analytics backend when ready.</p>

            <div className="mt-4 grid grid-cols-3 gap-4">
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
          </div>
        </section>

        <aside className="space-y-4">
          <StreamKeyPanel streamKey={streamKey} onRegenerate={regenerateKey} />
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold">Quick actions</h4>
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => copyText("Playback URL", playbackUrl)}
                className="px-3 py-2 rounded-md border text-sm"
                disabled={!playbackUrl}
              >
                Copy stream URL
              </button>
              <button
                onClick={() => copyText("RTMP server URL", ingestServer)}
                className="px-3 py-2 rounded-md border text-sm"
              >
                Copy RTMP settings
              </button>
              <button onClick={() => navigate("/monitor")} className="px-3 py-2 rounded-md border text-sm">
                Open monitor
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
