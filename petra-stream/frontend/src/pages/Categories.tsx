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

const CATEGORY_IMAGES: Record<string, string> = {
  gaming:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBAmaYM72TBLwtLhZVxTo_yBnmrW_N31LkC2RZdql84-_PX9zC47pU9FtESVIaxRRPEJ2JUfoRM5XowfMpJL7c7Zc82mciy420PEPtqb_XhzSLE5dCFudlkCZnTeJAEi0QbkWlb2n7F0pJ2IJONAE1TqiHErmI56N2S8Y2uayehTt6BddUzth1zivweUpkE4oAa5wirVpzBxvROPasYdy-RZCFv35BgyLze9acmEFavZ1F1HXw3jY7R7sUlB9Z0QJcg1UFPDYFuejw",
  music:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDiLGT95lznHdgexVLEDAtbJ50gqcXniy6_lvxn1uU8ZwHXxfPKpc6K9MqBki3v89VGy-Ns09kvc1VzvqIZvc8zklsAeqq2WO5at3fCdes98ikyfrLY7pID9sxePUGim4fAVYWFs3aNXNDh1Xu0o6S7PKyTzq-_Bb6Xllscd3WAWwMyHDamE0233rn6gek8VtU6Gv1JUhijBUXeNT8VabCgw-mhYNeuxRxBKyJWpmPIdD8DS84KkBg_PM5ZJvyOY9Y-2OEXusFWPRE",
  art:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAWHc_dLwq56eY04ikt3cFMC7uFdIr-eqa7IhIYlPZmyC1cD3ExwZ9WVoFK_aoC29jD5AR2oJ7sJkUVtFcSBu1JW73lAmDwXsBLMsoYY9HGUBZE07K5E0BHaN2FWxG52ZAMoNforXkXIwwiIp8Vr4MnTPbSsloI2v0fU4CwuPrtcsFGRZJkHN311CT75uyV1BtpHGia1rGVG-i8CiZaC6nt8UcaMJxMmhqATd3H-g3ko0ma9iNT9Rlelr9oC7O0vtElMyyy1VeIq6Y",
  tech:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA-1jxb9BgPVa4HXkjWTXf7auZa81UU_5ScxiPRz8oV3_NsP7jc-F2SoPIw0M5gCS10vZNLznroyWtMoIedWPqZmMGk9pdu0eCPFHAdH-vipz0a2l5ZVqMJ-PybTJ65IG28a_fUUlqzuT-sdHd2XSFaSbqhJ0emG3XD73vBHHM7xy5FlitHEmAMc2OtHO2NoZ05nyzWSujfxGtTR1K2n97oPGL1ubz_d8Rh1OFma-NQ3MZ1RwB3iBcBOy1wrW7fqQArEw-qDR6Jk54",
  finance:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBw_qxSsDCO5a-POtN2kvLc1R1Du9vFwdWDGcFqkKIwS_ywQcHrTuqs_rM6xXjaCBAPT6ErLQXviMZyRYjrAVstyfGKCRit2DxtA1dbDk84qdewpfLyQB29OmFAKJLyMamWQFkXyBEuaMpIhB3aLbgETQuYjt1xWsdvwL3Jl_Zx8IPqC_xbqWuB5uccezEYtGw4I-KUZNT2pU5mYL_CvQXlmvg0DxdEiTs-NJiCaps3qLpV0eFvTRsSprfRan2BxtJoYqjDR278ooc",
};

const CATEGORY_STYLES: Record<
  string,
  { badge: string; button: string; ring: string }
