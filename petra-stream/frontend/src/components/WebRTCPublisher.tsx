// src/components/WebRTCPublisher.tsx
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useToast } from "../contexts/ToastContext";

type PublishMode = "camera" | "screen";
type EncodingProfile = {
  maxBitrate?: number;
  maxFramerate?: number;
  degradationPreference?: RTCRtpDegradationPreference;
};

type WebRTCPublisherProps = {
  publishUrl: string;
  defaultMode?: PublishMode;
  fixedMode?: PublishMode;
  disabled?: boolean;
  onStarted?: () => void;
  onStopped?: () => void;
  onModeChange?: (mode: PublishMode) => void;
  title?: string;
};

function normalizeWhipUrl(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input);
    if (/\/webRTC\/publish$/i.test(url.pathname)) {
      return url.toString();
    }
    if (url.pathname.endsWith("/publish")) {
      url.pathname = url.pathname.replace(/\/publish$/, "/whip");
      return url.toString();
    }
    if (!url.pathname.includes("/whip")) {
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/whip`;
    }
    return url.toString();
  } catch {
    return "";
  }
}

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

const CAMERA_PROFILE: EncodingProfile = {
  maxBitrate: 600_000,
  maxFramerate: 20,
  degradationPreference: "maintain-framerate",
};
const SCREEN_PROFILE: EncodingProfile = {
  maxBitrate: 600_000,
  maxFramerate: 15,
  degradationPreference: "maintain-framerate",
};
const AUDIO_PROFILE: EncodingProfile = { maxBitrate: 64_000 };
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: { ideal: 20, max: 20 },
  },
  audio: true,
};

const SCREEN_CONSTRAINTS = (enableAudio: boolean): DisplayMediaStreamConstraints => ({
  video: { frameRate: { ideal: 15, max: 15 } },
  audio: enableAudio,
});

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

export default function WebRTCPublisher({
  publishUrl,
  defaultMode = "camera",
  fixedMode,
  disabled = false,
  onStarted,
  onStopped,
  onModeChange,
  title,
}: WebRTCPublisherProps): JSX.Element {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const sessionUrlRef = useRef<string | null>(null);
  const activePublishUrlRef = useRef<string | null>(null);
  const hasPublicCandidateRef = useRef(false);
  const statsTimerRef = useRef<number | null>(null);
  const lastStatsRef = useRef<{ videoBytes: number; timestamp: number } | null>(null);
  const lastLossRef = useRef<{ lost: number; received: number } | null>(null);
  const bitrateRef = useRef<number>(CAMERA_PROFILE.maxBitrate ?? 600_000);
  const bitrateChangeRef = useRef<number>(0);
  const qualityTrendRef = useRef<{ good: number; bad: number }>({ good: 0, bad: 0 });
  const [mode, setMode] = useState<PublishMode>(defaultMode);
  const [shareSystemAudio, setShareSystemAudio] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    bitrateKbps?: number;
    fps?: number;
    packetsLost?: number;
    jitterMs?: number;
    rttMs?: number;
    qualityLimitationReason?: string;
  } | null>(null);

  const whipUrl = normalizeWhipUrl(publishUrl);

  useEffect(() => {
    return () => {
      void stopPublish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (!fixedMode) return;
    setMode(fixedMode);
  }, [fixedMode]);

  useEffect(() => {
    if (!publishing) return;
    const nextWhip = normalizeWhipUrl(publishUrl);
    if (nextWhip && activePublishUrlRef.current && nextWhip !== activePublishUrlRef.current) {
      void (async () => {
        await stopPublish();
        await startPublish(mode);
      })();
    }
  }, [publishUrl, publishing, mode]);

  useEffect(() => {
    if (!publishing) {
      if (statsTimerRef.current) {
        window.clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
      setHealth(null);
      lastStatsRef.current = null;
      lastLossRef.current = null;
      qualityTrendRef.current = { good: 0, bad: 0 };
      return;
    }

    const pollStats = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let outboundVideo: any = null;
        let remoteVideo: any = null;

        stats.forEach((report) => {
          const kind = (report as any).kind || (report as any).mediaType;
          if (report.type === "outbound-rtp" && kind === "video" && !(report as any).isRemote) {
            outboundVideo = report;
          }
          if (report.type === "remote-inbound-rtp" && kind === "video") {
            remoteVideo = report;
          }
        });

        const now = Date.now();
        let bitrateKbps: number | undefined;
        if (outboundVideo?.bytesSent != null) {
          const prev = lastStatsRef.current;
          if (prev) {
            const deltaBytes = outboundVideo.bytesSent - prev.videoBytes;
            const deltaTime = now - prev.timestamp;
            if (deltaTime > 0) {
              bitrateKbps = Math.max(0, (deltaBytes * 8) / deltaTime);
            }
          }
          lastStatsRef.current = { videoBytes: outboundVideo.bytesSent, timestamp: now };
        }

        const fps = outboundVideo?.framesPerSecond ?? undefined;
        const packetsLost = remoteVideo?.packetsLost ?? undefined;
        const packetsReceived = remoteVideo?.packetsReceived ?? undefined;
        let lossRate: number | undefined;
        if (typeof packetsLost === "number" && typeof packetsReceived === "number") {
          const prev = lastLossRef.current;
          if (prev) {
            const deltaLost = packetsLost - prev.lost;
            const deltaRecv = packetsReceived - prev.received;
            const total = deltaLost + deltaRecv;
            if (total > 0) {
              lossRate = deltaLost / total;
            }
          }
          lastLossRef.current = { lost: packetsLost, received: packetsReceived };
        }
        const jitterMs =
          remoteVideo?.jitter != null ? Math.round(remoteVideo.jitter * 1000) : undefined;
        const rttMs =
          remoteVideo?.roundTripTime != null
            ? Math.round(remoteVideo.roundTripTime * 1000)
            : undefined;
        const qualityLimitationReason = outboundVideo?.qualityLimitationReason ?? undefined;

        setHealth({
          bitrateKbps: bitrateKbps ? Math.round(bitrateKbps) : undefined,
          fps: fps ? Math.round(fps) : undefined,
          packetsLost,
          jitterMs,
          rttMs,
          qualityLimitationReason,
        });
        await maybeAdjustBitrate({ lossRate, jitterMs, rttMs });
      } catch {
        // ignore stats errors
      }
    };

    pollStats();
    statsTimerRef.current = window.setInterval(pollStats, 2000);

    return () => {
      if (statsTimerRef.current) {
        window.clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
    };
  }, [publishing, mode]);

  async function maybeAdjustBitrate({
    lossRate,
    jitterMs,
    rttMs,
  }: {
    lossRate?: number;
    jitterMs?: number;
    rttMs?: number;
  }) {
    const pc = pcRef.current;
    if (!pc) return;

    const now = Date.now();
    const cooldownMs = 6000;
    if (now - bitrateChangeRef.current < cooldownMs) return;

    const highLoss = lossRate != null && lossRate > 0.03;
    const mildLoss = lossRate != null && lossRate > 0.015;
    const highRtt = rttMs != null && rttMs > 400;
    const highJitter = jitterMs != null && jitterMs > 30;
    const goodNetwork =
      (lossRate == null || lossRate < 0.005) &&
      (rttMs == null || rttMs < 200) &&
      (jitterMs == null || jitterMs < 20);

    if (highLoss || highRtt || highJitter || mildLoss) {
      qualityTrendRef.current = { good: 0, bad: qualityTrendRef.current.bad + 1 };
    } else if (goodNetwork) {
      qualityTrendRef.current = { bad: 0, good: qualityTrendRef.current.good + 1 };
    } else {
      qualityTrendRef.current = { bad: 0, good: 0 };
    }

    const minBitrate = 350_000;
    const maxBitrate = mode === "screen" ? 900_000 : 850_000;
    const current = bitrateRef.current;

    if (qualityTrendRef.current.bad >= 2 && current > minBitrate) {
      const next = Math.max(minBitrate, Math.round(current * 0.85));
      await setVideoBitrate(next);
      qualityTrendRef.current = { good: 0, bad: 0 };
      return;
    }

    if (qualityTrendRef.current.good >= 3 && current < maxBitrate) {
      const next = Math.min(maxBitrate, Math.round(current * 1.1));
      await setVideoBitrate(next);
      qualityTrendRef.current = { good: 0, bad: 0 };
    }
  }

  async function setVideoBitrate(target: number) {
    const videoSender = getSender("video");
    if (!videoSender) return;
    bitrateRef.current = target;
    await applyEncoding(videoSender, { maxBitrate: target });
    bitrateChangeRef.current = Date.now();
  }

  function getSender(kind: "audio" | "video") {
    const pc = pcRef.current;
    if (!pc) return null;
    return pc.getSenders().find((sender) => sender.track && sender.track.kind === kind) || null;
  }

  async function applyEncoding(sender: RTCRtpSender | null, profile: EncodingProfile) {
    if (!sender || !sender.getParameters) return;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    if (typeof profile.maxBitrate === "number") {
      params.encodings[0].maxBitrate = profile.maxBitrate;
    }
    if (typeof profile.maxFramerate === "number") {
      params.encodings[0].maxFramerate = profile.maxFramerate;
    }
    if (profile.degradationPreference) {
      params.degradationPreference = profile.degradationPreference;
    }
    try {
      await sender.setParameters(params);
    } catch {
      // ignore for browsers that restrict setParameters
    }
  }

  function preferH264(transceiver: RTCRtpTransceiver) {
    const caps = RTCRtpSender.getCapabilities?.("video");
    if (!caps?.codecs?.length) return;
    const h264 = caps.codecs.filter((codec) => codec.mimeType.toLowerCase() === "video/h264");
    if (!h264.length) return;
    const rest = caps.codecs.filter((codec) => codec.mimeType.toLowerCase() !== "video/h264");
    transceiver.setCodecPreferences([...h264, ...rest]);
  }

  async function getCapture(nextMode: PublishMode) {
    if (nextMode === "camera") {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      return { stream, audioTrack: stream.getAudioTracks()[0] || null };
    }

    const display = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS(shareSystemAudio));
    const videoTrack = display.getVideoTracks()[0] || null;
    let audioTrack = display.getAudioTracks()[0] || null;

    if (!audioTrack) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = mic.getAudioTracks()[0] || null;
      } catch {
        audioTrack = null;
      }
    }

    const combined = new MediaStream();
    if (videoTrack) combined.addTrack(videoTrack);
    if (audioTrack) combined.addTrack(audioTrack);
    return { stream: combined, audioTrack };
  }

  async function replaceTracks(nextMode: PublishMode) {
    const pc = pcRef.current;
    if (!pc) return;
    setStatus("Switching source...");
    const stream =
      nextMode === "screen"
        ? await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS(shareSystemAudio))
        : await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

    const nextVideo = stream.getVideoTracks()[0];
    let nextAudio = stream.getAudioTracks()[0] || audioTrackRef.current;
    if (!nextAudio) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        nextAudio = mic.getAudioTracks()[0] || null;
      } catch {
        nextAudio = null;
      }
    }

    if (nextVideo) {
      const videoSender = getSender("video");
      if (videoSender) {
        await videoSender.replaceTrack(nextVideo);
        const profile = nextMode === "screen" ? SCREEN_PROFILE : CAMERA_PROFILE;
        bitrateRef.current = profile.maxBitrate ?? bitrateRef.current;
        await applyEncoding(videoSender, profile);
      }
    }
    if (nextAudio) {
      const audioSender = getSender("audio");
      if (audioSender) {
        await audioSender.replaceTrack(nextAudio);
        await applyEncoding(audioSender, AUDIO_PROFILE);
      }
    }

    if (videoRef.current) {
      const previewStream = new MediaStream();
      if (nextVideo) previewStream.addTrack(nextVideo);
      if (nextAudio) previewStream.addTrack(nextAudio);
      videoRef.current.srcObject = previewStream;
      videoRef.current.muted = true;
      await videoRef.current.play().catch(() => {});
    }

    const keep = new Set<MediaStreamTrack>();
    if (nextVideo) keep.add(nextVideo);
    if (nextAudio) keep.add(nextAudio);
    streamRef.current?.getTracks().forEach((track) => {
      if (!keep.has(track)) track.stop();
    });
    const combined = new MediaStream();
    if (nextVideo) combined.addTrack(nextVideo);
    if (nextAudio) combined.addTrack(nextAudio);
    streamRef.current = combined;
    audioTrackRef.current = nextAudio || null;

    if (nextMode === "screen" && nextVideo) {
      nextVideo.addEventListener("ended", () => {
        if (publishing) {
          void switchSource("camera");
        }
      });
    }

    setMode(nextMode);
    setStatus("Live");
  }

  async function startPublish(nextMode: PublishMode) {
    if (!whipUrl) {
      toast.error(
        "WHIP endpoint missing",
        "Configure VITE_WEBRTC_PUBLISH_URL_CAMERA / VITE_WEBRTC_PUBLISH_URL_SCREEN (or enable VPS fallback)."
      );
      return;
    }
    if (publishing) return;
    setError(null);
    setStatus("Requesting permissions...");
    try {
      const { stream, audioTrack } = await getCapture(nextMode);

      streamRef.current = stream;
      audioTrackRef.current = audioTrack;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({ iceServers: parseIceServers() });
      const videoTrack = stream.getVideoTracks()[0];
      const streamAudioTrack = stream.getAudioTracks()[0];
      if (videoTrack) {
        const videoTx = pc.addTransceiver(videoTrack, { direction: "sendonly" });
        preferH264(videoTx);
        const profile = nextMode === "screen" ? SCREEN_PROFILE : CAMERA_PROFILE;
        bitrateRef.current = profile.maxBitrate ?? bitrateRef.current;
        await applyEncoding(videoTx.sender, profile);
      }
      if (streamAudioTrack) {
        const audioTx = pc.addTransceiver(streamAudioTrack, { direction: "sendonly" });
        await applyEncoding(audioTx.sender, AUDIO_PROFILE);
      }
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        const candidate = event.candidate?.candidate || "";
        if (candidate.includes(" typ srflx ") || candidate.includes(" typ relay ")) {
          hasPublicCandidateRef.current = true;
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete" && !hasPublicCandidateRef.current) {
          setError("No public ICE candidates (srflx/relay). Check STUN/TURN.");
          toast.error("ICE failed", "No public candidates found. Check STUN/TURN.", 3500);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("Live");
        } else if (pc.connectionState === "failed") {
          setStatus("Connection failed");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      setStatus("Connecting...");
      const res = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? "",
      });
      if (!res.ok) {
        throw new Error(`WHIP failed (${res.status})`);
      }
      const answerSdp = await res.text();
      const location = res.headers.get("Location");
      if (location) {
        sessionUrlRef.current = new URL(location, whipUrl).toString();
      }
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      activePublishUrlRef.current = whipUrl;
      setPublishing(true);
      setStatus("Live");
      onStarted?.();
      toast.success("Broadcasting", nextMode === "screen" ? "Screen share live" : "Camera live", 2200);
    } catch (err: any) {
      console.error(err);
      if (err?.name === "NotAllowedError") {
        setError(null);
        setStatus("Permission denied");
        toast.info("Screen share cancelled", "You can keep streaming with the current source.", 2400);
      } else {
        setError(err?.message || "Publish failed");
        setStatus("Failed to start");
      }
      await stopPublish();
      if (err?.name !== "NotAllowedError") {
        toast.error("Broadcast failed", err?.message || "Unable to start", 3000);
      }
    }
  }

  async function stopPublish() {
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      try {
        pc.getSenders().forEach((sender) => sender.track?.stop());
        pc.close();
      } catch {
        // ignore
      }
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioTrackRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (sessionUrlRef.current) {
      try {
        await fetch(sessionUrlRef.current, { method: "DELETE" });
      } catch {
        // ignore
      }
      sessionUrlRef.current = null;
    }
    activePublishUrlRef.current = null;

    if (publishing) {
      setPublishing(false);
      setStatus("Stopped");
      setHealth(null);
      onStopped?.();
    } else {
      setStatus("Idle");
    }
  }

  async function switchSource(nextMode: PublishMode) {
    if (!publishing) return;
    if (nextMode === mode) return;
    try {
      await replaceTracks(nextMode);
      toast.success("Source switched", nextMode === "screen" ? "Screen share live" : "Camera live", 2000);
    } catch (err: any) {
      console.error(err);
      if (err?.name === "NotAllowedError") {
        setError(null);
        toast.info("Screen share cancelled", "Continuing with your current source.", 2400);
      } else {
        setError(err?.message || "Switch failed");
        toast.error("Switch failed", err?.message || "Unable to switch source", 2600);
      }
      setStatus("Live");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/60 uppercase tracking-widest">{title || "Source"}</span>
          {fixedMode ? (
            <span className="px-2 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-white/70">
              {fixedMode === "screen" ? "Screen" : "Camera"}
            </span>
          ) : (
            <div className="inline-flex rounded-full border border-white/10 overflow-hidden">
              <button
                type="button"
                className={clsx("px-3 py-1 text-[11px]", mode === "camera" ? "bg-white/10 text-text" : "text-white/60")}
                onClick={() => (publishing ? void switchSource("camera") : setMode("camera"))}
                disabled={disabled}
              >
                Camera
              </button>
              <button
                type="button"
                className={clsx("px-3 py-1 text-[11px]", mode === "screen" ? "bg-white/10 text-text" : "text-white/60")}
                onClick={() => (publishing ? void switchSource("screen") : setMode("screen"))}
                disabled={disabled}
              >
                Screen
              </button>
            </div>
          )}
          {mode === "screen" ? (
            <label className="inline-flex items-center gap-2 text-[11px] text-white/60">
              <input
                type="checkbox"
                checked={shareSystemAudio}
                onChange={(e) => setShareSystemAudio(e.target.checked)}
                disabled={publishing}
                className="rounded border-white/20 bg-transparent"
              />
              System audio
            </label>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={clsx("px-2 py-1 rounded-full border text-[10px] uppercase tracking-widest", publishing ? "border-emerald-400/40 text-emerald-200" : "border-white/10 text-white/60")}>
            {status}
          </span>
          {health ? (
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-white/70">
              <span>Net</span>
              <span>{health.bitrateKbps ? `${health.bitrateKbps} kbps` : "--"}</span>
              <span>{health.fps ? `${health.fps} fps` : "--"}</span>
              <span>{health.packetsLost != null ? `${health.packetsLost} lost` : "--"}</span>
              <span>{health.rttMs != null ? `${health.rttMs} ms` : "--"}</span>
            </div>
          ) : null}
          {publishing ? (
            <button
              type="button"
              onClick={() => void stopPublish()}
              className="px-3 py-2 rounded-full border border-white/10 text-xs"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startPublish(mode)}
              className="px-3 py-2 rounded-full border border-white/10 text-xs"
              disabled={disabled}
            >
              Start {mode === "screen" ? "screen share" : "camera"}
            </button>
          )}
        </div>
      </div>

      <div className="aspect-video bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      </div>

      {error ? (
        <div className="px-4 py-3 text-xs text-amber-200/80 border-t border-white/10">
          {error}
        </div>
      ) : null}
    </div>
  );
}
