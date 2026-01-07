// src/components/AuthGate.tsx
import React from "react";
import SignInModal from "./SignInModal";
import { AuthUser, readAuthUser } from "../lib/auth";

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-50 w-full max-w-lg rounded-2xl bg-surface/95 text-text p-6 glass-card">
          <h2 className="text-2xl font-bold">Welcome to Petra Stream</h2>
          <p className="mt-2 text-sm subtle">
            Sign up or log in to personalize your feed. You can connect a wallet later for creator actions and tips.
          </p>

          <div className="mt-6 grid gap-3">
            <button onClick={() => setMode("register")} className="btn-primary px-4 py-2 rounded-md">
              Create account
            </button>
            <button onClick={() => setMode("login")} className="px-4 py-2 rounded-md border">
              Sign in
            </button>
            <button
              onClick={() => {
                setDismissed();
                setOpen(false);
              }}
              className="px-4 py-2 rounded-md border"
            >
              Explore as guest
            </button>
          </div>
        </div>
      </div>

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
