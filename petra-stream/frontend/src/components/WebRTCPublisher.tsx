// src/components/WebRTCPublisher.tsx
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useToast } from "../contexts/ToastContext";

type PublishMode = "camera" | "screen";
type EncodingProfile = { maxBitrate: number; maxFramerate: number };

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

const CAMERA_PROFILE: EncodingProfile = { maxBitrate: 1_200_000, maxFramerate: 24 };
const SCREEN_PROFILE: EncodingProfile = { maxBitrate: 1_800_000, maxFramerate: 15 };

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
  const sessionUrlRef = useRef<string | null>(null);
  const [mode, setMode] = useState<PublishMode>(defaultMode);
  const [shareSystemAudio, setShareSystemAudio] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whipUrl = normalizeWhipUrl(publishUrl);

  useEffect(() => {
    return () => {
      void stopPublish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getSender(kind: "audio" | "video") {
    const pc = pcRef.current;
    if (!pc) return null;
    return pc.getSenders().find((sender) => sender.track && sender.track.kind === kind) || null;
  }

  async function applyEncoding(sender: RTCRtpSender | null, profile: EncodingProfile) {
    if (!sender || !sender.getParameters) return;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = profile.maxBitrate;
    params.encodings[0].maxFramerate = profile.maxFramerate;
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      return { stream, audioTrack: stream.getAudioTracks()[0] || null };
    }

    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: shareSystemAudio });
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
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: shareSystemAudio })
        : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

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
        await applyEncoding(videoSender, nextMode === "screen" ? SCREEN_PROFILE : CAMERA_PROFILE);
      }
    }
    if (nextAudio) {
      const audioSender = getSender("audio");
      if (audioSender) {
        await audioSender.replaceTrack(nextAudio);
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
        await applyEncoding(videoTx.sender, nextMode === "screen" ? SCREEN_PROFILE : CAMERA_PROFILE);
      }
      if (streamAudioTrack) {
        pc.addTransceiver(streamAudioTrack, { direction: "sendonly" });
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
        <video ref={videoRef} className="w-full h-full" muted playsInline />
      </div>

      {error ? (
        <div className="px-4 py-3 text-xs text-amber-200/80 border-t border-white/10">
          {error}
        </div>
      ) : null}
    </div>
  );
}
