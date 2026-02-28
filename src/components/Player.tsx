/* ──────────────────────────────────────────────────
   Player.tsx – HLS Video Player using hls.js
   Native <video> element with smart error handling,
   retry logic, and detailed error categorisation.
   ────────────────────────────────────────────────── */

import { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import type { ChannelWithStream } from "../hooks/useIPTV";
import { resolveStream } from "../utils/StreamResolver";

interface PlayerProps {
  channel: ChannelWithStream;
  onClose: () => void;
}

type StreamStatus = "loading" | "playing" | "error";

/* ── Broken-TV SVG icon (inline, Lucide-style) ── */
function BrokenTvIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* TV body */}
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      {/* Antenna */}
      <polyline points="17 2 12 7 7 2" />
      {/* Static lines ("broken" indicator) */}
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="15" x2="18" y2="15" />
      <line x1="11" y1="18" x2="16" y2="18" />
      {/* Diagonal strike-through */}
      <line x1="4" y1="4" x2="20" y2="20" className="text-red-400" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Countries known to heavily geo-block streams ── */
const GEO_BLOCK_COUNTRIES = new Set(["UK", "GB", "FR"]);

/* ── Categorise error for user-friendly messaging ── */
function categoriseError(details: string, country?: string): {
  title: string;
  message: string;
  icon: string;
} {
  const d = details.toLowerCase();
  const isGeoCountry = country ? GEO_BLOCK_COUNTRIES.has(country.toUpperCase()) : false;

  if (d.includes("manifest") || d.includes("404")) {
    return {
      title: "Stream Not Found",
      message:
        "The stream manifest could not be loaded. The channel may have been removed or its URL changed.",
      icon: "🔗",
    };
  }
  if (d.includes("timeout") || d.includes("aborted")) {
    return {
      title: "Connection Timed Out",
      message:
        "The stream server did not respond in time. Check your network or try again later.",
      icon: "⏱️",
    };
  }
  if (d.includes("cors") || d.includes("403") || d.includes("forbidden")) {
    return {
      title: isGeoCountry ? "Stream is Geo-Blocked" : "Access Restricted",
      message: isGeoCountry
        ? "Stream is Geo-Blocked. A VPN connected to this country is required to watch this channel."
        : "This stream is geo-blocked or requires special access that cannot be provided.",
      icon: "🔒",
    };
  }
  /* Default — network errors on geo-blocked countries get a VPN hint */
  if (isGeoCountry) {
    return {
      title: "Stream is Geo-Blocked",
      message:
        "Stream is Geo-Blocked. A VPN connected to this country is required to watch this channel.",
      icon: "🌍",
    };
  }
  return {
    title: "Stream Offline or Geo-Blocked",
    message:
      "This stream could not be loaded. It may be temporarily offline, geo-restricted, or require authentication.",
    icon: "📡",
  };
}

