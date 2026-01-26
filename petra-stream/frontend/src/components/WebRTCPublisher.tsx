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
type FilterPreset = "none" | "warm" | "crisp" | "soft" | "vintage" | "custom";
type FilterSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
};

type WebRTCPublisherProps = {
  publishUrl: string;
  defaultMode?: PublishMode;
  disabled?: boolean;
  onStarted?: () => void;
  onStopped?: () => void;
};

function normalizeWhipUrl(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input);
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

const DEFAULT_FILTERS: FilterSettings = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  sharpness: 0,
};

const FILTER_PRESETS: Record<Exclude<FilterPreset, "custom">, FilterSettings> = {
  none: { ...DEFAULT_FILTERS },
  warm: { brightness: 1.05, contrast: 1.05, saturation: 1.15, warmth: 0.2, sharpness: 0.05 },
  crisp: { brightness: 1.02, contrast: 1.15, saturation: 1.1, warmth: 0, sharpness: 0.2 },
  soft: { brightness: 1.05, contrast: 0.9, saturation: 0.95, warmth: 0.05, sharpness: 0 },
  vintage: { brightness: 1.02, contrast: 0.9, saturation: 0.8, warmth: 0.3, sharpness: 0 },
};

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
  disabled = false,
  onStarted,
  onStopped,
}: WebRTCPublisherProps): JSX.Element {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraSourceRef = useRef<MediaStream | null>(null);
  const filterVideoRef = useRef<HTMLVideoElement | null>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filterLoopRef = useRef<number | null>(null);
  const filterStreamRef = useRef<MediaStream | null>(null);
  const filtersRef = useRef<FilterSettings>(DEFAULT_FILTERS);
  const sessionUrlRef = useRef<string | null>(null);
  const statsTimerRef = useRef<number | null>(null);
  const lastStatsRef = useRef<{ videoBytes: number; timestamp: number } | null>(null);
  const lastLossRef = useRef<{ lost: number; received: number } | null>(null);
  const bitrateRef = useRef<number>(CAMERA_PROFILE.maxBitrate ?? 600_000);
  const bitrateChangeRef = useRef<number>(0);
  const qualityTrendRef = useRef<{ good: number; bad: number }>({ good: 0, bad: 0 });
  const [mode, setMode] = useState<PublishMode>(defaultMode);
  const [shareSystemAudio, setShareSystemAudio] = useState(false);
  const [filtersEnabled, setFiltersEnabled] = useState(true);
  const [preset, setPreset] = useState<FilterPreset>("none");
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);
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
    filtersRef.current = filters;
  }, [filters]);

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

  function applyPreset(nextPreset: FilterPreset) {
    if (nextPreset === "custom") {
      setPreset("custom");
      return;
    }
    setPreset(nextPreset);
    setFilters(FILTER_PRESETS[nextPreset]);
  }

  function updateFilter<K extends keyof FilterSettings>(key: K, value: number) {
    setPreset("custom");
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function buildFilterString(settings: FilterSettings) {
    const brightness = clamp(settings.brightness, 0.6, 1.5);
    const contrast = clamp(settings.contrast, 0.6, 1.5);
    const saturation = clamp(settings.saturation, 0.5, 1.8);
    const warmth = clamp(settings.warmth, 0, 0.5);
    return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${warmth})`;
  }

  function shouldUseFilters(settings: FilterSettings) {
    if (!filtersEnabled) return false;
    return (
      Math.abs(settings.brightness - 1) > 0.01 ||
      Math.abs(settings.contrast - 1) > 0.01 ||
      Math.abs(settings.saturation - 1) > 0.01 ||
      settings.warmth > 0.01 ||
      settings.sharpness > 0.01
    );
  }

  function stopFilterPipeline() {
    if (filterLoopRef.current) {
      window.cancelAnimationFrame(filterLoopRef.current);
      filterLoopRef.current = null;
    }
    filterStreamRef.current?.getTracks().forEach((track) => track.stop());
    filterStreamRef.current = null;
  }

  function cleanupCameraSource() {
    stopFilterPipeline();
    if (filterVideoRef.current) {
      filterVideoRef.current.pause();
      filterVideoRef.current.srcObject = null;
    }
    cameraSourceRef.current?.getTracks().forEach((track) => track.stop());
    cameraSourceRef.current = null;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
    const strength = clamp(amount, 0, 0.6);
    if (strength < 0.05) return;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    const center = 1 + 4 * strength;
    const side = -strength;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          const value =
            copy[idx + c] * center +
            copy[idx + c - 4] * side +
            copy[idx + c + 4] * side +
            copy[idx + c - width * 4] * side +
            copy[idx + c + width * 4] * side;
          data[idx + c] = clamp(value, 0, 255);
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

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
      const cameraStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      cameraSourceRef.current = cameraStream;
      const audioTrack = cameraStream.getAudioTracks()[0] || null;
      const rawVideoTrack = cameraStream.getVideoTracks()[0] || null;

      let stream: MediaStream;
      if (rawVideoTrack && shouldUseFilters(filtersRef.current)) {
        const filtered = await createFilteredStream(cameraStream);
        filterStreamRef.current = filtered.stream;
        stream = new MediaStream();
        stream.addTrack(filtered.track);
        if (audioTrack) stream.addTrack(audioTrack);
      } else {
        stream = new MediaStream();
        if (rawVideoTrack) stream.addTrack(rawVideoTrack);
        if (audioTrack) stream.addTrack(audioTrack);
      }

      return { stream, audioTrack };
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

  async function createFilteredStream(cameraStream: MediaStream) {
    const rawVideo = filterVideoRef.current;
    const canvas = filterCanvasRef.current;
    if (!rawVideo || !canvas) {
      throw new Error("Filter pipeline not ready");
    }

    rawVideo.srcObject = cameraStream;
    rawVideo.muted = true;
    await rawVideo.play().catch(() => {});

    const track = cameraStream.getVideoTracks()[0];
    const settings = track?.getSettings();
    const width = settings?.width ?? 640;
    const height = settings?.height ?? 360;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }

    const draw = () => {
      if (!rawVideo.srcObject) return;
      ctx.filter = buildFilterString(filtersRef.current);
      ctx.drawImage(rawVideo, 0, 0, width, height);
      applySharpen(ctx, width, height, filtersRef.current.sharpness);
      filterLoopRef.current = window.requestAnimationFrame(draw);
    };
    draw();

    const filteredStream = canvas.captureStream(CAMERA_PROFILE.maxFramerate ?? 20);
    const filteredTrack = filteredStream.getVideoTracks()[0];
    return { stream: filteredStream, track: filteredTrack };
  }

  async function replaceTracks(nextMode: PublishMode) {
    const pc = pcRef.current;
    if (!pc) return;
    setStatus("Switching source...");
    if (nextMode === "camera") {
      cleanupCameraSource();
    }
    const stream =
      nextMode === "screen"
        ? await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS(shareSystemAudio))
        : await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

    if (nextMode === "screen") {
      cleanupCameraSource();
    }

    let nextVideo = stream.getVideoTracks()[0];
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
        if (nextMode === "camera" && shouldUseFilters(filtersRef.current)) {
          cameraSourceRef.current = stream;
          const filtered = await createFilteredStream(stream);
          filterStreamRef.current = filtered.stream;
          nextVideo = filtered.track;
        }
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
    if (nextMode === "camera" && stream) {
      cameraSourceRef.current = stream;
    }

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
      toast.error("WHIP endpoint missing", "Configure VITE_WEBRTC_PUBLISH_URL");
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

      const pc = new RTCPeerConnection();
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
    cleanupCameraSource();

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
          <span className="text-white/60 uppercase tracking-widest">Source</span>
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

      {mode === "camera" ? (
        <div className="px-4 py-3 border-b border-white/10 text-xs text-white/70">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filtersEnabled}
                onChange={(e) => {
                  const next = e.target.checked;
                  setFiltersEnabled(next);
                  if (publishing && mode === "camera") {
                    void replaceTracks("camera");
                  }
                }}
                className="rounded border-white/20 bg-transparent"
              />
              <span className="text-white/60 uppercase tracking-widest text-[10px]">
                Enable filters
              </span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-white/60 uppercase tracking-widest text-[10px]">Preset</span>
              <select
                value={preset}
                onChange={(e) => applyPreset(e.target.value as FilterPreset)}
                disabled={!filtersEnabled}
                className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-[11px]"
              >
                <option value="none">None</option>
                <option value="warm">Warm</option>
                <option value="crisp">Crisp</option>
                <option value="soft">Soft</option>
                <option value="vintage">Vintage</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <span className="text-[10px] text-white/40">Camera filters only</span>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3">
              <span>Brightness</span>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.01"
                value={filters.brightness}
                onChange={(e) => updateFilter("brightness", Number(e.target.value))}
                disabled={!filtersEnabled}
                className="flex-1"
              />
              <span className="w-10 text-right">{filters.brightness.toFixed(2)}</span>
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Contrast</span>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.01"
                value={filters.contrast}
                onChange={(e) => updateFilter("contrast", Number(e.target.value))}
                disabled={!filtersEnabled}
                className="flex-1"
              />
              <span className="w-10 text-right">{filters.contrast.toFixed(2)}</span>
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Saturation</span>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.01"
                value={filters.saturation}
                onChange={(e) => updateFilter("saturation", Number(e.target.value))}
                disabled={!filtersEnabled}
                className="flex-1"
              />
              <span className="w-10 text-right">{filters.saturation.toFixed(2)}</span>
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Sharpness</span>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={filters.sharpness}
                onChange={(e) => updateFilter("sharpness", Number(e.target.value))}
                disabled={!filtersEnabled}
                className="flex-1"
              />
              <span className="w-10 text-right">{filters.sharpness.toFixed(2)}</span>
            </label>
          </div>
        </div>
      ) : null}

      <div className="aspect-video bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      </div>

      <video ref={filterVideoRef} className="hidden" muted playsInline />
      <canvas ref={filterCanvasRef} className="hidden" />

      {error ? (
        <div className="px-4 py-3 text-xs text-amber-200/80 border-t border-white/10">
          {error}
        </div>
      ) : null}
    </div>
  );
}

