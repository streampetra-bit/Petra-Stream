// src/pages/Streams.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import StreamCard from "../components/StreamCard";

const MOCK_STREAMS = [
  {
    id: "s1",
    streamer: "alice",
    title: "Chill coding and tea",
    description: "Pair programming and building a tiny web3 widget live.",
    viewerCount: 124,
    tags: ["coding", "chill"],
  },
  {
    id: "s2",
    streamer: "bob",
    title: "Synth beats and live visuals",
    description: "Making music with modular synths. Requests welcome.",
    viewerCount: 321,
    tags: ["music", "synth"],
  },
  {
    id: "s3",
    streamer: "carol",
    title: "Retro gaming speedruns",
    description: "Classic platformers and banter. Come hang out.",
    viewerCount: 89,
    tags: ["gaming", "speedrun"],
  },
];

export default function Streams(): JSX.Element {
  const [streams, setStreams] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/streams/active").catch(() => null);
        if (res && Array.isArray(res.data)) {
          setStreams(res.data);
          setUsingMock(false);
        } else {
          setStreams(MOCK_STREAMS);
          setUsingMock(true);
        }
      } catch (err) {
        console.error("Failed to load streams", err);
        setStreams(MOCK_STREAMS);
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return streams;
    return streams.filter((s) => {
      const hay = [
        s.title,
        s.streamer,
        s.description,
        ...(Array.isArray(s.tags) ? s.tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [streams, query]);

  return (
    <section>
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Live Streams</h1>
          <p className="muted mt-1">Discover creators that are live right now.</p>
        </div>
        <div className="w-full md:w-80">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z"
                />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search streams, creators, tags..."
              className="w-full rounded-full border border-white/10 bg-surface/80 pl-10 pr-4 py-2 text-sm text-text placeholder:subtle focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </header>

      {usingMock && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-bg/10 text-sm text-text border border-white/6">
            <strong className="text-xs text-primary">Mock data</strong>
            <span className="text-xs subtle">API returned no active streams.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-14">
          <div className="text-lg font-semibold">No streams found.</div>
          <p className="muted mt-2">Try a different search or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.map((s) => (
            <StreamCard key={s.streamer || s.id} stream={s} />
          ))}
        </div>
      )}
    </section>
  );
}
