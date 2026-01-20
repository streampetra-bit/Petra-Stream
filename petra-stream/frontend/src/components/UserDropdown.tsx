// src/components/UserDropdown.tsx
import React from "react";
import SignInModal from "./SignInModal";
import { useToast } from "../contexts/ToastContext";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { AuthUser, AUTH_TOKEN_KEY, clearAuth, readAuthUser, updateAuthUser } from "../lib/auth";

type AppUser = AuthUser | null;

export default function UserDropdown(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [user, setUser] = React.useState<AppUser>(readAuthUser());
  const [authMode, setAuthMode] = React.useState<"login" | "register" | null>(null);
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();

  React.useEffect(() => {
    const refresh = () => setUser(readAuthUser());
    refresh();
    window.addEventListener("auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  React.useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token || user || loading) return;
    setLoading(true);
    api
      .get("/api/auth/me")
      .then((res) => {
        const next = res?.data?.user;
        if (next) {
          updateAuthUser(next);
          setUser(next);
        }
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setLoading(false));
  }, [user, loading]);

  function onSignedIn(u: AuthUser) {
    setUser(u);
    setAuthMode(null);
    const label = u.displayName || u.username || u.email || "account";
    toast.success("Signed in", `Welcome back, ${label}`, 2500);
  }

  function signOut() {
    clearAuth();
    setUser(null);
    setOpen(false);
    toast.info("Signed out", undefined, 2000);
  }

  const label =
    user?.displayName ||
    user?.username ||
    user?.email ||
    (user?.address ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : "Account");
  const initials = label.slice(0, 2).toUpperCase();
  const profileId = user?.username || user?.address || user?.id || "me";

  return (
    <div className="relative inline-flex w-full sm:w-auto items-center">
      {user ? (
        <>
          <button
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="inline-flex w-full sm:w-auto items-center justify-between gap-2 rounded-lg px-3 py-1.5 bg-surface border"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="w-8 h-8 rounded-full neon-ring flex items-center justify-center bg-gradient-to-br" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}>
              <span className="text-xs font-mono text-bg">{initials || "??"}</span>
            </div>

            <div className="hidden sm:block text-left min-w-0">
              <div className="text-sm font-medium text-text truncate">{label}</div>
              <div className="text-xs subtle">{user?.username ? "Member" : "Account"}</div>
            </div>
          </button>

          {open && (
            <div className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+7rem)] max-h-[calc(100vh-10rem)] overflow-y-auto rounded-lg bg-surface/95 backdrop-blur-sm border border-white/6 shadow-lg z-50 sm:fixed sm:left-auto sm:right-6 sm:top-[calc(env(safe-area-inset-top)+7rem)] sm:max-h-[calc(100vh-8rem)] sm:w-48">
              <div className="p-2">
                <div className="py-2">
                  <Link to={`/profile/${profileId}`} className="block px-3 py-2 rounded-md hover:bg-surface/80 text-text">Profile</Link>
                  <Link to="/dashboard" className="block px-3 py-2 rounded-md hover:bg-surface/80 text-text">Dashboard</Link>
                  <Link to="/settings" className="block px-3 py-2 rounded-md hover:bg-surface/80 text-text">Settings</Link>
                </div>

                <div className="pt-2 border-t border-white/6">
                  <button onClick={signOut} className="w-full text-left px-3 py-2 rounded-md hover:bg-surface/80 text-text">
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="hidden sm:inline-flex gap-2">
            <button onClick={() => setAuthMode("login")} className="px-3 py-1.5 rounded-md border text-text">
              Sign in
            </button>
            <button onClick={() => setAuthMode("register")} className="btn-primary">
              Create account
            </button>
          </div>

          <div className="inline-flex sm:hidden w-full">
            <button onClick={() => setAuthMode("login")} className="w-full px-3 py-1.5 rounded-md border">
              Account
            </button>
          </div>
        </>
      )}

      {authMode && <SignInModal defaultMode={authMode} onClose={() => setAuthMode(null)} onSignedIn={onSignedIn} />}
    </div>
  );
}
