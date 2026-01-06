// src/components/LocalRecorder.tsx
import React, { useEffect, useRef, useState } from "react";
import { useToast } from "../contexts/ToastContext";

type RecorderKind = "camera" | "screen";

export default function LocalRecorder(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [filename, setFilename] = useState<string>(() => `stream-recording-${Date.now()}.webm`);
  const toast = useToast();

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start(kind: RecorderKind) {
    try {
      stop(); // stop any existing recording
      setStatus("Requesting permissions...");
      const constraints = { video: true, audio: true };
      const stream =
        kind === "screen"
          ? await navigator.mediaDevices.getDisplayMedia(constraints as DisplayMediaStreamConstraints)
          : await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      chunksRef.current = [];
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `stream-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecording(false);
        setStatus("Saved to device");
        stopTracks();
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setStatus(kind === "screen" ? "Recording screen" : "Recording camera");
      toast.info("Recording started", undefined, 1800);
    } catch (err: any) {
      console.error("record start failed", err);
      setStatus("Permission denied or unavailable");
      toast.error("Recording failed", err?.message || "Cannot start recording", 2500);
    }
  }

  function stop() {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    } else {
      stopTracks();
    }
    setRecording(false);
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Local Recorder</h3>
          <p className="muted text-sm">Capture from camera or screen and save directly to your device (no server upload).</p>
        </div>
        <div className="text-xs subtle px-2 py-1 rounded bg-bg/10">{status}</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => start("camera")}
          className="btn-primary px-4 py-2 rounded-md text-sm"
          disabled={recording}
        >
          Start camera recording
        </button>
        <button
          type="button"
          onClick={() => start("screen")}
          className="px-4 py-2 rounded-md border text-sm"
          disabled={recording}
        >
          Start screen recording
        </button>
        <button
          type="button"
          onClick={stop}
          className="px-4 py-2 rounded-md border text-sm"
          disabled={!recording}
        >
          Stop & save
        </button>
      </div>

      <div>
        <label className="text-xs subtle">Filename</label>
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          className="mt-1 w-full p-2 rounded border bg-bg/10 text-text"
          placeholder="stream-recording.webm"
        />
      </div>

      <div className="rounded-lg overflow-hidden bg-black border border-white/6">
        <video ref={videoRef} className="w-full aspect-video bg-black" playsInline muted />
      </div>
    </div>
  );
}
