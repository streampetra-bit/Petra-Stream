// src/components/Sidebar.tsx
import React, { useEffect, useState } from "react";
import SidebarItem from "./SidebarItem";
import clsx from "clsx";
import { useToast } from "../contexts/ToastContext";
import { Link, useLocation } from "react-router-dom";
import api from "../lib/api";

/**
 * Sidebar
 *
 * - Collapsible (persisted)
 * - Drawer on mobile
 * - Shows categories, trending tags, top streamers, recently watched
 *
 * Usage:
 * <div className="flex">
 *   <Sidebar />
 *   <main className="flex-1">...</main>
 * </div>
 */

type Streamer = { id: string; name: string; viewers?: number; avatar?: string; address?: string };

const defaultCategories = [
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
];

const defaultTrending = ["chill", "onchain", "live-coding", "music", "nft"];

export default function Sidebar({
  apiPrefix = "/api",
  initialCollapsed = false,
  className,
}: {
  apiPrefix?: string; // optional base to fetch (if you want live data)
  initialCollapsed?: boolean;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("sidebar_collapsed");
      return raw ? JSON.parse(raw) : initialCollapsed;
    } catch {
      return initialCollapsed;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(defaultCategories);
  const [trending, setTrending] = useState<string[]>(defaultTrending);
  const [topStreamers, setTopStreamers] = useState<Streamer[]>([]);
  const [recent, setRecent] = useState<Streamer[]>(() => {
    try {
      const raw = localStorage.getItem("recent_watched");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const toast = useToast();
  const location = useLocation();

  useEffect(() => {
    // Persist collapsed state
    try {
      localStorage.setItem("sidebar_collapsed", JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    // Try fetching categories/top streamers/trending if backend available,
    // otherwise keep placeholders.
    (async () => {
      try {
        const catRes = await api.get(`${apiPrefix}/categories`).catch(() => null);
        if (catRes?.data?.data) setCategories(catRes.data.data);

        const trendRes = await api.get(`${apiPrefix}/trending`).catch(() => null);
        if (trendRes?.data?.data) setTrending(trendRes.data.data);

        const topRes = await api.get(`${apiPrefix}/streams/top`).catch(() => null);
        if (topRes?.data?.data) setTopStreamers(topRes.data.data.slice(0, 6));
        else if (Array.isArray(topRes?.data)) setTopStreamers(topRes.data.slice(0, 6));
      } catch {
        // ignore - fall back to defaults
      }
    })();
  }, [apiPrefix]);

  function followStreamer(s: Streamer) {
    // small UI feedback; real follow flow would call API & auth
    toast.success("Following", `You're now following ${s.name}`, 2000);
  }

  function addRecent(s: Streamer) {
    try {
      const next = [s, ...recent.filter((r) => r.id !== s.id)].slice(0, 8);
      setRecent(next);
      localStorage.setItem("recent_watched", JSON.stringify(next));
    } catch {}
  }

  // expose a helper to mark a stream as recently watched:
  useEffect(() => {
    // If the location is a stream route, add to recent automatically.
    // This attempts to detect /stream/:id by url; adjust to your routes.
    const m = location.pathname.match(/\/stream\/([^/]+)/);
    if (m) {
      const id = m[1];
      // we add a lightweight placeholder entry
      addRecent({ id, name: id, viewers: 0 });
    }
  }, [location.pathname]); // eslint-disable-line

  const navCompact = collapsed;

  // compute safeTopStreamers to avoid inline ternary complexity in JSX
  const fallbackTop = [
    { id: "alice", name: "alice", viewers: 240 },
    { id: "bob", name: "bob", viewers: 180 },
    { id: "carol", name: "carol", viewers: 140 },
  ] as Streamer[];

  const shownTop = (topStreamers && topStreamers.length > 0 ? topStreamers : fallbackTop).slice(
    0,
    navCompact ? 3 : 6
  );

  return (
    <>
      {/* Mobile drawer overlay */}
      <div className={clsx("md:hidden", drawerOpen ? "fixed inset-0 z-40" : "hidden")} aria-hidden={!drawerOpen}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
      </div>

      {/* Sidebar container */}
      <aside
        className={clsx(
          "hidden md:flex flex-col h-screen sticky top-16 p-4 gap-4 bg-bg",
          navCompact ? "w-20" : "w-72",
          "transition-all",
          className
        )}
        aria-label="Sidebar navigation"
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-text">{navCompact ? "PS" : "Explore"}</div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed((s) => !s)}
              className="p-1 rounded-md border"
              title={collapsed ? "Expand" : "Collapse"}
              aria-pressed={collapsed}
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              {collapsed ? "⯈" : "⯆"}
            </button>

            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1 rounded-md border md:hidden"
              aria-label="Open mobile menu"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Primary nav: categories */}
        <nav className="space-y-2">
          <div className="text-xs subtle px-1">{navCompact ? "" : "Categories"}</div>
          <div className="grid gap-2">
            {categories.map((c) => (
              <SidebarItem
                key={c.id}
                compact={navCompact}
                label={c.label}
                icon={
                  <svg className="h-5 w-5 text-text" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3 6 6 .5-4.5 3.5L19 20l-7-4-7 4 1.5-7L2 8.5 8 8l3-6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                onClick={() => {
                  // navigate to category (adjust route if needed)
                  window.location.href = `/explore?category=${encodeURIComponent(c.id)}`;
                }}
              />
            ))}
          </div>
        </nav>

        {/* Trending tags */}
        <div>
          <div className="text-xs subtle px-1">{navCompact ? "" : "Trending"}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {trending.map((t) => (
              <button
                key={t}
                onClick={() => (window.location.href = `/explore?tag=${encodeURIComponent(t)}`)}
                className={clsx("text-xs px-2 py-1 rounded-md", navCompact ? "hidden" : "bg-bg/10")}
                title={`Search tag ${t}`}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>

        {/* Top streamers */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs subtle px-1">{navCompact ? "" : "Top streamers"}</div>
            {!navCompact && (
              <Link to="/top" className="text-xs subtle">
                View all
              </Link>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {shownTop.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <Link to={`/profile/${s.id}`} className="inline-flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md neon-ring flex items-center justify-center bg-surface/60">
                    <span className="text-xs font-mono">{(s.name || "??").slice(0, 2).toUpperCase()}</span>
                  </div>
                  {!navCompact && <div className="text-sm text-text">{s.name}</div>}
                </Link>

                {!navCompact && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs subtle">{s.viewers ?? 0}</div>
                    <button onClick={() => followStreamer(s as any)} className="px-2 py-1 rounded-md border text-xs">
                      Follow
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recently watched */}
        <div className="mt-auto">
          <div className="text-xs subtle px-1">{navCompact ? "" : "Recently watched"}</div>
          <div className="mt-2 space-y-2">
            {recent.length ? (
              recent.map((r) => (
                <Link key={r.id} to={`/stream/${r.id}`} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface/70">
                  <div className="w-8 h-8 rounded-md neon-ring flex items-center justify-center bg-surface/60">
                    <span className="text-xs font-mono">{(r.name || "??").slice(0, 2).toUpperCase()}</span>
                  </div>
                  {!navCompact && <div className="text-sm text-text">{r.name}</div>}
                </Link>
              ))
            ) : (
              <div className="text-xs subtle px-2 py-2">No recent streams</div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile drawer content (same structure as sidebar but in a drawer) */}
      {drawerOpen && (
        <div className="fixed z-50 inset-y-0 left-0 w-80 bg-bg/95 p-4 shadow-lg md:hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-text">Explore</div>
            <button onClick={() => setDrawerOpen(false)} className="p-1 rounded border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              ✕
            </button>
          </div>

          <div className="space-y-4 overflow-auto h-[calc(100vh-120px)]">
            <div>
              <div className="text-xs subtle mb-2">Categories</div>
              <div className="grid gap-2">
                {categories.map((c) => (
                  <SidebarItem key={c.id} label={c.label} onClick={() => (window.location.href = `/explore?category=${encodeURIComponent(c.id)}`)} />
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs subtle mb-2">Trending</div>
              <div className="flex flex-wrap gap-2">
                {trending.map((t) => (
                  <button key={t} onClick={() => (window.location.href = `/explore?tag=${encodeURIComponent(t)}`)} className="text-xs px-2 py-1 rounded-md bg-bg/10">
                    #{t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs subtle mb-2">Top streamers</div>
              <div className="space-y-2">
                {(
                  (topStreamers && topStreamers.length > 0 ? topStreamers : [
                    { id: "alice", name: "alice", viewers: 240 },
                    { id: "bob", name: "bob", viewers: 180 },
                  ] as Streamer[])
                ).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <Link to={`/profile/${s.id}`} className="inline-flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md neon-ring flex items-center justify-center bg-surface/60">
                        <span className="text-xs font-mono">{(s.name || "??").slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="text-sm text-text">{s.name}</div>
                    </Link>

                    <button onClick={() => followStreamer(s as any)} className="px-2 py-1 rounded-md border text-xs">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs subtle mb-2">Recently watched</div>
              <div className="space-y-2">
                {recent.length ? (
                  recent.map((r) => (
                    <Link key={r.id} to={`/stream/${r.id}`} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface/70">
                      <div className="w-8 h-8 rounded-md neon-ring flex items-center justify-center bg-surface/60">
                        <span className="text-xs font-mono">{(r.name || "??").slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="text-sm text-text">{r.name}</div>
                    </Link>
                  ))
                ) : (
                  <div className="text-xs subtle">No recent streams</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
