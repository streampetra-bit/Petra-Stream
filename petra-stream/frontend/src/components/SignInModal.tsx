// src/components/SignInModal.tsx
import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { AuthUser, writeAuth } from "../lib/auth";

type Mode = "login" | "register";

export default function SignInModal({
  onClose,
  onSignedIn,
  defaultMode = "login",
}: {
  onClose: () => void;
  onSignedIn: (u: AuthUser) => void;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [loginId, setLoginId] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector("input")?.focus(), 60);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, mode]);

  const parseError = (err: any) => {
    const msg = err?.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    return msg || "Please try again.";
  };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;

    if (mode === "login") {
      if (!loginId.trim() || !password) {
        toast.error("Missing details", "Enter your email/username and password.", 3000);
        return;
      }
    } else {
      if (!username.trim() || !email.trim() || !password) {
        toast.error("Missing details", "Username, email, and password are required.", 3000);
        return;
      }
    }

    setSaving(true);
    try {
      const res =
        mode === "login"
          ? await api.post("/api/auth/login", {
              emailOrUsername: loginId.trim(),
              password,
            })
          : await api.post("/api/auth/register", {
              username: username.trim(),
              email: email.trim(),
              password,
            });

      const token = res?.data?.token;
      const user = res?.data?.user;
      if (!token || !user) {
        toast.error("Sign in failed", "No token returned.", 3000);
        return;
      }
      writeAuth(user, token);
      onSignedIn(user);
      toast.success("Signed in", `Welcome, ${user.displayName || user.username || "creator"}`, 2500);
      onClose();
    } catch (err) {
      console.error("Auth failed", err);
      toast.error("Sign in failed", parseError(err), 3500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={ref} className="relative bg-surface/95 text-text rounded-xl w-full max-w-sm p-6 glass-card">
        <h3 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h3>
        <p className="text-sm subtle mt-1">
          Use email login for viewers. Connect a wallet later for on-chain actions.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "login" ? (
            <>
              <label className="text-xs subtle">Email or username</label>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full p-3 border rounded bg-bg/10 text-text"
                autoComplete="username"
              />
            </>
          ) : (
            <>
              <label className="text-xs subtle">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border rounded bg-bg/10 text-text"
                autoComplete="username"
              />

              <label className="text-xs subtle">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border rounded bg-bg/10 text-text"
                type="email"
                autoComplete="email"
              />
            </>
          )}

          <label className="text-xs subtle">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded bg-bg/10 text-text"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          <div className="flex items-center justify-between text-xs subtle pt-1">
            {mode === "login" ? (
              <button type="button" onClick={() => setMode("register")} className="hover:text-text">
                New here? Create account
              </button>
            ) : (
              <button type="button" onClick={() => setMode("login")} className="hover:text-text">
                Already have an account? Sign in
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 rounded">
              {saving ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
