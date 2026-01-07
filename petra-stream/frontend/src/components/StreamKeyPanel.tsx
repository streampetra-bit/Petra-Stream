// src/components/StreamKeyPanel.tsx
import React, { useState } from "react";
import { useToast } from "../contexts/ToastContext";

export default function StreamKeyPanel({
  streamKey,
  onRegenerate,
}: {
  streamKey?: string | null;
  onRegenerate?: () => Promise<void> | void;
}) {
  const [show, setShow] = useState(false);
  const toast = useToast();

  const masked = streamKey ? streamKey.replace(/.(?=.{4})/g, "*") : "not-set";
  const statusLabel = streamKey ? "Ready" : "Not set";
  const keyActionLabel = streamKey ? "Regenerate Key" : "Generate Key";

  async function copyKey() {
    if (!streamKey) {
      toast.error("No stream key available");
      return;
    }
    try {
      await navigator.clipboard.writeText(streamKey);
      toast.success("Stream key copied", undefined, 1800);
    } catch (err) {
      console.error(err);
      toast.error("Copy failed");
    }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">Stream Key</h4>
          <div className="text-xs subtle mt-1">Keep this secret - anyone with this key can stream to your channel.</div>
        </div>

        <div className="text-right">
          <div className="text-xs subtle">Status</div>
          <div className="mt-1">
            <span className="px-2 py-1 rounded-md bg-bg/10 text-text text-sm">{statusLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 p-2 rounded border bg-bg/10">
          <div className="text-sm font-mono">{show ? (streamKey ?? "not-set") : masked}</div>
        </div>

        <button onClick={() => setShow((s) => !s)} className="px-3 py-2 rounded-md border text-sm">
          {show ? "Hide" : "Show"}
        </button>

        <button onClick={copyKey} className="px-3 py-2 btn-primary rounded-md text-sm">
          Copy
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => onRegenerate?.()} className="px-3 py-2 rounded-md border text-sm">
          {keyActionLabel}
        </button>
        <button onClick={() => toast.info("Learn how to stream (docs)", undefined, 1600)} className="px-3 py-2 rounded-md border text-sm">
          How to stream
        </button>
      </div>
    </div>
  );
}
