import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type WebRTCPlayerProps = {
  playbackUrl?: string;
  title?: string;
  heightClass?: string;
  autoPlay?: boolean;
  startMuted?: boolean;
  showControls?: boolean;
};

function parseIceServers(): RTCIceServer[] {
  const raw = (import.meta as any)?.env?.VITE_WEBRTC_ICE_SERVERS;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch {
      // ignore bad JSON
    }
  }
  return [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
  ];
}

async function waitForIceComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const handler = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", handler);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", handler);
  });
}

export default function WebRTCPlayer({
  playbackUrl,
  title,
  heightClass = "",
  autoPlay = false,
  startMuted = false,
  showControls = true,
}: WebRTCPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(startMuted || autoPlay);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (autoPlay || startMuted) {
      v.muted = true;
      setMuted(true);
    }
  }, [autoPlay, startMuted]);

  useEffect(() => {
    void start();
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackUrl]);

  async function stop() {
    try {
      if (sessionUrlRef.current) {
        await fetch(sessionUrlRef.current, { method: "DELETE" }).catch(() => {});
      }
    } catch {}
    sessionUrlRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  }

  async function start() {
    if (!playbackUrl) return;
    setError(null);
    setStatus("Connecting...");
    await stop();

    const maxAttempts = 4;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;

      const pc = new RTCPeerConnection({ iceServers: parseIceServers() });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        const stream = event.streams?.[0];
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          if (autoPlay) {
            void videoRef.current.play().catch(() => {});
          }
        }
      };

      pc.onconnectionstatechange = () => {
        setStatus(pc.connectionState);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      const res = await fetch(playbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Accept: "application/sdp",
        },
        body: pc.localDescription?.sdp || "",
      });

      if (res.ok) {
        const answer = await res.text();
        const location = res.headers.get("location");
        if (location) sessionUrlRef.current = location;
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
        setStatus("Live");
        return;
      }

      pc.close();
      pcRef.current = null;

      if (res.status === 409 || res.status === 404) {
        const conflictLocation = res.headers.get("location");
        if (conflictLocation) {
          await fetch(conflictLocation, { method: "DELETE" }).catch(() => {});
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      setError(`Playback failed (${res.status})`);
      return;
    }

    setError("Playback not ready");
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function requestFullscreen() {
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      void el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
  }

  return (
    <div className={clsx("relative rounded-2xl overflow-hidden bg-black", heightClass)} aria-label={title ?? "WebRTC player"}>
      <video
        ref={videoRef}
        className="w-full h-full bg-black object-cover"
        playsInline
        muted={muted}
        autoPlay={autoPlay}
        controls={false}
      />

      {showControls ? (
        <div className="absolute left-4 bottom-4 right-4 flex items-center justify-between gap-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="rounded-full p-2 bg-black/60 hover:bg-black/70"
            >
              {muted ? (
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  <path d="M15.5 9.5 20 14m0-4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  <path d="M15 9.5a4 4 0 0 1 0 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M17.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            <button onClick={requestFullscreen} aria-label="Fullscreen" className="rounded-full p-2 bg-black/60 hover:bg-black/70">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18-3v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3m10 0h3a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="text-xs text-white/90 bg-black/40 px-2 py-1 rounded-md backdrop-blur-xs">
            {title || status}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white p-3 rounded-md">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
