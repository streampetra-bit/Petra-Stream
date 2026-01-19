// src/components/Navbar.tsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../assets/logo.svg?url";
import ThemeToggle from "./ThemeToggle";
import WalletConnect from "./WalletConnect";
import UserDropdown from "./UserDropdown";

export default function Navbar(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const navigate = useNavigate();

  function onSubmitSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/?q=${encodeURIComponent(q)}`);
    setQuery("");
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/70 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-1">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              <img src={Logo} alt="Petra Stream logo" className="w-7 h-7 brightness-110" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-extrabold text-text leading-tight">Petra Stream</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Live on Somnia</div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-subtle">
            <Link to="/" className="text-primary">
              Home
            </Link>
            <Link to="/explore" className="hover:text-primary transition-colors">
              Explore
            </Link>
            <Link to="/categories" className="hover:text-primary transition-colors">
              Categories
            </Link>
          </nav>

          <form onSubmit={onSubmitSearch} className="relative hidden lg:flex items-center flex-1 max-w-md">
            <span className="absolute left-3 text-subtle">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search streams..."
              aria-label="Search streams"
              className="w-full rounded-full border border-white/10 bg-surface/70 px-10 py-2 text-sm text-text placeholder:subtle focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
            <span className="absolute right-3 rounded-md bg-bg/70 px-2 py-0.5 text-[10px] font-semibold text-subtle">
              S
            </span>
          </form>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/create"
            className="hidden md:inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
            </svg>
            Create
          </Link>

          <Link
            to="/notifications"
            className="hidden md:inline-flex items-center justify-center p-2 rounded-full border border-white/10 bg-surface/70 hover:brightness-110 transition"
            aria-label="Notifications"
            title="Notifications"
          >
            <span className="relative">
              <svg className="h-5 w-5 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" />
              </svg>
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-bg/60" />
            </span>
          </Link>

          <div className="hidden md:block h-6 w-px bg-white/10" />

          <div className="hidden md:block">
            <WalletConnect />
          </div>

          <div className="hidden md:block">
            <UserDropdown />
          </div>

          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          <button
            onClick={() => setOpen((s) => !s)}
            className="inline-flex items-center justify-center p-2 rounded-full md:hidden border border-white/10 bg-surface/70"
            aria-expanded={open}
            aria-label="Open menu"
          >
            {open ? (
              <svg className="h-6 w-6 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-bg/95">
          <div className="px-6 py-4 space-y-4">
            <form onSubmit={onSubmitSearch} className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
                </svg>
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search streams..."
                className="w-full rounded-full border border-white/10 bg-surface/70 px-10 py-2 text-sm text-text placeholder:subtle"
              />
            </form>

            <div className="flex flex-col gap-1">
              <Link to="/" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/5 transition">
                Home
              </Link>
              <Link to="/explore" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/5 transition">
                Explore
              </Link>
              <Link to="/categories" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/5 transition">
                Categories
              </Link>
              <Link to="/notifications" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/5 transition">
                Notifications
              </Link>
              <Link
                to="/create"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary/15 px-4 py-2 text-sm font-semibold text-primary"
              >
                Create
              </Link>
            </div>

            <div className="pt-2">
              <WalletConnect />
            </div>

            <div className="pt-2">
              <UserDropdown />
            </div>

            <div className="pt-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
