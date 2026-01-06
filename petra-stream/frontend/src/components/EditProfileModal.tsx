// src/components/EditProfileModal.tsx
import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { readAuthUser, updateAuthUser } from "../lib/auth";

export default function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: any;
  onClose: () => void;
  onSaved: (next: any) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector("input")?.focus(), 50);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    try {
      // call backend if available
      const res = await api.post(`/api/users/${profile.username}`, { displayName, bio }).catch(() => null);
      // if res ok, you might want to use server response; fallback to local object
      const next = res?.data ?? { displayName, bio };
      const authUser = readAuthUser();
      if (authUser) {
        const match =
          authUser.username === profile.username ||
          authUser.address === profile.username ||
          authUser.id === profile.username;
        if (match) {
          updateAuthUser({ ...authUser, displayName });
        }
      }
      onSaved(next);
    } catch (err) {
      console.error("Save failed", err);
      onSaved({ displayName, bio }); // optimistic
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={ref} className="relative bg-surface/95 text-text rounded-xl w-full max-w-lg p-6 glass-card">
        <h3 className="text-lg font-semibold">Edit profile</h3>
        <p className="text-sm subtle mt-1">Update your display name and bio. Changes save to the server if available.</p>

        <div className="mt-4 space-y-3">
          <label className="text-xs subtle">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-3 border rounded bg-bg/10 text-text" />

          <label className="text-xs subtle">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full p-3 border rounded bg-bg/10 text-text" rows={4} />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 btn-primary rounded">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
