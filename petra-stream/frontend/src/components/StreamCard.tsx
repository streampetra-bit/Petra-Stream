// src/components/StreamCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';

type Stream = {
  id?: string;
  streamer?: string;
  title?: string;
  description?: string;
  thumbnail?: string; // url
  viewers?: number;
  tags?: string[];
  avatar?: string;
  isLive?: boolean;
};

function formatNumber(n?: number) {
  if (!n && n !== 0) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export default function StreamCard({ stream }: { stream: Stream }) {
  const {
    id,
    streamer = 'unknown',
    title = 'Untitled Stream',
    description = '',
    thumbnail,
    viewers = 0,
    tags = [],
    avatar,
    isLive = true,
  } = stream || {};

  const route = `/stream/${encodeURIComponent(streamer || id || '')}`;

  // thumbnail fallback: gradient hero using theme tokens (keeps look consistent across themes)
  const thumbStyle = thumbnail
    ? {
        backgroundImage: `url(${thumbnail})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        backgroundImage:
          'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-accent) 40%, var(--color-primary)))',
        backgroundSize: '180% 180%',
        backgroundPosition: '50% 50%',
      };

  return (
    <article
      aria-labelledby={`stream-title-${id ?? streamer}`}
      className="rounded-2xl overflow-hidden shadow-neon-lg transform transition-all hover:-translate-y-1 hover:scale-[1.01] focus-within:scale-[1.008] bg-surface border border-white/6"
    >
      <Link to={route} className="block group focus:outline-none" aria-label={`Open stream ${title}`}>
        {/* thumbnail */}
        <div className="relative aspect-video" style={thumbStyle as React.CSSProperties}>
          {/* dark overlay for readability */}
          <div className="absolute inset-0 bg-black/28 group-hover:bg-black/30 transition" />

          {/* live badge */}
          {isLive && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              <span className="w-2 h-2 rounded-full bg-white/90 animate-pulse" />
              LIVE
            </span>
          )}

          {/* viewer count */}
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/48 px-3 py-1 text-xs text-white backdrop-blur-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A2 2 0 0122 9.618v4.764a2 2 0 01-2.447 1.894L15 14M4 6v12a2 2 0 002 2h10" />
            </svg>
            <span className="font-medium">{formatNumber(viewers)}</span>
          </div>

          {/* play icon on hover (subtle) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5v14l12-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* body */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* avatar */}
            <div className="flex-shrink-0">
              <div
                className="w-12 h-12 rounded-lg neon-ring overflow-hidden bg-surface flex items-center justify-center"
                aria-hidden
                style={{
                  background:
                    avatar ? `url(${avatar}) center/cover no-repeat` : 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 id={`stream-title-${id ?? streamer}`} className="text-sm font-semibold text-text truncate">
                {title}
              </h3>
              <div className="mt-1 text-xs subtle truncate">{description}</div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-subtle">Streamer</div>
                  <div className="text-xs font-mono text-text">{streamer}</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* tags (show up to 3) */}
                  <div className="hidden sm:flex items-center gap-2">
                    {tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-xs px-2 py-1 rounded-md bg-white/4 text-text">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <Link
                    to={route}
                    className="btn-primary px-3 py-1.5 rounded-md text-sm font-semibold"
                    onClick={(e) => {
                      /* keep default navigation behavior; this handler reserved for future analytics */
                    }}
                  >
                    Watch
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
