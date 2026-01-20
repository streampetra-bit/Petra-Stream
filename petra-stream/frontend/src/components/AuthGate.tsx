// src/components/AuthGate.tsx
import React from "react";
import SignInModal from "./SignInModal";
import { AuthUser, readAuthUser } from "../lib/auth";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";

const DISMISS_KEY = "auth_gate_dismissed";

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {}
}

export default function AuthGate(): JSX.Element | null {
  const [user, setUser] = React.useState<AuthUser | null>(readAuthUser());
  const [mode, setMode] = React.useState<"login" | "register" | null>(null);
  const [open, setOpen] = React.useState(() => !readAuthUser() && !isDismissed());
  const [backendReady, setBackendReady] = React.useState<boolean | null>(null);
  const [checking, setChecking] = React.useState(false);
  const toast = useToast();

  React.useEffect(() => {
    const refresh = () => {
      const next = readAuthUser();
      setUser(next);
      if (next) setOpen(false);
    };
    window.addEventListener("auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  React.useEffect(() => {
    if (user) setOpen(false);
  }, [user]);

  React.useEffect(() => {
    if (!open) return;
    void ensureBackendReady(false);
  }, [open]);

  async function ensureBackendReady(showToast = true) {
    if (checking) return backendReady === true;
    setChecking(true);
    try {
      const res = await api.get("/api/health").catch(() => null);
      const ok = !!res?.data?.ok;
      setBackendReady(ok);
      if (!ok && showToast) {
        toast.info("Warming up server", "Try again in a few seconds.", 3500);
      }
      return ok;
    } catch {
      setBackendReady(false);
      if (showToast) {
        toast.info("Server waking up", "Please try again in a few seconds.", 3500);
      }
      return false;
    } finally {
      setChecking(false);
    }
  }

  async function beginAuth(nextMode: "login" | "register") {
    const ok = await ensureBackendReady(true);
    if (!ok) return;
    setOpen(false);
    setMode(nextMode);
  }

  if (!open && !mode) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto px-4 pb-8"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 2rem)" }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-50 w-full max-w-lg rounded-2xl bg-surface/95 text-text p-6 glass-card max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h2 className="text-2xl font-bold">Welcome to Petra Stream</h2>
            <p className="mt-2 text-sm subtle">
              Sign up or log in to personalize your feed. You can connect a wallet later for creator actions and tips.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => void beginAuth("register")}
                className="btn-primary px-4 py-2 rounded-md"
                disabled={checking}
              >
                {checking ? "Checking server..." : "Create account"}
              </button>
              <button
                onClick={() => void beginAuth("login")}
                className="px-4 py-2 rounded-md border"
                disabled={checking}
              >
                {checking ? "Checking server..." : "Sign in"}
              </button>
              <button
                onClick={() => {
                  setDismissed();
                  setMode(null);
                  setOpen(false);
                }}
                className="px-4 py-2 rounded-md border"
              >
                Explore as guest
              </button>
            </div>

            {backendReady === false && (
              <div className="mt-3 text-xs text-amber-300">
                Server is waking up. If sign in fails, wait a few seconds and try again.
              </div>
            )}
          </div>
        </div>
      )}

      {mode && (
        <SignInModal
          defaultMode={mode}
          onClose={() => setMode(null)}
          onSignedIn={() => {
            setMode(null);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
