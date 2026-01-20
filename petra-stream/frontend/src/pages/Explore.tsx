// src/pages/Explore.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "../lib/api";

const FALLBACK_CATEGORIES = [
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
];

const FALLBACK_TAGS = ["chill", "onchain", "live-coding", "music", "nft"];

const CATEGORY_IMAGES: Record<string, string> = {
  gaming:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCOOiSUAZxlZg44ZMEy5XwR80MxzDoKD0gmX9liyl6OCTSzk04EyJiV2eYzJ3fyj7qrF3dT6zhTkYHfc70k7K_bw2UfD3hP2_6__nv0AMpErBuI3_LJkcfyY8ILU-2xJ5zLAA5yizvfkAaDoRP0w7bHPNiXsGGR1ckJeVTdsS0_Hh1kxwxCuqGqJ5ow1NejuIFuKzNkZ1h1zHlILNnKD_h-qs3yADF2K_lOG7PmzAkBcq676-zdY9-75MpT5fd1YV0C2XOq2bJo4wE",
  music:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAidj3llHFDXVsA-QoLIrl0VCalUqT272_6vuW7yKRXgGAgAqxckHv9OA0ArAf64odFkTbFevb0uAAy0A6LUgEVPfeqJmX4t5vEKqvB-fzLFzROw3Ly5I9Kn173cTN8HWw9XCHPzwFyqnzxsc5iShFgDX_-HtmU1Np7eLAWeJwawsU3VUzNH6EIa5dxzMK202WYrC1HQQ8TEriopAeEwDGB9Dx9wprYAZLPXUOGwVRo2oOpX6nYS2tAMw1RL-XD4m4-yomh4H40hqQ",
  tech:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCdVfxFpKxduYp_quiomVvzkrRWKOWzsrexoCEMPH4qQrAeWwx1xR54NlcFwNkmJHRKqKNsNtVKK9qZ_tAfKo56jk51TUO9k34ny_R9NFyGKmTpVjKQkwLJ0d3Kp-0djXBk4Vh20auJcdlbmd_czG1UgjjgUFWNWi1MN7m6O3g9QnQPBGV8n4MbxE4nWIcLmNYa48qm1KaJ75hUpWO0lf_hl9lbsx2fDQiSf-PguJDTTei0dxLX4BFhnKfGoxciohMlEqkL2peYyek",
  art:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDE-TOdrVccih_rJ9yADvjpxI7_w0U3O9l9cy1ZlRcv0TlPVOR5pgigqUIg5EeKZq2d0kZcrGWuRJIiaj4N3P-EZhdoxy9xAvFRDe4cpFo4HP95MZDcKT-XKN5J9mu0r5pXB-WI3iZeZKSSTJTfRsXpGJyqYF_dCTh_CzVo-ehe-F-brSi1HVCLdSXxkTmcL0vWN2iTQycu1hhesHK-GZMTXDpuWDJJ7piCq_2-HdyM2l4h0vbzR6HrXChpVxBuTPXz_I2IYbM7Q4A",
};

const STREAM_FALLBACKS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBLW7LUPldD0zMF4w834bcsWdBUvNlApescMtGzJIqAYexmWWFDWuVzo3NuwpfM61ydRsPm36oUsvfp3oQPUAOhdaEZ5G3uN3ILJuW6n5Bi3luvD8hxTAfKUkDSxob1eB6xro72eIOPALHxB-8sLUCFyWUA-huGc-iqX3u2nyf7a_rvzjDdN3pV0Jx_v-BRfBg8DSZG2-MFV2eAVPPBdog0YOXTju_kEavE1ZSkp3X0mK1wYugmhY9MiyHTXOaPaw7KM0p5Xokc3nE",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDeU5dwzj0PdqohzGoBASAEMVfGyEapT5iC6dExq0fAjwUhfMcEtOsIs9FMF1CQT4-PieUKpIej_wFtA1V456VXvAd40Y_kgFEnTdarWPreTO6v43CUJWQzPdcX-64kAjzRJ9B8WGbNiaGX8BhpDQaZ5T3GfIXsjjVeoMpaC9NocDjw0M4ANPcogNphI9igML8B-Vi54B8l1Unw4Y3qhXe5YJhsAss4T_rlz6TxzcTvESDGAO01kbsnHhDhedhFZbAPH9AgLfodoZg",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAJHgp54eanf3NYUIey-GZYo7iSBPnfxDx7Z6hAcxBgva6Z_-s085ioTz3SzDm9HHvwNJF-VJFeyMV6ffY38T5qndQ8BeK5NcskYxtNqHLRN4J2VPbWPUSLI3LwA03-uUx0uX8f_QxyJK4_r_T6BwDDVwnrFkW0tWPdpRcVf8vr91n6IRD4wK9virzXnJQHix89wA_qJ9Aur9FMei0u64TZUaq-0QF6UirA5gvcKuKvHMxaBdigCZ1vh4KkUcif970WFIsiLKMkXKg",
];

