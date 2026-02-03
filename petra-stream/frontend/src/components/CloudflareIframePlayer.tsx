import React from "react";
import clsx from "clsx";

type CloudflareIframePlayerProps = {
  customerCode?: string;
  inputId?: string;
  title?: string;
  heightClass?: string;
  showBadge?: boolean;
};

function buildIframeUrl(customerCode?: string, inputId?: string) {
  if (!customerCode || !inputId) return "";
  return `https://customer-${customerCode}.cloudflarestream.com/${inputId}/iframe`;
}

export default function CloudflareIframePlayer({
  customerCode,
  inputId,
  title,
  heightClass = "",
  showBadge = true,
}: CloudflareIframePlayerProps): JSX.Element {
  const src = buildIframeUrl(customerCode, inputId);
  if (!src) {
    return (
      <div className={clsx("rounded-2xl bg-black/60 flex items-center justify-center text-sm text-white/70", heightClass)}>
        Playback unavailable
      </div>
    );
  }

  return (
    <div className={clsx("relative rounded-2xl overflow-hidden bg-black", heightClass)}>
      <iframe
        src={src}
        title={title || "Live stream"}
        className="w-full h-full"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {showBadge ? (
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
          Live
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-primary-rgb))] shadow-glow-primary" />
        </div>
      ) : null}
      <div className="absolute inset-0 pointer-events-none border border-white/5" />
    </div>
  );
}
