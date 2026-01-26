// src/components/Player.tsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Hls from 'hls.js';
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
  autoPlay?: boolean;
  startMuted?: boolean;
};

const Player = forwardRef<PlayerHandle, PlayerProps>(
  ({ src, poster, title, heightClass = "", autoPlay = false, startMuted = false }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const manifestRetryRef = useRef<number | null>(null);
  const recoveryAttemptsRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(startMuted || autoPlay);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (autoPlay) {
      v.muted = true;
      setMuted(true);
    } else if (startMuted) {
      v.muted = true;
      setMuted(true);
    }
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
  }, [autoPlay, startMuted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (manifestRetryRef.current) {
      window.clearTimeout(manifestRetryRef.current);
      manifestRetryRef.current = null;
    }
    recoveryAttemptsRef.current = 0;

    if (!src) {
      v.removeAttribute('src');
      v.load();
      return;
    }

    const isHls = src.includes('.m3u8');

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          // tuned for stable fMP4 playback over shaky networks
          lowLatencyMode: false,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 12,
          maxLiveSyncPlaybackRate: 1.1,
          maxBufferLength: 30,
          maxMaxBufferLength: 30,
          maxBufferHole: 1.5,
          backBufferLength: 60,
          capLevelToPlayerSize: true,
        });
        hlsRef.current = hls;
        hls.attachMedia(v);
        const scheduleManifestRetry = (delay = 2000) => {
          if (manifestRetryRef.current) return;
          manifestRetryRef.current = window.setTimeout(() => {
            if (!hlsRef.current) return;
            hlsRef.current.loadSource(src);
            hlsRef.current.startLoad();
            manifestRetryRef.current = null;
          }, delay);
        };
        const tryResume = () => {
          if (!hlsRef.current) return;
          hlsRef.current.startLoad();
          if (autoPlay) {
            void v.play().catch(() => {
              // ignore autoplay errors
            });
          }
        };
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src);
        });
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          setError(null);
          if (autoPlay) {
            void v.play().catch(() => {
              // ignore autoplay errors
            });
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          const details = data?.details || data?.type;
          if (details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            setError('Buffering...');
            scheduleManifestRetry(1500);
            tryResume();
            return;
          }
          if (details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
            setError('Waiting for live');
            scheduleManifestRetry();
            return;
          }
          if (
            details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
            details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT ||
            details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
            details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
            details === Hls.ErrorDetails.KEY_LOAD_ERROR ||
            details === Hls.ErrorDetails.KEY_LOAD_TIMEOUT
          ) {
            setError('Reconnecting...');
            scheduleManifestRetry();
            return;
          }
          if (data?.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Reconnecting');
                scheduleManifestRetry();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                if (recoveryAttemptsRef.current < 3) {
                  recoveryAttemptsRef.current += 1;
                  hls.recoverMediaError();
                } else {
                  hls.destroy();
                }
                break;
              default:
                hls.destroy();
                break;
            }
          }
          if (details) {
            setError(`Playback error: ${details}`);
          }
        });
        return () => {
          hls.destroy();
          hlsRef.current = null;
          if (manifestRetryRef.current) {
            window.clearTimeout(manifestRetryRef.current);
            manifestRetryRef.current = null;
          }
        };
      }

      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
        if (autoPlay) {
          void v.play().catch(() => {
            // ignore autoplay errors
          });
        }
        return;
      }

      setError('HLS not supported in this browser');
      return;
    }

    v.src = src;
    if (autoPlay) {
      void v.play().catch(() => {
        // ignore autoplay errors
      });
    }
  }, [src, autoPlay]);

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
          className="w-full h-full bg-black object-cover"
          src={src}
          poster={poster}
          controls={false}
          playsInline
          muted={muted}
          autoPlay={autoPlay}
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
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.5 5.25h3.75v13.5H6.5zM13.75 5.25h3.75v13.5h-3.75z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.75 4.5v15l12-7.5-12-7.5z" />
              </svg>
            )}
          </button>

          <button onClick={() => toggleMute()} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-full p-2 bg-black/60 hover:bg-black/70">
            {muted ? (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M15.5 9.5 20 14m0-4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M15 9.5a4 4 0 0 1 0 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M17.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          <button onClick={() => requestFullscreen()} aria-label="Toggle Picture-in-Picture / Fullscreen" className="rounded-full p-2 bg-black/60 hover:bg-black/70">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18-3v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3m10 0h3a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
