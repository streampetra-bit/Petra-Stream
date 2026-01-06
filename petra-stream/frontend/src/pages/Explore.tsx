// src/pages/Explore.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "../lib/api";
import StreamCard from "../components/StreamCard";

const FALLBACK_CATEGORIES = [
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
];

const FALLBACK_TAGS = ["chill", "onchain", "live-coding", "music", "nft"];

export default function Explore(): JSX.Element {
  const location = useLocation();
  const [streams, setStreams] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(FALLBACK_CATEGORIES);
  const [tags, setTags] = useState<string[]>(FALLBACK_TAGS);
  const [loading, setLoading] = useState(true);

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
    return streams.filter((s) => {
      if (selectedCategory) {
        const tagsList = Array.isArray(s.tags) ? s.tags : [];
        if (!tagsList.includes(selectedCategory)) return false;
      }
      if (selectedTag) {
        const tagsList = Array.isArray(s.tags) ? s.tags : [];
        if (!tagsList.includes(selectedTag)) return false;
      }
      return true;
    });
  }, [streams, selectedCategory, selectedTag]);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold">Explore</h1>
        <p className="muted mt-1">Browse categories, tags, and live streams.</p>
      </header>

      <section className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Categories</h3>
          <Link to="/categories" className="text-sm text-primary">View all</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/explore?category=${encodeURIComponent(c.id)}`}
              className="px-3 py-1.5 rounded-md border text-sm"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-lg font-semibold mb-3">Trending tags</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link key={t} to={`/explore?tag=${encodeURIComponent(t)}`} className="px-3 py-1.5 rounded-md border text-sm">
              #{t}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Live now</h3>
          {(selectedCategory || selectedTag) && (
            <Link to="/explore" className="text-sm text-primary">Clear filters</Link>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse h-44" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card text-center py-12">
            <div className="text-lg font-semibold">No streams in this filter.</div>
            <p className="muted mt-2">Try a different category or tag.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filtered.map((s) => (
              <StreamCard key={s.streamer || s.id} stream={s} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