export default function Player({ channel, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);        // mobile <video>
  const desktopVideoRef = useRef<HTMLVideoElement>(null);  // desktop <video>
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [errorTitle, setErrorTitle] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const MAX_RETRIES = 2;

  /* ── Mobile-device flag (stable across rotations — uses shortest screen edge) ── */
  const [isMobile] = useState(
    () => Math.min(window.screen.width, window.screen.height) < 768
  );

  /* ── Reactive orientation state ── */
  const [isLandscape, setIsLandscape] = useState(
    () => window.matchMedia("(orientation: landscape)").matches
  );

  /* ── Retry handler ── */
  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setStatus("loading");
    setErrorMsg("");
    setErrorTitle("");
  }, []);

  /* ── Orientation listener ── */
  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  /* ── Prevent Android WebView from hijacking the video player ── */
  useEffect(() => {
    videoRef.current?.setAttribute("webkit-playsinline", "true");
    desktopVideoRef.current?.setAttribute("webkit-playsinline", "true");
  }, []);

  /* ── Resolve the stream URL before handing it to HLS ── */
  useEffect(() => {
    if (!channel.streamUrl) {
      setResolvedUrl(null);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolvedUrl(null);

    resolveStream(channel.streamUrl)
      .then((url) => {
        if (!cancelled) {
          setResolvedUrl(url);
          setResolving(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          /* Fallback: use the original URL if resolution fails */
          setResolvedUrl(channel.streamUrl!);
          setResolving(false);
        }
      });

    return () => { cancelled = true; };
  }, [channel.streamUrl, retryCount]);

  useEffect(() => {
    /* Wait until the resolver has produced a URL */
    if (!resolvedUrl) return;

    /* Pick the visible <video> based on device type */
    const video = isMobile ? videoRef.current : desktopVideoRef.current;

    if (!video) {
      setStatus("error");
      setErrorTitle("No Stream Available");
      setErrorMsg("No stream URL is available for this channel.");
      return;
    }

    let hls: Hls | null = null;
    let networkRetryTimer: ReturnType<typeof setTimeout> | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        /* ── Thermal / memory tuning ── */
        maxBufferLength: 30,          // keep at most 30 s of buffer in RAM
        maxMaxBufferLength: 60,       // hard ceiling – never exceed 60 s
        maxBufferSize: 30 * 1000 * 1000, // ~30 MB source buffer cap
        fragLoadingMaxRetry: 5,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetryTimeout: 4000,
        manifestLoadingMaxRetryTimeout: 4000,
        xhrSetup: (xhr, _url) => {
          /* Allow cross-origin cookies / credentials if needed */
          xhr.withCredentials = false;
          /*
           * Spoof headers to bypass basic server-side blocking
           * (e.g. eighty-eight.watch checking User-Agent / Referer).
           * In standard browsers these are forbidden headers, but
           * Electron with webSecurity disabled allows overriding them.
           */
          xhr.setRequestHeader('User-Agent', 'VLC/3.0.16 LibVLC/3.0.16');
          xhr.setRequestHeader('Referer', 'https://tv.eighty-eight.website/');
          xhr.setRequestHeader('Origin', 'https://tv.eighty-eight.website');
        },
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[Player] HLS manifest parsed, starting playback…");
        video.play().catch((e) => {
          console.warn("[Player] Auto-play blocked:", e.message);
          setStatus("playing");
        });
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setStatus((s) => (s !== "playing" ? "playing" : s));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error(
          "[Player] HLS error:",
          data.type,
          data.details,
          data.fatal ? "(FATAL)" : ""
        );

        if (data.fatal) {
          const errorInfo = categoriseError(data.details, channel.country);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn(
                "[Player] Fatal network error — attempting recovery…"
              );
              hls?.startLoad();
              networkRetryTimer = setTimeout(() => {
                setStatus((s) => {
                  if (s !== "playing") {
                    setErrorTitle(errorInfo.title);
                    setErrorMsg(errorInfo.message);
                    return "error";
                  }
                  return s;
                });
              }, 6000);
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn(
                "[Player] Fatal media error — attempting recovery…"
              );
              hls?.recoverMediaError();
              setTimeout(() => {
                setStatus((s) => {
                  if (s !== "playing") {
                    setErrorTitle("Media Decode Error");
                    setErrorMsg(
                      "The stream format is incompatible or corrupted. Try a different channel."
                    );
                    return "error";
                  }
                  return s;
                });
              }, 5000);
              break;

            default:
              setErrorTitle(errorInfo.title);
              setErrorMsg(errorInfo.message);
              setStatus("error");
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = resolvedUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => setStatus("playing"));
      });
      video.addEventListener("error", () => {
        setErrorTitle("Playback Failed");
        setErrorMsg("Native HLS playback failed for this stream.");
        setStatus("error");
      });
    } else {
      setErrorTitle("Unsupported Browser");
      setErrorMsg("HLS playback is not supported in this environment.");
      setStatus("error");
    }

    /* Timeout: if still loading after 15s, treat as offline */
    const timeout = setTimeout(() => {
      setStatus((s) => {
        if (s === "loading") {
          setErrorTitle("Connection Timed Out");
          setErrorMsg(
            "The stream server did not respond. It may be offline or geo-blocked."
          );
          return "error";
        }
        return s;
      });
    }, 15000);

    return () => {
      clearTimeout(timeout);
      if (networkRetryTimer) clearTimeout(networkRetryTimer);

      /* ── Thorough HLS + video cleanup to prevent memory leaks ── */
      if (hls) {
        hls.stopLoad();      // stop pending network requests
        hls.detachMedia();   // detach from <video> before destroying
        hls.destroy();       // release all hls.js internal buffers
        hls = null;
        hlsRef.current = null;
      }

      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();        // forces browser to release media buffers
      }
    };
  }, [resolvedUrl, retryCount, isMobile]);

  /* Mark playing once actual video frames render */
  const handlePlaying = () => setStatus("playing");

  return (
    <>
      {/* ══════════ MOBILE: fixed top container (video + control bar) ══════════ */}
      {isMobile && (
      <div className={isLandscape
        ? "fixed inset-0 z-[9999] bg-black w-screen h-screen flex flex-col"
        : "fixed top-0 inset-x-0 z-[100] flex flex-col bg-black"
      }>
        {/* ── Floating Close / Back button (always visible) ── */}
        <button
          onClick={onClose}
          className="absolute top-[max(env(safe-area-inset-top),3rem)] left-4 z-[10000] bg-black/70 text-white p-3 rounded-full backdrop-blur-md cursor-pointer active:scale-90 transition-transform shadow-lg"
          aria-label="Close player"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>

        {/* ── Video area — strict aspect-ratio, never collapses (audio-only safe) ── */}
        <div className={isLandscape
          ? "absolute inset-0 bg-black flex flex-col items-center justify-center overflow-hidden"
          : "relative w-full aspect-video max-h-[40vh] bg-black flex flex-col items-center justify-center overflow-hidden"
        }>
          {/* Resolving overlay (mobile) */}
          {resolving && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
              <div className="relative">
                <div className="h-9 w-9 rounded-full border-2 border-purple-400/20 border-t-purple-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
                </div>
              </div>
              <p className="mt-2.5 text-[11px] text-white/50 px-6 text-center">
                Resolving secure stream…
              </p>
            </div>
          )}

          {/* Loading spinner (mobile) */}
          {!resolving && status === "loading" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
              <div className="relative">
                <div className="h-9 w-9 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.6)]" />
                </div>
              </div>
              <p className="mt-2.5 text-[11px] text-white/50 px-6 text-center">
                {retryCount > 0 ? `Retrying… (${retryCount + 1})` : "Connecting…"}
              </p>
            </div>
          )}

          {/* Error state (mobile) */}
          {status === "error" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black px-5">
              <div className="relative p-2.5 rounded-xl bg-white/[0.03] border border-white/5 mb-2.5">
                <BrokenTvIcon className="text-red-400/70 !w-8 !h-8" />
              </div>
              <p className="text-xs font-semibold text-white/70 text-center">
                {errorTitle || "Stream Unavailable"}
              </p>
              <p className="text-[10px] text-white/30 text-center mt-1 leading-snug max-w-[260px]">
                {errorMsg || "Could not load this stream."}
              </p>
              <div className="flex gap-2 mt-3">
                {retryCount < MAX_RETRIES && (
                  <button
                    onClick={handleRetry}
                    className="px-3 py-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-400 text-[11px] font-medium active:scale-95 transition-transform flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                    Retry
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/50 text-[11px] font-medium active:scale-95 transition-transform"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Audio-only fallback artwork */}
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center pointer-events-none select-none">
            {channel.logo ? (
              <img src={channel.logo} alt="" className="h-16 w-16 rounded-xl object-contain opacity-30" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-white/15">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
            <p className="mt-2 text-[10px] text-white/20 tracking-wide uppercase">Audio Stream</p>
          </div>

          <video
            ref={videoRef}
            className="absolute inset-0 z-[2] w-full h-full object-contain bg-transparent"
            style={{ objectFit: "contain" }}
            controls={true}
            autoPlay
            playsInline
            onPlaying={handlePlaying}
          />
        </div>

        {/* ── Control bar beneath video ── */}
        <div className={isLandscape
          ? "absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top),3rem)] bg-gradient-to-b from-black/80 to-transparent"
          : "relative z-[3] flex items-center gap-3 px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)] bg-black/90 backdrop-blur-md border-b border-white/5 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
        }>
          {/* Channel logo */}
          {channel.logo && (
            <img
              src={channel.logo}
              alt=""
              className="h-7 w-7 shrink-0 rounded bg-white/5 object-contain"
            />
          )}
          {/* Channel info */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{channel.name}</p>
            {channel.categories.length > 0 && (
              <p className="text-[9px] text-cyan-400/50 uppercase tracking-wider truncate">
                {channel.categories.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
          {/* Status dot */}
          <div className={`shrink-0 h-1.5 w-1.5 rounded-full ${
            status === "playing" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
            : status === "loading" ? "bg-yellow-400 animate-pulse"
            : "bg-red-400"
          }`} />
          {/* Close / Stop button */}
          <button
            onClick={onClose}
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white active:scale-95 transition-all"
            title="Stop & close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* ══════════ DESKTOP: full-screen overlay (unchanged) ══════════ */}
      {!isMobile && (
      <div className="absolute inset-0 z-40 bg-black">
        {/* ── Back button ── */}
        <button
          onClick={onClose}
          className="absolute top-6 left-6 z-[100] text-white bg-black/60 hover:bg-red-600 p-3 rounded-full cursor-pointer transition-colors"
          title="Back to globe"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>

        {/* ── Channel info overlay ── */}
        <div className="absolute top-6 left-20 z-[100] flex items-center gap-3 rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm">
          {channel.logo && (
            <img src={channel.logo} alt="" className="h-8 w-8 rounded object-contain bg-white/5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate max-w-[260px]">{channel.name}</p>
            {channel.categories.length > 0 && (
              <p className="text-[10px] text-cyan-400/60 uppercase tracking-wider">
                {channel.categories.join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* ── Resolving overlay (desktop) ── */}
        {resolving && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 animate-modal-in">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-purple-400/20 border-t-purple-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
              </div>
            </div>
            <p className="mt-5 text-sm text-white/50">Resolving secure stream…</p>
            <p className="mt-1 text-[10px] text-white/20 font-mono max-w-xs truncate">{channel.streamUrl}</p>
          </div>
        )}

        {/* ── Loading spinner (desktop) ── */}
        {!resolving && status === "loading" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 animate-modal-in">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
              </div>
            </div>
            <p className="mt-5 text-sm text-white/50">
              {retryCount > 0 ? `Retrying connection… (attempt ${retryCount + 1})` : "Connecting to stream…"}
            </p>
            <p className="mt-1 text-[10px] text-white/20 font-mono max-w-xs truncate">{channel.streamUrl}</p>
          </div>
        )}

        {/* ── Error state (desktop) ── */}
        {status === "error" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black via-black/95 to-black animate-modal-in">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundSize: "150px 150px",
            }} />
            <div className="relative flex flex-col items-center text-center px-8 max-w-lg">
              <div className="relative mb-6">
                <div className="absolute inset-0 -m-4 rounded-full bg-red-500/5 blur-xl animate-pulse" />
                <div className="relative p-5 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
                  <BrokenTvIcon className="text-red-400/70" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white/80 tracking-wide">
                {errorTitle || "Stream Offline or Geo-Blocked"}
              </h2>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent mt-3 mb-4" />
              <p className="text-sm text-white/35 leading-relaxed">
                {errorMsg || "This stream could not be loaded."}
              </p>
              <div className="mt-5 flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/5 px-4 py-2">
                {channel.logo && <img src={channel.logo} alt="" className="h-5 w-5 rounded object-contain" />}
                <span className="text-xs text-white/40 truncate max-w-[200px]">{channel.name}</span>
                {channel.country && <span className="text-[10px] text-white/20 uppercase">{channel.country}</span>}
              </div>
              <div className="flex items-center gap-3 mt-7">
                {retryCount < MAX_RETRIES && (
                  <button onClick={handleRetry} className="px-5 py-2.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                    Retry Stream
                  </button>
                )}
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10 transition-all cursor-pointer">
                  ← Back to channels
                </button>
              </div>
              {retryCount >= MAX_RETRIES && (
                <p className="mt-4 text-[10px] text-white/15">Max retries reached. Try a different channel.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Video element (desktop) ── */}
        <video
          ref={desktopVideoRef}
          className="w-full h-full object-contain bg-black"
          style={{ objectFit: "contain" }}
          controls
          autoPlay
          playsInline
          onPlaying={handlePlaying}
        />
      </div>
      )}
    </>
  );
}
