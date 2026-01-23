// src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

type Stream = {
  id?: string;
  streamer?: string;
  title?: string;
  description?: string;
  viewerCount?: number;
  thumbnail?: string;
  tags?: string[];
  status?: "online" | "offline";
  isLive?: boolean;
};

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAGio7GuHoB2zIjpht5l39lhdrUNgtKZmWG2WnR9zckurE2unSbUKtAukkd5_EldwRk_1QTlnEQ_x7w8fgkh4VCBcj08lqHEUd-kRa_GdRqmkxX8aHAk63gHOtX4gHeaQsQ8_p8IP9PMajzjmFNC0Ht-8GhPL3kYAK5pvrvu_7OUDSN0w5AxNeVJzJM2q_aemvzzwlGuQMNmUGHUey9HuyUBktygDispsmAhZRiz8fAHohERo4j4NbvQJEe_axoYU-hkfmk1VS2x10";

const MOCK_STREAMS: Stream[] = [
  {
    id: "s1",
    streamer: "alice.eth",
    title: "Chill coding and tea",
    description: "Pair programming: building a tiny blockchain from scratch.",
    viewerCount: 1200,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAu-7vpriPXc6Ux8x_xav3pBqBLM2JlmvVDjFIfWTMW09mneTOR6hKieyRc4iEQkxKCZMOylDwat3-OIaRhfstNCC6sJDitSXJn20bXZG2TAvtDVUxnlfw74BMKD-UQK28egXTxlQ53TS4epEMpWL_8dqQFMdo3i6RolWfsGoj-VFcB8nAQrei8fsG6IxYhzObIjumpzAIXf_8i1F3-uu6v5fOkdXLP0W4H0z9Z0Pn-zlu6le6HON86FC6GhaPRIWPVfTl3U5f0vP0",
  },
  {
    id: "s2",
    streamer: "bob.lens",
    title: "Synth beats and live visuals",
    description: "Making music with modular synths and generative art.",
    viewerCount: 842,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDzDk1Ktz01Sf_6g9LtXcf-0fmfmNLLrVm-oQjYWGqbbaB1NvFgnVvnW8ItJysB5VpjZNdioXFVG9MxEwpjQ4DRb0qRt9_jw2Cu7j6HCrfKeNh54ioDFZbTHaIAT4oJv1e5RK7yoW7NiEGxYgoIepNoyg6CfjxY3o1Y0WrDrFw7zhjW9BZLSXj8dpkt5RN5wlv3MmX0B9B6v0k_5gXh52Mgp1SS7mPr1mMtGUJia3QYu_THzUVtDEwx0YMBNNjdF5K_9xyFr8rSRmk",
  },
  {
    id: "s3",
    streamer: "carol.sol",
    title: "Retro gaming speedruns",
    description: "Classic platformers and banter - world record attempt.",
    viewerCount: 4100,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDbMVI76w8F_z0mQFJzsj7tY8mYQ0_hDQDpeOhh-dKC-wDeJh8VWC8_7L4pwYlAazPyUpd7Um9dl0HCAPa_2Yzk74YSkVLKPPrpThykvx0o0HGR1EbZP1Q8ECO9fE3uLQqmNZ86i7vvpCBWSWn9CbUo9mRMg7i2HlW3r_c3SAb1eHaksQcn-BMzcS1p8pFgy2P2r_DhICCeOjLeDMf9k0xPlZa4VlfSHo6fPGPlihH6EdFcNQXvCIuvnWDjMrEP0FXEG2297swKKtg",
  },
  {
    id: "s4",
    streamer: "dex.eth",
    title: "Onchain governance talk",
    description: "Breaking down new DAO proposals and voting trends.",
    viewerCount: 2100,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDaCsHBvudXqsCEj6Vxz3H9vdvuYQ_hpn7vVTVGhLYSwiYYcyYHQLmt1hL729_t_gtxKjMgIB-lZEyodmXhkH_ZuileJszuENlBO1TX-oqBuNToaqJPyMTBst8xTDOR6y1ER6ka7_bovsE0OAkHeqKt71I25XvMtlabLKyncjQA6g3UoIRfwgAdXRcShI9gH9OW9f0LctSAkTYS-sGVMjuIO4Cvf-P_w4adwbAGU3XCrMD4JEBTK-YwOolwcG3CP3Z-gurz-fJtRhs",
  },
  {
    id: "s5",
    streamer: "zero.pwn",
    title: "Web3 security audit live",
    description: "Reviewing smart contracts for common vulnerabilities.",
    viewerCount: 560,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDpx36gLJj6VqA3NldfCfvu5ekw5ZLeUcEZyIgLwk04X2JnEde9s5QMKYGvlopvcBrE_C5UdAhdLbkOotD7WGtvA3FyjUOARv79Ltn6gal9te9V7VkRX_eTOlLIW0ByeMkjZtioqWy7mcMVqHmy-Iu6o8PLWyh-UJa3cQkiRh-io-IKXkzStAufRQ5_Vin63c5EFhRFqQtSBrGQx-l13xCj_tiSE_bIIk5bHt0aes9F3TKjCRH8CLvDeBHM3fTW3zWevk8AflZKEa4",
  },
  {
    id: "s6",
    streamer: "maker.art",
    title: "Drawing NFT collection",
    description: "Designing 10k unique traits from scratch.",
    viewerCount: 1800,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuARXPQYuVGy_2KjgL9FIQ9OCXyNXGJACCxbL7_paxPw_-ZKism-t6j6XtY_DAk0yyK-VcKwU9nycZOdx1BSAJtSaGt-mMJ7lLfM25FnS5yv8xkzh816wflcTIvinzewTdW017Yn96w9klkWGC4GRszEjzPH3GFUvGoKT6HyHxTgGCJHkEkn3Jz39jtEnG4dOLwwbmeFUt7gnP0x75XcIXM66xZpVU5Tsu1xBzBiXa-hAdifnhvierf4hHB4aknnw4tVEvFfuMyLTYU",
  },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #10b981, #0d9488)",
  "linear-gradient(135deg, #f97316, #ef4444)",
  "linear-gradient(135deg, #38bdf8, #3b82f6)",
  "linear-gradient(135deg, #d946ef, #ec4899)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
];

