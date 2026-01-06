// src/components/Navbar.tsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../assets/logo.svg?url";
import ThemeToggle from "./ThemeToggle";
import WalletConnect from "./WalletConnect";
import UserDropdown from "./UserDropdown";
import clsx from "clsx";

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
    <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-xl border-b border-white/6">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg neon-ring"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              <img src={Logo} alt="logo" className="w-7 h-7 brightness-110" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-extrabold text-text leading-tight">Petra Stream</div>
              <div className="text-xs muted">Live on Somnia</div>
            </div>
          </Link>
        </div>

        {/* Desktop center: search + nav */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          <form onSubmit={onSubmitSearch} className="relative flex-1 max-w-xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search streams, creators, tags..."
              aria-label="Search streams"
              className="w-full rounded-full border border-white/6 bg-surface/80 px-4 py-2 pr-10 text-sm text-text placeholder:subtle focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 hover:bg-surface/70"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
              </svg>
            </button>
          </form>

          <nav className="flex items-center gap-3 text-text font-medium">
            <Link to="/" className="px-3 py-1.5 rounded-md hover:text-accent transition-colors">
              Home
            </Link>
            <Link to="/explore" className="px-3 py-1.5 rounded-md hover:text-accent transition-colors">
              Explore
            </Link>
            <Link to="/categories" className="px-3 py-1.5 rounded-md hover:text-accent transition-colors">
              Categories
            </Link>
            <Link
              to="/create"
              className="px-3 py-1.5 rounded-md btn-primary text-sm font-semibold shadow-md hover:opacity-95"
            >
              Create
            </Link>
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* notifications */}
          <Link
            to="/notifications"
            className="hidden md:inline-flex items-center justify-center p-2 rounded-lg border border-white/6 bg-surface/80 hover:brightness-105 transition"
            aria-label="Notifications"
            title="Notifications"
          >
            <span className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" />
              </svg>
              <span className="absolute -top-1 -right-1 inline-flex h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white/6" />
            </span>
          </Link>

          {/* theme toggle */}
          <div className="hidden sm:inline-flex">
            <ThemeToggle />
          </div>

          {/* wallet */}
          <div className="hidden md:block">
            <WalletConnect />
          </div>

          {/* user dropdown */}
          <div className="hidden md:block">
            <UserDropdown />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((s) => !s)}
            className="inline-flex items-center justify-center p-2 rounded-md md:hidden border border-white/6 bg-surface/80 hover:brightness-105 transition"
            aria-expanded={open}
            aria-label="Open menu"
          >
            {open ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/6 bg-bg/95 text-text">
          <div className="px-4 py-4 space-y-3">
            <form onSubmit={onSubmitSearch} className="w-full">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search streams, creators..."
                  className="w-full rounded-full border border-white/6 bg-surface/80 px-4 py-2 pr-10 text-text placeholder:subtle focus:outline-none"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
                  </svg>
                </button>
              </div>
            </form>

            <div className="flex flex-col gap-1">
              <Link to="/" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-surface/80 transition">
                Home
              </Link>
              <Link to="/explore" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-surface/80 transition">
                Explore
              </Link>
              <Link to="/categories" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-surface/80 transition">
                Categories
              </Link>
              <Link to="/notifications" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-surface/80 transition">
                Notifications
              </Link>
              <Link
                to="/create"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md btn-primary text-center font-semibold shadow-md hover:opacity-95"
              >
                Create
              </Link>
            </div>

            <div className="pt-2">
              <WalletConnect />
            </div>

            <div className="pt-2">
              <ThemeToggle />
            </div>

            <div className="pt-2">
              <UserDropdown />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