> = {
  gaming: {
    badge: "border-primary/30 text-primary bg-primary/10",
    button: "bg-primary text-bg shadow-glow-primary/50 hover:shadow-glow-primary",
    ring: "ring-primary/50",
  },
  music: {
    badge: "border-purple-400/40 text-purple-300 bg-purple-500/10",
    button: "bg-white/10 text-text hover:bg-white/20 border border-white/10",
    ring: "ring-purple-500/50",
  },
  art: {
    badge: "border-emerald-400/40 text-emerald-300 bg-emerald-500/10",
    button: "bg-white/10 text-text hover:bg-white/20 border border-white/10",
    ring: "ring-emerald-500/50",
  },
  tech: {
    badge: "border-orange-400/40 text-orange-300 bg-orange-500/10",
    button: "bg-white/10 text-text hover:bg-white/20 border border-white/10",
    ring: "ring-orange-500/50",
  },
  finance: {
    badge: "border-amber-400/40 text-amber-300 bg-amber-500/10",
    button: "bg-white/10 text-text hover:bg-white/20 border border-white/10",
    ring: "ring-amber-500/50",
  },
  default: {
    badge: "border-white/20 text-white/70 bg-white/5",
    button: "bg-white/10 text-text hover:bg-white/20 border border-white/10",
    ring: "ring-white/30",
  },
};

const FALLBACK_TAGS = ["chill", "onchain", "live-coding", "music", "nft"];

function CategoryIcon({ id }: { id: string }) {
  switch (id) {
    case "gaming":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 12h12M9 9v6M15 9v6M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
          />
        </svg>
      );
    case "music":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18V5l10-2v13" />
          <circle cx="7" cy="18" r="3" strokeWidth={2} />
          <circle cx="17" cy="16" r="3" strokeWidth={2} />
        </svg>
      );
    case "art":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19l6-6 4 4 6-6" />
          <circle cx="7" cy="7" r="2" strokeWidth={2} />
        </svg>
      );
    case "tech":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 18l6-6-6-6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6l-6 6 6 6" />
        </svg>
      );
    case "finance":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M5 10V7a2 2 0 012-2h10a2 2 0 012 2v3" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
        </svg>
      );
  }
}

export default function Categories(): JSX.Element {
  const [categories, setCategories] = useState<{ id: string; label: string; description?: string }[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState(FALLBACK_TAGS);

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

    (async () => {
      try {
        const tagRes = await api.get("/api/trending").catch(() => null);
        if (tagRes?.data?.data && Array.isArray(tagRes.data.data)) {
          setTags(tagRes.data.data);
        }
      } catch {
        // ignore - fallback stays
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
    <section className="relative categories-page pb-20 sm:pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(0, 163, 255, 0.12) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)",
          }}
        />
        <div className="absolute -top-20 right-[-8%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-6%] h-[380px] w-[380px] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <header className="mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
          Premium categories
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-text to-white/50">
          Categories
        </h1>
        <p className="text-subtle text-lg max-w-2xl">
          Browse curated live streams across the Web3 ecosystem.
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag}
              to={`/explore?tag=${encodeURIComponent(tag)}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:border-primary/40 hover:text-primary transition"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[360px] rounded-2xl border border-white/10 bg-surface/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
          {cards.map((c) => {
            const style = CATEGORY_STYLES[c.id] || CATEGORY_STYLES.default;
            const image = CATEGORY_IMAGES[c.id] || CATEGORY_IMAGES.gaming;
            return (
              <div
                key={c.id}
                className="group rounded-2xl border border-white/10 bg-surface/60 overflow-hidden transition hover:-translate-y-1 hover:shadow-glow-primary"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={image}
                    alt={`${c.label} category`}
                    className="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg/90 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className={`inline-flex items-center justify-center rounded-lg border px-2 py-2 ${style.badge}`}>
                      <CategoryIcon id={c.id} />
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-text">{c.label}</h2>
                  </div>
                </div>
                <div className="px-5 pb-6 pt-4 space-y-5">
                  <p className="text-sm text-white/60 leading-relaxed">{c.description}</p>
                  <Link
                    to={`/explore?category=${encodeURIComponent(c.id)}`}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${style.button}`}
                  >
                    Explore {c.label}
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}

          <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <svg className="h-8 w-8 text-white/40 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2">Suggest Category</h3>
            <p className="text-white/50 text-sm">Don't see what you're looking for? Let the community decide.</p>
          </div>
        </div>
      )}

      <Link
        to="/create"
        className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-bg flex items-center justify-center shadow-glow-primary transition hover:scale-110 ${CATEGORY_STYLES.gaming.ring}`}
        aria-label="Start streaming"
      >
        <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </section>
  );
}
