// src/components/UserDropdown.tsx
import React from "react";
import clsx from "clsx";
import SignInModal from "./SignInModal";
import { useToast } from "../contexts/ToastContext";
import { Link } from "react-router-dom";

/**
 * Simple app-level user management using localStorage (UI-only).
 * - 'app_user' localStorage value is { username: string, avatar?: string }
 * This keeps the Navbar UX testable before you implement backend auth.
 */

type AppUser = { username: string; avatar?: string } | null;

function readUser(): AppUser {
  try {
    const raw = localStorage.getItem("app_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function UserDropdown(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [user, setUser] = React.useState<AppUser>(readUser());
  const [showSignIn, setShowSignIn] = React.useState(false);
  const toast = useToast();

  React.useEffect(() => {
    setUser(readUser());
  }, []);

  function onSignedIn(u: { username: string; avatar?: string }) {
    localStorage.setItem("app_user", JSON.stringify(u));
    setUser(u);
    setShowSignIn(false);
    toast.success("Signed in", `Welcome back, ${u.username}`, 2500);
  }

  function signOut() {
    localStorage.removeItem("app_user");
    setUser(null);
    setOpen(false);
    toast.info("Signed out", undefined, 2000);
  }

  return (
    <div className="relative inline-flex items-center">
      {user ? (
        <>
          <button
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 bg-surface border"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="w-8 h-8 rounded-full neon-ring flex items-center justify-center bg-gradient-to-br" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}>
              <span className="text-xs font-mono text-bg">{(user.username || "??").slice(0, 2).toUpperCase()}</span>
            </div>

            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-text truncate">{user.username}</div>
              <div className="text-xs subtle">Account</div>
            </div>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-44 rounded-lg bg-surface/95 backdrop-blur-sm border border-white/6 shadow-lg z-50">
              <div className="p-2">
                <div className="py-2">
                  <Link to="/profile" className="block px-3 py-2 rounded-md hover:bg-surface/80 text-text">Profile</Link>
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
            <button onClick={() => setShowSignIn(true)} className="px-3 py-1.5 rounded-md border text-text">
              Sign in
            </button>
            <button onClick={() => setShowSignIn(true)} className="btn-primary">
              Create account
            </button>
          </div>

          <div className="inline-flex sm:hidden">
            <button onClick={() => setShowSignIn(true)} className="px-3 py-1.5 rounded-md border">
              Account
            </button>
          </div>
        </>
      )}

      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onSignedIn={onSignedIn} />}
    </div>
  );
}
