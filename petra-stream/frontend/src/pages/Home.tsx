// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StreamCard from "../components/StreamCard";
import api from "../lib/api";

const MOCK_STREAMS = [
  {
    id: "s1",
    streamer: "alice",
    title: "Chill coding & tea",
    description: "Pair programming: building a tiny web3 widget live.",
    viewerCount: 124,
  },
  {
    id: "s2",
    streamer: "bob",
    title: "Synth beats & live visuals",
    description: "Making music with modular synths — requests welcome.",
    viewerCount: 321,
  },
  {
    id: "s3",
    streamer: "carol",
    title: "Retro gaming speedruns",
    description: "Classic platformers and banter — come hang out.",
    viewerCount: 89,
  },
  {
    id: "s4",
    streamer: "0xDeaDBeef",
    title: "On-chain dev workshop",
    description: "Smart contract walkthrough + Q&A.",
    viewerCount: 46,
  },
  {
    id: "s5",
    streamer: "dina",
    title: "Live art & sketching",
    description: "Watercolor and digital painting techniques.",
    viewerCount: 60,
  },
  {
    id: "s6",
    streamer: "eva",
    title: "Ask me anything — product design",
    description: "AMA: design, UX, careers — ask anything!",
    viewerCount: 29,
  },
];

export default function Home(): JSX.Element {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/streams/active").catch(() => null);

        // if backend responds with non-empty list, use it
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setStreams(res.data);
          setUsingMock(false);
        } else {
          // fallback to mock streams (useful for testing chat/tip locally)
          setStreams(MOCK_STREAMS);
          setUsingMock(true);
        }
      } catch (err) {
        console.error("Failed to fetch streams, using mock data", err);
        setStreams(MOCK_STREAMS);
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section>
      {/* Hero */}
      <header className="mb-8">
        <div className="glass-card flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-primary">Live Now</h1>
            <p className="muted mt-2 max-w-xl">
              Watch streamers live, chat with the community, and support creators on-chain. Browse featured streams or
              jump straight into the action.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a href="#streams" className="btn-primary">
                Explore Live
              </a>
              <Link
                to="/create"
                className="px-4 py-2 rounded-lg border border-white/6 hover:bg-surface transition text-text"
              >
                Start Streaming
              </Link>
            </div>
          </div>

          <div className="hidden md:block w-full md:w-1/3">
            <div className="hero-prime rounded-lg p-4 text-white shadow-neon-lg">
              <h3 className="font-semibold">Prime Highlights</h3>
              <p className="text-sm mt-2">Curated live streams and trending creators — refreshed every few minutes.</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mock warning */}
      {usingMock && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-bg/10 text-sm text-text border border-white/6">
            <strong className="text-xs text-primary">Mock data</strong>
            <span className="text-xs subtle">Showing local test streams (API returned no active streams).</span>
          </div>
        </div>
      )}

      {/* Stream grid */}
      <section id="streams">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse h-44" />
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="glass-card text-center py-14">
            <div className="text-lg font-semibold">No streams currently live.</div>
            <p className="muted mt-2">
              Try checking back soon or <a href="/explore" className="text-primary underline">browse creators</a>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {streams.map((s) => (
              <StreamCard key={s.streamer || s.id} stream={s} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