function formatNumber(n?: number) {
  if (!n && n !== 0) return "--";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

function formatRelativeTime(ms: number) {
  if (!ms || Number.isNaN(ms)) return "Unknown";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Explore(): JSX.Element {
  const location = useLocation();
  const [streams, setStreams] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(FALLBACK_CATEGORIES);
  const [tags, setTags] = useState<string[]>(FALLBACK_TAGS);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"trending" | "recent">("trending");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedCategory = params.get("category");
  const selectedTag = params.get("tag");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/streams/active").catch(() => null);
        if (res?.data) setStreams(res.data);
      } catch {
        setStreams([]);
      } finally {
        setLoading(false);
      }
    })();

    (async () => {
      try {
        const catRes = await api.get("/api/categories").catch(() => null);
        if (catRes?.data?.data) setCategories(catRes.data.data);
      } catch {
        // ignore
      }
    })();

    (async () => {
      try {
        const tagRes = await api.get("/api/trending").catch(() => null);
        if (tagRes?.data?.data) setTags(tagRes.data.data);
      } catch {
        // ignore
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return streams.filter((s) => {
      const tagsList = Array.isArray(s.tags) ? s.tags : [];
      if (selectedCategory && !tagsList.includes(selectedCategory)) return false;
      if (selectedTag && !tagsList.includes(selectedTag)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        s.title,
        s.description,
        s.streamer,
        s.category,
        tagsList.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [streams, selectedCategory, selectedTag, query]);

  const ordered = useMemo(() => {
    const next = [...filtered];
    if (sortMode === "trending") {
      next.sort((a, b) => {
        const aViewers = Number(a.viewers ?? a.viewerCount ?? a.viewer_count ?? 0);
        const bViewers = Number(b.viewers ?? b.viewerCount ?? b.viewer_count ?? 0);
        return bViewers - aViewers;
      });
      return next;
    }
    next.sort((a, b) => {
      const aStart = Date.parse(a.startedAt ?? a.started_at ?? a.createdAt ?? a.created_at ?? "") || 0;
      const bStart = Date.parse(b.startedAt ?? b.started_at ?? b.createdAt ?? b.created_at ?? "") || 0;
      return bStart - aStart;
    });
    return next;
  }, [filtered, sortMode]);

  const featuredCategories = useMemo(() => {
    const source = categories.length ? categories : FALLBACK_CATEGORIES;
    const orderedList = [...source].sort((a, b) => {
      const aScore = CATEGORY_IMAGES[a.id] ? 0 : 1;
      const bScore = CATEGORY_IMAGES[b.id] ? 0 : 1;
      return aScore - bScore;
    });
    return orderedList.slice(0, 4).map((c, index) => ({
      ...c,
      image: CATEGORY_IMAGES[c.id] || Object.values(CATEGORY_IMAGES)[index % Object.values(CATEGORY_IMAGES).length],
    }));
  }, [categories]);

  const totalLive = ordered.length;

  return (
    <section className="relative explore-page">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(at 0% 0%, rgba(0, 163, 255, 0.2) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.16) 0px, transparent 55%), radial-gradient(at 50% 100%, rgba(0, 163, 255, 0.08) 0px, transparent 55%)",
          }}
        />
        <div className="absolute -top-24 right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-24 left-[-5%] h-[420px] w-[420px] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="space-y-12">
        <header className="space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
                Explore feed
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text">Explore</h1>
              <p className="text-sm md:text-base text-subtle max-w-2xl">
                Discover the next generation of creators on the decentralized web. Crystal clear streams and direct
                ownership in one place.
              </p>
            </div>
            <div className="w-full max-w-xl">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                    />
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-surface/60 py-2.5 pl-11 pr-4 text-sm text-text placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Search streams, artists, or tokens..."
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCategory || selectedTag ? (
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                Clear filters
              </Link>
            ) : null}
            {tags.slice(0, 8).map((t) => (
              <Link
                key={t}
                to={`/explore?tag=${encodeURIComponent(t)}`}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  selectedTag === t ? "border-primary/60 bg-primary/10 text-primary" : "border-white/10 text-subtle"
                }`}
              >
                #{t}
              </Link>
            ))}
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text">Featured Categories</h2>
            <Link to="/categories" className="text-sm font-semibold text-primary inline-flex items-center gap-2">
              View all
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {featuredCategories.map((c) => (
              <Link
                key={c.id}
                to={`/explore?category=${encodeURIComponent(c.id)}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-surface/60 hover:border-primary/50 transition"
              >
                <img
                  src={c.image}
                  alt={`${c.label} category`}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-xl font-bold text-text">{c.label}</h3>
                  <p className="text-sm text-white/60">
                    {Math.max(1, Math.round((totalLive / (featuredCategories.length || 1)) * (c.id.length / 3)))}k
                    streams live
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
              <h2 className="text-2xl font-bold text-text">Live Now</h2>
              <span className="text-xs text-white/40">({totalLive})</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortMode("trending")}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  sortMode === "trending"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-white/10 text-subtle hover:border-primary/30"
                }`}
              >
                Trending
              </button>
              <button
                type="button"
                onClick={() => setSortMode("recent")}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  sortMode === "recent"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-white/10 text-subtle hover:border-primary/30"
                }`}
              >
                Recently started
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-72 rounded-2xl border border-white/10 bg-surface/60 animate-pulse" />
              ))}
            </div>
          ) : ordered.length === 0 ? (
            <div className="glass-card text-center py-12">
              <div className="text-lg font-semibold">No streams match this filter.</div>
              <p className="muted mt-2">Try a different category, tag, or search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {ordered.map((s, index) => {
                const tagsList = Array.isArray(s.tags) ? s.tags : [];
                const viewers = Number(s.viewers ?? s.viewerCount ?? s.viewer_count ?? 0);
                const startedAtValue = s.startedAt ?? s.started_at ?? s.createdAt ?? s.created_at;
                const startedAt = startedAtValue ? Date.parse(startedAtValue) : 0;
                const thumbnail =
                  s.thumbnail ||
                  s.thumbnailUrl ||
                  s.coverImage ||
                  s.poster ||
                  STREAM_FALLBACKS[index % STREAM_FALLBACKS.length];
                const avatar = s.avatar || s.avatarUrl || s.profileImage;
                const streamer = s.streamer || s.creator || s.handle || s.id || "creator";
                const route = `/stream/${encodeURIComponent(streamer)}`;
                return (
                  <Link
                    key={s.streamer || s.id || index}
                    to={route}
                    className="group rounded-2xl border border-white/10 bg-surface/60 overflow-hidden transition hover:-translate-y-1 hover:shadow-glow-primary"
                  >
                    <div className="relative aspect-video">
                      <img src={thumbnail} alt={s.title || "Stream preview"} className="h-full w-full object-cover" />
                      <div className="absolute top-4 left-4 flex gap-2">
                        <span className="rounded-md bg-red-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          Live
                        </span>
                        {sortMode === "recent" ? (
                          <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Started {formatRelativeTime(startedAt)}
                          </span>
                        ) : (
                          <span className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                            Trending
                          </span>
                        )}
                        <span className="rounded-md border border-white/10 bg-bg/60 px-3 py-1 text-[10px] text-white/80">
                          {formatNumber(viewers)} watching
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-bg/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
                        <div className="rounded-full border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                          <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 5v14l12-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 flex gap-4">
                      <div className="relative flex-shrink-0">
                        <div
                          className="h-12 w-12 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-bg overflow-hidden bg-surface"
                          style={{
                            background: avatar
                              ? `url(${avatar}) center/cover no-repeat`
                              : "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                          }}
                        />
                        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-bg bg-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-text truncate">{s.title || "Untitled stream"}</h3>
                        <p className="text-sm text-subtle truncate">
                          {streamer} • {tagsList[0] || s.category || "Live"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tagsList.slice(0, 3).map((t: string) => (
                            <span
                              key={t}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                  </svg>
                </span>
                <h3 className="text-xl font-bold text-text">Onchain Pulse</h3>
              </div>
              <p className="text-subtle text-sm">
                Total volume traded through stream tips in the last 24h.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 sm:gap-10 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Total Tips</p>
                <p className="text-2xl font-black text-primary">124.5 ETH</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Active Viewers</p>
                <p className="text-2xl font-black text-text">{formatNumber(totalLive * 920 + 4200)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">New Creators</p>
                <p className="text-2xl font-black text-accent">+142</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
