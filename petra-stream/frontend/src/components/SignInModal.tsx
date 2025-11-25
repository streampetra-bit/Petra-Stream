// src/components/SignInModal.tsx
import React, { useEffect, useRef, useState } from "react";

export default function SignInModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: (u: { username: string; avatar?: string }) => void }) {
  const [username, setUsername] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector("input")?.focus(), 60);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const name = username.trim();
    if (!name) return;
    // very small avatar generation placeholder (initials)
    const avatar = undefined;
    onSignedIn({ username: name, avatar });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={ref} className="relative bg-surface/95 text-text rounded-xl w-full max-w-sm p-6 glass-card">
        <h3 className="text-lg font-semibold">Sign in / Create account</h3>
        <p className="text-sm subtle mt-1">This is a local UI-only sign-in for testing flows.</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="text-xs subtle">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 border rounded bg-bg/10 text-text" />

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" className="btn-primary px-4 py-2 rounded">Continue</button>
          </div>
        </form>
      </div>
    </div>
  );
}