function formatNumber(n?: number) {
  if (n === null || n === undefined) return "--";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

function getRoute(stream: Stream) {
  const id = stream.streamer || stream.id || "";
  return `/stream/${encodeURIComponent(id)}`;
}

function getInitials(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!cleaned) return "PS";
  return cleaned.slice(0, 2);
}

function isStreamLive(stream: Stream) {
  if (stream.status) return stream.status === "online";
  if (typeof stream.isLive === "boolean") return stream.isLive;
  return true;
}

function StreamTile({ stream, index, layout }: { stream: Stream; index: number; layout: "grid" | "list" }) {
  const route = getRoute(stream);
  const streamer = stream.streamer || stream.id || "unknown";
  const viewers = stream.viewerCount ?? 0;
  const live = isStreamLive(stream);
  const thumb = stream.thumbnail || HERO_IMAGE;
  const avatar = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  if (layout === "list") {
    return (
      <article className="group flex flex-col sm:flex-row gap-4 rounded-3xl border border-white/10 bg-surface/60 overflow-hidden hover:-translate-y-0.5 transition-transform">
        <Link to={route} className="relative sm:w-64 aspect-video overflow-hidden">
          <img src={thumb} alt={stream.title || "Stream preview"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/20 to-transparent" />
          {live && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          )}
        </Link>
        <div className="flex-1 p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center shadow-lg" style={{ background: avatar }}>
              {getInitials(streamer)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-semibold text-text group-hover:text-primary transition-colors truncate">
                {stream.title || "Untitled stream"}
              </h4>
              <p className="text-sm subtle mt-1 line-clamp-1">{stream.description || "Live stream in progress."}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-subtle">Streamer</span>
                  <span className="font-semibold text-primary">{streamer}</span>
                  <span className="text-subtle">-</span>
                  <span className="text-text">{formatNumber(viewers)} watching</span>
                </div>
                <Link to={route} className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-bg transition-colors">
                  Watch
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group rounded-3xl overflow-hidden border border-white/10 bg-surface/60 hover:-translate-y-1 transition-transform">
      <Link to={route} className="block">
        <div className="relative aspect-video overflow-hidden">
          <img src={thumb} alt={stream.title || "Stream preview"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/70 via-bg/20 to-transparent" />
          {live && (
            <span className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
              <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
              Live
            </span>
          )}
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-bg/40 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A2 2 0 0122 9.618v4.764a2 2 0 01-2.447 1.894L15 14M4 6v12a2 2 0 002 2h10" />
            </svg>
            {formatNumber(viewers)}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center shadow-lg" style={{ background: avatar }}>
              {getInitials(streamer)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-text group-hover:text-primary transition-colors line-clamp-1">
                {stream.title || "Untitled stream"}
              </h4>
              <p className="text-sm subtle mt-1 line-clamp-1">{stream.description || "Live stream in progress."}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-subtle">Streamer</span>
                  <span className="font-semibold text-primary">{streamer}</span>
                </div>
                <span className="inline-flex items-center rounded-xl bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-bg transition-colors">
                  Watch
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default function Home(): JSX.Element {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    let active = true;
    const fetchStreams = async () => {
      try {
        const res = await api.get("/api/streams/active").catch(() => null);
        if (!active) return;
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setStreams(res.data);
          setUsingMock(false);
        } else {
          setStreams(MOCK_STREAMS);
          setUsingMock(true);
        }
      } catch (err) {
        if (!active) return;
        console.error("Failed to fetch streams, using mock data", err);
        setStreams(MOCK_STREAMS);
        setUsingMock(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchStreams();
    const interval = window.setInterval(fetchStreams, 12000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const heroStream = streams[0];
  const highlightStreams = useMemo(() => streams.slice(1, 3), [streams]);

  return (
    <section className="space-y-12">
      <header className="relative overflow-hidden rounded-[32px] border border-white/10 bg-surface/40">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Cinematic streaming backdrop"
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,163,255,0.28),rgba(0,0,0,0))] blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,255,109,0.2),rgba(0,0,0,0))] blur-3xl" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 lg:p-12 min-h-[320px] sm:min-h-[420px] flex flex-col justify-end gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Live
            </span>
            <span className="rounded-full border border-white/15 bg-bg/40 px-3 py-1 text-xs font-semibold text-primary backdrop-blur-sm">
              Onchain Pulse #12
            </span>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-text tracking-tight">
              Live now. Cinematic onchain streams.
            </h1>
            <p className="mt-4 text-sm sm:text-base subtle leading-relaxed">
              Watch creators go live, chat with the community, and support them onchain. Discover featured streams or jump
              straight into the action.
            </p>
            {heroStream && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text">
                <span className="rounded-full bg-bg/40 px-3 py-1">
                  Featuring {heroStream.title || "featured stream"}
                </span>
                <span className="rounded-full bg-bg/40 px-3 py-1">
                  {formatNumber(heroStream.viewerCount ?? 0)} watching
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={heroStream ? getRoute(heroStream) : "/streams"}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-bg shadow-glow-primary hover:brightness-110 transition"
            >
              Watch live
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5v14l12-7z" />
              </svg>
            </Link>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-bg/40 px-6 py-3 text-sm font-bold text-text hover:bg-white/10 transition"
            >
              Mint clip
            </Link>
          </div>
        </div>

        <div className="absolute right-8 top-8 hidden 2xl:block w-80 rounded-3xl border border-white/10 bg-bg/40 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            Prime highlights
          </div>
          <p className="mt-3 text-xs subtle leading-relaxed">
            Curated live streams and trending creators refreshed every few minutes.
          </p>
          <div className="mt-4 space-y-3">
            {(highlightStreams.length ? highlightStreams : MOCK_STREAMS.slice(0, 2)).map((s, idx) => (
              <Link
                key={`${s.streamer}-${idx}`}
                to={getRoute(s)}
                className="flex items-center gap-3 rounded-2xl p-2 hover:bg-white/5 transition"
              >
                <div
                  className="h-10 w-10 rounded-xl"
                  style={{
                    background: s.thumbnail
                      ? `url(${s.thumbnail}) center/cover no-repeat`
                      : AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text line-clamp-1">{s.title || "Live now"}</div>
                  <div className="text-[10px] subtle mt-1">{formatNumber(s.viewerCount ?? 0)} watching</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </header>

      {usingMock && (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-bg/40 px-3 py-1 text-xs text-text">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Mock data in use - API returned no active streams.
        </div>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text">Recommended for you</h2>
            <p className="text-sm subtle mt-1">Live channels based on what is trending right now.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border ${
                viewMode === "grid" ? "border-primary text-primary bg-primary/10" : "border-white/10 text-subtle"
              }`}
              aria-pressed={viewMode === "grid"}
              title="Grid view"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border ${
                viewMode === "list" ? "border-primary text-primary bg-primary/10" : "border-white/10 text-subtle"
              }`}
              aria-pressed={viewMode === "list"}
              title="List view"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-3xl bg-surface/60 animate-pulse" />
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="glass-card text-center py-14">
            <div className="text-lg font-semibold">No streams currently live.</div>
            <p className="muted mt-2">
              Try checking back soon or <Link to="/explore" className="text-primary underline">browse creators</Link>.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {streams.map((stream, index) => (
              <StreamTile key={stream.streamer || stream.id || index} stream={stream} index={index} layout="grid" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {streams.map((stream, index) => (
              <StreamTile key={stream.streamer || stream.id || index} stream={stream} index={index} layout="list" />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
