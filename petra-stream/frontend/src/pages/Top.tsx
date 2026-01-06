// src/pages/Top.tsx
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
  },
  {
    id: "s2",
    streamer: "bob",
    title: "Synth beats and live visuals",
    description: "Making music with modular synths. Requests welcome.",
    viewerCount: 321,
  },
  {
    id: "s3",
    streamer: "carol",
    title: "Retro gaming speedruns",
    description: "Classic platformers and banter. Come hang out.",
    viewerCount: 89,
  },
];

export default function Top(): JSX.Element {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/streams/top").catch(() => null);
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setStreams(res.data);
          setUsingMock(false);
        } else {
          setStreams(MOCK_STREAMS);
          setUsingMock(true);
        }
      } catch (err) {
        console.error("Failed to load top streams", err);
        setStreams(MOCK_STREAMS);
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const top = useMemo(() => {
    return [...streams].sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));
  }, [streams]);

  return (
    <section>
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Top Streams</h1>
          <p className="muted mt-1">Highest viewer counts right now.</p>
        </div>
      </header>

      {usingMock && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-bg/10 text-sm text-text border border-white/6">
            <strong className="text-xs text-primary">Mock data</strong>
            <span className="text-xs subtle">API returned no streams.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-44" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="glass-card text-center py-14">
          <div className="text-lg font-semibold">No streams to show.</div>
          <p className="muted mt-2">Check back soon for live activity.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {top.map((s) => (
            <StreamCard key={s.streamer || s.id} stream={s} />
          ))}
        </div>
      )}
    </section>
  );
}
