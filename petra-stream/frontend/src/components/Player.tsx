// src/components/Player.tsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';

export type PlayerHandle = {
  play: () => Promise<void> | void;
  pause: () => void;
  togglePlay: () => Promise<void> | void;
  isPlaying: () => boolean;
  toggleMute: () => void;
  requestFullscreen: () => Promise<void> | void;
};

type PlayerProps = {
  src?: string;
  poster?: string;
  title?: string;
  heightClass?: string;
};

const Player = forwardRef<PlayerHandle, PlayerProps>(({ src, poster, title, heightClass = '' }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => setError('Playback error');
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
    };
  }, []);

  async function play() {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
    } catch (err: any) {
      setError(err?.message || 'Playback blocked');
      // Do not throw to allow the caller to continue
    }
  }

  function pause() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
  }

  async function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) await play();
    else pause();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  async function requestFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    // prefer the Fullscreen API
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
  }

  useImperativeHandle(ref, () => ({
    play,
    pause,
    togglePlay,
    isPlaying: () => isPlaying,
    toggleMute,
    requestFullscreen,
  }), [isPlaying]);

  return (
    <div ref={containerRef} className={clsx('relative rounded-2xl overflow-hidden bg-black', heightClass)} aria-label={title ?? 'Video player'}>
      {src ? (
        <video
          ref={videoRef}
          className="w-full h-full bg-black"
          src={src}
          poster={poster}
          controls={false}
          playsInline
        />
      ) : (
        <div
          className="aspect-video flex items-center justify-center text-white"
          style={{
            background: poster ? `url(${poster}) center/cover` : 'linear-gradient(135deg,var(--color-primary),var(--color-accent))',
          }}
          role="img"
          aria-label={title ?? 'No video available'}
        >
          <div className="text-center p-6">
            <div className="text-2xl font-bold">{title ?? 'No video available'}</div>
            <div className="text-sm mt-2 subtle">Stream is not available right now</div>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute left-4 bottom-4 right-4 flex items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => togglePlay()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="rounded-full p-2 bg-black/60 hover:bg-black/70"
          >
            {isPlaying ? (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z" fill="currentColor" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            )}
          </button>

          <button onClick={() => toggleMute()} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-full p-2 bg-black/60 hover:bg-black/70">
            {muted ? (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none"><path d="M16.5 9.5 19 7v10l-2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none"><path d="M11 6 6 10H2v4h4l5 4V6z" fill="currentColor"/></svg>
            )}
          </button>

          <button onClick={() => requestFullscreen()} aria-label="Toggle Picture-in-Picture / Fullscreen" className="rounded-full p-2 bg-black/60 hover:bg-black/70">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none"><path d="M9 13h6v6H9zM21 7h-8V3H3v14h18V7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="text-xs text-white/90 bg-black/40 px-2 py-1 rounded-md backdrop-blur-xs">
          {title}
        </div>
      </div>

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white p-3 rounded-md">{error}</div>
        </div>
      ) : null}
    </div>
  );
});

export default Player;
