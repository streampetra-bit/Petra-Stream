import React, { useMemo } from "react";
import clsx from "clsx";

type CloudflareIframePlayerProps = {
  customerCode?: string;
  inputId?: string;
  title?: string;
  heightClass?: string;
  showBadge?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  preload?: "auto" | "metadata" | "none";
  primaryColor?: string;
  letterboxColor?: string;
  poster?: string;
  startTime?: number;
};

function buildIframeUrl(
  customerCode?: string,
  inputId?: string,
  options?: {
    autoplay?: boolean;
    muted?: boolean;
    controls?: boolean;
    preload?: "auto" | "metadata" | "none";
    primaryColor?: string;
    letterboxColor?: string;
    poster?: string;
    startTime?: number;
  }
) {
  if (!customerCode || !inputId) return "";
  const params = new URLSearchParams();
  if (options?.autoplay) params.set("autoplay", "true");
  if (options?.muted) params.set("muted", "true");
  if (typeof options?.controls === "boolean") params.set("controls", String(options.controls));
  if (options?.preload) params.set("preload", options.preload);
  if (options?.primaryColor) params.set("primaryColor", options.primaryColor);
  if (options?.letterboxColor) params.set("letterboxColor", options.letterboxColor);
  if (options?.poster) params.set("poster", options.poster);
  if (typeof options?.startTime === "number" && Number.isFinite(options.startTime)) {
    params.set("startTime", String(options.startTime));
  }
  const query = params.toString();
  const base = `https://customer-${customerCode}.cloudflarestream.com/${inputId}/iframe`;
  return query ? `${base}?${query}` : base;
}

export default function CloudflareIframePlayer({
  customerCode,
  inputId,
  title,
  heightClass = "",
  showBadge = true,
  autoplay = true,
  muted = true,
  controls = true,
  preload = "metadata",
  primaryColor,
  letterboxColor,
  poster,
  startTime,
}: CloudflareIframePlayerProps): JSX.Element {
  const themeColors = useMemo(() => {
    if (typeof window === "undefined") {
      return { primary: "#00A3FF", letterbox: "#000000" };
    }
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--color-primary").trim() || "#00A3FF";
    const letterbox = styles.getPropertyValue("--color-bg").trim() || "#000000";
    return { primary, letterbox };
  }, []);
  const src = buildIframeUrl(customerCode, inputId, {
    autoplay,
    muted,
    controls,
    preload,
    primaryColor: primaryColor || themeColors.primary,
    letterboxColor: letterboxColor || themeColors.letterbox,
    poster,
    startTime,
  });
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
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
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
