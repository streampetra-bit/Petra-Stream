// src/components/Sidebar.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { readAuthUser } from "../lib/auth";

type Streamer = { id: string; name: string; viewers?: number; avatar?: string; address?: string };

const defaultCategories = [
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
];

const defaultTrending = ["chill", "onchain", "live-coding", "music", "nft"];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #fb7185, #f97316)",
  "linear-gradient(135deg, #38bdf8, #6366f1)",
  "linear-gradient(135deg, #34d399, #14b8a6)",
  "linear-gradient(135deg, #fbbf24, #f97316)",
  "linear-gradient(135deg, #a78bfa, #ec4899)",
];

function formatNumber(n?: number) {
  if (n === null || n === undefined) return "--";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

function mapTop(rows: any[]): Streamer[] {
  return rows.map((row, index) => {
    const id = row?.streamer || row?.username || row?.address || row?.id || `streamer-${index}`;
    const name = row?.streamer || row?.username || row?.address || row?.id || "streamer";
    return {
      id: String(id),
      name: String(name),
      viewers: Number(row?.viewerCount ?? row?.viewers ?? 0),
      avatar: row?.avatar,
    };
  });
}

function getCategoryIcon(id: string) {
  switch (id) {
    case "gaming":
      return (
        <svg className="h-4 w-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 15h2m6 0h2M12 6a6 6 0 00-6 6v3a3 3 0 003 3h6a3 3 0 003-3v-3a6 6 0 00-6-6z" />
        </svg>
      );
    case "music":
      return (
        <svg className="h-4 w-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "art":
      return (
        <svg className="h-4 w-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3a9 9 0 100 18 4 4 0 004-4h-1a3 3 0 01-3-3 3 3 0 013-3h1a4 4 0 00-4-4z" />
        </svg>
      );
    case "tech":
      return (
        <svg className="h-4 w-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
        </svg>
      );
    case "finance":
      return (
        <svg className="h-4 w-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M6 7v10a2 2 0 002 2h8a2 2 0 002-2V7" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
        </svg>
      );
  }
}

export default function Sidebar({
  apiPrefix = "/api",
  className,
}: {
  apiPrefix?: string;
  className?: string;
}) {
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(defaultCategories);
  const [trending, setTrending] = useState<string[]>(defaultTrending);
  const [topStreamers, setTopStreamers] = useState<Streamer[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [authUser, setAuthUser] = useState(readAuthUser());
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
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const catRes = await api.get(`${apiPrefix}/categories`).catch(() => null);
        if (catRes?.data?.data) setCategories(catRes.data.data);

        const trendRes = await api.get(`${apiPrefix}/trending`).catch(() => null);
        if (trendRes?.data?.data) setTrending(trendRes.data.data);

        const topRes = await api.get(`${apiPrefix}/streams/top`).catch(() => null);
        if (topRes?.data?.data) setTopStreamers(mapTop(topRes.data.data));
        else if (Array.isArray(topRes?.data)) setTopStreamers(mapTop(topRes.data));
      } catch {
        // ignore and fall back to defaults
      }
    })();
  }, [apiPrefix]);

  useEffect(() => {
    if (!authUser || topStreamers.length === 0) return;
    let active = true;
    (async () => {
      try {
        const results = await Promise.all(
          topStreamers.map(async (s) => {
            const res = await api
              .get(`/api/users/${encodeURIComponent(s.id)}/following`)
              .catch(() => null);
            return res?.data?.following ? s.id : null;
          })
        );
        if (!active) return;
        const next = new Set(results.filter(Boolean) as string[]);
        setFollowed(next);
      } catch {
        // ignore follow state errors
      }
    })();
    return () => {
      active = false;
    };
  }, [authUser, topStreamers]);

  async function followStreamer(s: Streamer) {
    if (!authUser) {
      toast.info("Sign in required", "Please sign in to follow creators.", 2500);
      return;
    }
    const prev = followed;
    const isFollowing = prev.has(s.id);
    const next = new Set(prev);
    if (isFollowing) {
      next.delete(s.id);
    } else {
      next.add(s.id);
    }
    setFollowed(next);
    try {
      await api
        .post(`/api/users/${encodeURIComponent(s.id)}/follow`, { action: isFollowing ? "unfollow" : "follow" })
        .catch(() => null);
      toast.success(isFollowing ? "Unfollowed" : "Followed", undefined, 2000);
    } catch {
      toast.error("Action failed", undefined, 2000);
      setFollowed(prev);
    }
  }

  function addRecent(s: Streamer) {
    try {
      const next = [s, ...recent.filter((r) => r.id !== s.id)].slice(0, 8);
      setRecent(next);
      localStorage.setItem("recent_watched", JSON.stringify(next));
    } catch {
      // ignore storage issues
    }
  }

  useEffect(() => {
    const match = location.pathname.match(/\/stream\/([^/]+)/);
    if (match) {
      const id = match[1];
      addRecent({ id, name: id, viewers: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const fallbackTop: Streamer[] = [
    { id: "alice.eth", name: "Alice.eth", viewers: 240 },
    { id: "bob.lens", name: "Bob.lens", viewers: 180 },
    { id: "carol.sol", name: "Carol.sol", viewers: 140 },
  ];

  const shownTop = useMemo(
    () => (topStreamers.length ? topStreamers : fallbackTop).slice(0, 3),
    [topStreamers]
  );

  return (
    <aside
      className={`hidden xl:block w-64 shrink-0 h-[calc(100vh-110px)] sticky top-24 overflow-y-auto pr-4 ${className || ""}`}
      aria-label="Sidebar navigation"
    >
      <div className="space-y-8">
        <div>
          <h3 className="text-xs font-bold text-subtle uppercase tracking-[0.3em] mb-4">Categories</h3>
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/explore?category=${encodeURIComponent(c.id)}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text hover:bg-white/5 transition"
                >
                  <span className="h-8 w-8 rounded-xl bg-surface/60 flex items-center justify-center">
                    {getCategoryIcon(c.id)}
                  </span>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold text-subtle uppercase tracking-[0.3em] mb-4">Trending</h3>
          <div className="flex flex-wrap gap-2">
            {trending.slice(0, 6).map((tag) => (
              <Link
                key={tag}
                to={`/explore?tag=${encodeURIComponent(tag)}`}
                className="text-xs rounded-full bg-surface/70 px-3 py-1.5 text-subtle hover:text-primary hover:bg-white/5 transition"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-subtle uppercase tracking-[0.3em]">Top Streamers</h3>
            <Link to="/top" className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-4">
            {shownTop.map((s, index) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <Link to={`/profile/${s.id}`} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                    style={{ background: AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length] }}
                  >
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text leading-tight">{s.name}</div>
                    <div className="text-[10px] text-subtle mt-1 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {formatNumber(s.viewers)} watching
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => followStreamer(s)}
                  className="text-[10px] px-3 py-1.5 rounded-full border border-white/10 font-bold hover:bg-primary hover:border-primary hover:text-bg transition"
                >
                  {followed.has(s.id) ? "Following" : "Follow"}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {recent.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-subtle uppercase tracking-[0.3em] mb-4">Recently watched</h3>
            <div className="space-y-2">
              {recent.slice(0, 4).map((r, index) => (
                <Link
                  key={r.id}
                  to={`/stream/${r.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md"
                    style={{ background: AVATAR_GRADIENTS[(index + 2) % AVATAR_GRADIENTS.length] }}
                  >
                    {r.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-sm text-text truncate">{r.name}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
