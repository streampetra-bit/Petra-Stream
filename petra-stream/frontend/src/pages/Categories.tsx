// src/pages/Categories.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

const FALLBACK = [
  { id: "gaming", label: "Gaming", description: "Tournaments, speedruns, and casual play." },
  { id: "music", label: "Music", description: "Live performances, production, and DJ sets." },
  { id: "art", label: "Art", description: "Illustration, digital painting, and 3D." },
  { id: "tech", label: "Tech", description: "Coding, product builds, and demos." },
  { id: "finance", label: "Finance", description: "Markets, trading, and on-chain analytics." },
];

export default function Categories(): JSX.Element {
  const [categories, setCategories] = useState<{ id: string; label: string; description?: string }[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/categories").catch(() => null);
        if (res?.data?.data && Array.isArray(res.data.data)) {
          setCategories(res.data.data);
        }
      } catch (err) {
        // ignore - fallback stays
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = useMemo(() => {
    return categories.map((c) => ({
      ...c,
      description: c.description || FALLBACK.find((f) => f.id === c.id)?.description || "Browse live streams in this category.",
    }));
  }, [categories]);

  return (
    <section>
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Categories</h1>
          <p className="muted mt-1">Browse streams by category.</p>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-36" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c) => (
            <div key={c.id} className="glass-card p-5 flex flex-col justify-between">
              <div>
                <div className="text-lg font-semibold">{c.label}</div>
                <div className="text-sm muted mt-2">{c.description}</div>
              </div>
              <div className="mt-4">
                <Link to={`/explore?category=${encodeURIComponent(c.id)}`} className="btn-primary px-3 py-2 rounded-md text-sm">
                  Explore {c.label}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
