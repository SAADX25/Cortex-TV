/* ──────────────────────────────────────────────────
   Player.tsx – HLS Video Player using hls.js
   Native <video> element with smart error handling,
   retry logic, and detailed error categorisation.
   ────────────────────────────────────────────────── */

import { useRef, useEffect, useState, useCallback, useMemo, useDeferredValue, memo } from "react";
import Hls from "hls.js";
import { Capacitor } from "@capacitor/core";
import { Virtuoso } from "react-virtuoso";
import type { ChannelWithStream } from "../hooks/useIPTV";
import { resolveStream } from "../utils/StreamResolver";
import { flagUrl, cleanName, GEO_BLOCK_COUNTRIES } from "../utils/channelUtils";

interface PlayerProps {
  channel: ChannelWithStream;
  onClose: () => void;
  /** Channels to display in the sidebar panel (Famelack layout, desktop only) */
  sidebarChannels?: ChannelWithStream[];
  sidebarCountryName?: string;
  sidebarLoading?: boolean;
  sidebarError?: string | null;
  favorites?: ChannelWithStream[];
  onToggleFavorite?: (ch: ChannelWithStream) => void;
  onPlayChannel?: (ch: ChannelWithStream) => void;
  /** Called by the green back button in the sidebar header */
  onBack?: () => void;
}

/*
 * ── Browser proxy URL rewriter ──
 * In a standard browser (non-Electron) hls.js cannot spoof Referer/Origin,
 * so CDNs like hibridcdn.net return 403.  We route those requests through
 * the Vite dev-server proxy which injects the correct headers server-side.
 *
 * In Electron the main-process request interceptor handles this, so we
 * leave the URL untouched.
 */
const IS_ELECTRON = typeof navigator !== "undefined" &&
  navigator.userAgent.toLowerCase().includes("electron");

const IS_NATIVE = Capacitor.isNativePlatform(); // true on Android/iOS APK

/*
 * True when the app is running in a real browser (not Electron, not Android)
 * AND is deployed to a production origin (GitHub Pages, any non-localhost host).
 * On production there is no Vite dev-server proxy, so cross-origin requests
 * must go through the Cloudflare Worker instead.
 */
const IS_PROD_BROWSER =
  !IS_ELECTRON &&
  !IS_NATIVE &&
  typeof window !== 'undefined' &&
  !/localhost|127\.0\.0\.1/.test(window.location.hostname);

const PROXY_RULES: Array<{ match: RegExp; prefix: string; strip: string }> = [
  // rotana.hibridcdn.net  → /proxy/rotana
  { match: /https?:\/\/rotana\.hibridcdn\.net/i, prefix: "/proxy/rotana", strip: "rotana.hibridcdn.net" },
  // mbc.dbrsp.net         → /proxy/mbc
  { match: /https?:\/\/mbc\.dbrsp\.net/i,        prefix: "/proxy/mbc",    strip: "mbc.dbrsp.net" },
];

/*
 * ── Cloudflare Worker proxy for production / native builds ──
 * After deploying the Worker in cloudflare-worker/, paste your URL here.
 * The Worker accepts ?url=<encoded> and forwards with spoofed headers.
 *
 *   Free tier: 100 000 requests/day – more than enough for personal use.
 */
const CLOUD_PROXY = 'https://cortextv-proxy.cortextv-sr.workers.dev/?url=';

/**
 * CDN hostname fragments that require header spoofing via the
 * Cloudflare Worker.  Only these domains get proxied on Android;
 * everything else is fetched directly by hls.js so we don't break
 * standard streams by injecting unexpected headers.
 *
 * Keep in sync with HEADER_MAP in cloudflare-worker/worker.js.
 */
const PROXY_CDN_FRAGMENTS = [
  'hibridcdn.net',
  'dbrsp.net',
  'cloudfront.net',
];

/**
 * Returns true when `url` matches a known blocked CDN (Vite proxy list).
 */
function matchesProxyRule(url: string): boolean {
  return PROXY_RULES.some((rule) => rule.match.test(url));
}

/**
 * Returns true when the URL points to a CDN that requires header
 * spoofing / CORS bypassing via the Cloudflare Worker.
 *
 * Only domains listed in PROXY_CDN_FRAGMENTS are proxied.
 * Standard streams are left alone so hls.js can fetch them directly.
 */
function needsCloudProxy(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return false;
  // Never double-proxy
  if (url.includes('cortextv-proxy') && url.includes('workers.dev')) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PROXY_CDN_FRAGMENTS.some((frag) => hostname.includes(frag));
  } catch {
    return false;
  }
}

/** Returns true for video segment URLs (.ts, .mp4, .m4s, etc.). */
function isSegmentUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.(ts|aac|mp4|m4s|fmp4|cmfv|cmfa|vtt|webvtt)(\?.*)?$/i.test(path);
  } catch {
    return false;
  }
}

function proxyRewrite(url: string): string {
  if (IS_ELECTRON) return url;                       // Electron handles headers itself

  if (IS_NATIVE) {
    // Android APK — only route known blocked CDNs through Cloudflare Worker
    if (needsCloudProxy(url)) {
      const proxied = CLOUD_PROXY + encodeURIComponent(url);
      console.log(`[Player] Cloud proxy: ${url} → ${proxied}`);
      return proxied;
    }
    return url;
  }

  if (IS_PROD_BROWSER) {
    /*
     * Production browser (GitHub Pages) — no Vite proxy available.
     * Route ONLY the initial .m3u8 manifest for known blocked CDNs through
     * the Cloudflare Worker.  The Worker will rewrite all segment URIs to
     * absolute origin URLs so hls.js fetches video chunks directly.
     * Sub-playlists are also rewritten to loop back through the Worker.
     */
    if (needsCloudProxy(url)) {
      const proxied = CLOUD_PROXY + encodeURIComponent(url);
      console.log(`[Player] CF Worker (browser): ${url} → ${proxied}`);
      return proxied;
    }
    return url;
  }

  // Local dev server — use Vite proxy for known CDNs
  for (const rule of PROXY_RULES) {
    if (rule.match.test(url)) {
      const absolute = window.location.origin + rule.prefix;
      const rewritten = url.replace(new RegExp(`https?://${rule.strip}`, "i"), absolute);
      console.log(`[Player] Vite proxy: ${url} → ${rewritten}`);
      return rewritten;
    }
  }
  return url;
}

/*
 * ── Custom HLS.js loader for native Android ──
 * Proxies all cross-origin requests through the Cloudflare Worker,
 * and crucially reports the ORIGINAL CDN URL as the response URL.
 *
 * Why?  HLS.js resolves relative URLs in playlists against the URL
 * the playlist was loaded from.  If that URL is the Worker URL
 * (workers.dev/?url=…), relative paths like "720p/index.m3u8"
 * resolve to "workers.dev/720p/index.m3u8" (broken!).
 *
 * By overriding response.url → real CDN URL, HLS.js resolves
 * "720p/index.m3u8" → "cdn.example.com/live/720p/index.m3u8" (correct).
 * The loader then proxies that correct CDN URL through the Worker.
 */
function createNativeProxyLoader(debugFn?: (msg: string) => void) {
  const DefaultLoader = Hls.DefaultConfig.loader;

  return class NativeProxyLoader extends DefaultLoader {
    load(context: any, config: any, callbacks: any) {
      let cdnUrl: string = context.url;

      // ── Step 1: un-wrap an already-proxied URL to recover the real CDN URL ──
      if (cdnUrl.startsWith(CLOUD_PROXY)) {
        try {
          cdnUrl = decodeURIComponent(cdnUrl.slice(CLOUD_PROXY.length));
          debugFn?.(`🔓 Unwrapped proxy → ${cdnUrl.substring(0, 90)}`);
        } catch { /* keep original */ }
      }

      const realCdnUrl = cdnUrl;

      // ── Step 2: wrap cross-origin m3u8 URLs in the Cloudflare Worker proxy ──
      // IMPORTANT: never proxy .ts/.mp4/.m4s segments — the Worker refuses them
      // to prevent bandwidth abuse.  The Worker already rewrote segment URIs in
      // the manifest to absolute origin URLs, so they reach here without the
      // CLOUD_PROXY prefix and should be fetched directly.
      if (needsCloudProxy(cdnUrl) && !isSegmentUrl(cdnUrl)) {
        context.url = CLOUD_PROXY + encodeURIComponent(cdnUrl);
        debugFn?.(`📡 Proxy load: ${cdnUrl.substring(0, 70)}`);
      }

      // ── Step 3: intercept onSuccess to report the real CDN URL ──
      const originalOnSuccess = callbacks.onSuccess;
      callbacks.onSuccess = (
        response: any,
        stats: any,
        ctx: any,
        networkDetails: any
      ) => {
        // Tell HLS.js this response came from the CDN, not the Worker
        response.url = realCdnUrl;
        originalOnSuccess(response, stats, ctx, networkDetails);
      };

      super.load(context, config, callbacks);
    }
  };
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
// GEO_BLOCK_COUNTRIES is imported from channelUtils

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

/* ── Strip geo-block noise from channel names ── */
const CLEAN_RE = /\[geo[- ]?blocked\]|\[blocked\]|\[not 24\/7\]/gi;

/* ── Fallback TV icon for sidebar rows ── */
function SidebarFallbackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className="text-white/30"
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

/* ── Sidebar channel row (Famelack style, memoised to skip re-renders) ── */
const SidebarRow = memo(function SidebarRow({
  ch,
  isActive,
  onPlay,
}: {
  ch: ChannelWithStream;
  isActive: boolean;
  onPlay: () => void;
}) {
  const displayName = cleanName(ch.name);
  const categoryLabel = ch.categories[0]?.toUpperCase().substring(0, 8) || "";

  return (
    <div
      role="button"
      tabIndex={ch.streamUrl ? 0 : -1}
      onClick={() => ch.streamUrl && onPlay()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && ch.streamUrl) {
          e.preventDefault();
          onPlay();
        }
      }}
      aria-disabled={!ch.streamUrl}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 my-[3px] select-none outline-none transition-colors focus-visible:ring-1 focus-visible:ring-blue-400/50 ${
        isActive
          ? "bg-blue-400 cursor-default"
          : ch.streamUrl
            ? "cursor-pointer hover:bg-gray-800/70"
            : "opacity-40 cursor-not-allowed"
      }`}
    >
      {/* Logo / Flag */}
      <div className={`shrink-0 h-8 w-8 rounded overflow-hidden flex items-center justify-center ${
        isActive ? "bg-blue-300/30" : "bg-white/[0.06]"
      }`}>
        {ch.country ? (
          <img
            src={flagUrl(ch.country)}
            alt={ch.country}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (ch.logo && img.src !== ch.logo) {
                img.src = ch.logo;
              } else {
                img.style.display = "none";
              }
            }}
          />
        ) : ch.logo ? (
          <img
            src={ch.logo}
            alt=""
            className="w-full h-full object-contain p-0.5"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <SidebarFallbackIcon />
        )}
      </div>

      {/* Channel name */}
      <span className={`flex-1 text-sm font-medium truncate ${isActive ? "text-black font-semibold" : "text-white/90"}`}>
        {displayName}
      </span>

      {/* Category tag */}
      {categoryLabel && (
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
          isActive ? "bg-blue-500/20 text-blue-900" : "text-white/30"
        }`}>
          {categoryLabel}
        </span>
      )}

      {/* Offline indicator */}
      {!ch.streamUrl && (
        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-white/10" />
      )}
    </div>
  );
});

export default function Player({
  channel,
  onClose,
  sidebarChannels,
  sidebarCountryName,
  sidebarLoading,
  sidebarError,
  favorites,
  onToggleFavorite,
  onPlayChannel,
  onBack,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);        // mobile <video>
  const desktopVideoRef = useRef<HTMLVideoElement>(null);  // desktop <video>
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [errorTitle, setErrorTitle] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [nativeFallback, setNativeFallback] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const MAX_RETRIES = 2;

  /* ── Live clock for sidebar header (updates every 30 s) ── */
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const t = setInterval(() =>
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })),
      30_000
    );
    return () => clearInterval(t);
  }, []);

  /* ── Is the current channel a favourite? ── */
  const isFav = useMemo(
    () => favorites?.some((f) => f.id === channel.id) ?? false,
    [favorites, channel.id]
  );

  /* ── Sidebar search state ── */
  const [sidebarSearch, setSidebarSearch] = useState("");

  /*
   * useDeferredValue lets React keep the input snappy at high priority while
   * deferring the expensive filter + Virtuoso re-render to a lower-priority
   * update. The input always reflects what you typed; the list catches up
   * one frame later without blocking the keystroke.
   */
  const deferredSearch = useDeferredValue(sidebarSearch);

  /* ── Filtered sidebar channels — only recomputes when deferredSearch settles ── */
  const filteredSidebarChannels = useMemo(() => {
    if (!sidebarChannels) return [];
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return sidebarChannels;
    return sidebarChannels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.categories.some((c) => c.toLowerCase().includes(q))
    );
  }, [sidebarChannels, deferredSearch]);

  /** Append a timestamped line to the on-screen debug log */
  const addDebugLine = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const line = `[${ts}] ${msg}`;
    console.log(`[Player-Debug] ${msg}`);
    setDebugLog((prev) => [...prev.slice(-40), line]);
  }, []);

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
    setNativeFallback(false);   // reset fallback on manual retry
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
      addDebugLine(`❌ No streamUrl for channel "${channel.name}"`);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolvedUrl(null);
    addDebugLine(`🔍 Resolving: ${channel.streamUrl}`);
    addDebugLine(`📱 Platform: IS_NATIVE=${IS_NATIVE}, IS_ELECTRON=${IS_ELECTRON}`);
    addDebugLine(`🌐 HLS.js supported: ${Hls.isSupported()}`);

    // Quick connectivity test for the Cloudflare Worker (native only)
    if (IS_NATIVE) {
      fetch(CLOUD_PROXY + encodeURIComponent('https://httpbin.org/get'), { method: 'HEAD', mode: 'no-cors' })
        .then(() => addDebugLine('☁️ CF Worker reachable'))
        .catch((e) => addDebugLine(`☁️ CF Worker UNREACHABLE: ${e.message}`));
    }

    resolveStream(channel.streamUrl)
      .then((url) => {
        if (!cancelled) {
          const rewritten = proxyRewrite(url);
          addDebugLine(`✅ Resolved → ${url.substring(0, 80)}…`);
          if (rewritten !== url) addDebugLine(`🔄 Proxy rewrite → ${rewritten.substring(0, 80)}…`);
          setResolvedUrl(rewritten);
          setResolving(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          addDebugLine(`⚠️ Resolve failed: ${err.message} — using original`);
          const rewritten = proxyRewrite(channel.streamUrl!);
          setResolvedUrl(rewritten);
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

    /* ─────────────────────────────────────────────────────────────
       PATH A – Native <video> fallback
       Used when HLS.js already failed, or when HLS.js isn't supported
       but the browser can play HLS/MP4 natively (Safari, iOS, many
       Android WebViews).
       ───────────────────────────────────────────────────────────── */
    if (nativeFallback || !Hls.isSupported()) {
      console.log(
        `[Player] Using native <video> playback${nativeFallback ? " (HLS.js fallback)" : ""}`
      );
      addDebugLine(`▶ Native <video> playback${nativeFallback ? " (HLS.js fallback)" : ""}`);

      video.src = resolvedUrl;

      const onLoadedMeta = () => {
        video.play().catch(() => setStatus("playing"));
      };
      const onNativeError = () => {
        setErrorTitle("Playback Failed");
        setErrorMsg(
          nativeFallback
            ? "Both HLS.js and native playback failed. The stream may be offline or geo-blocked."
            : "Native HLS playback is not supported for this stream."
        );
        setStatus("error");
      };

      video.addEventListener("loadedmetadata", onLoadedMeta);
      video.addEventListener("error", onNativeError);

      /* Timeout: if native player can't connect in 15 s, treat as dead */
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
        video.removeEventListener("loadedmetadata", onLoadedMeta);
        video.removeEventListener("error", onNativeError);
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    /* ─────────────────────────────────────────────────────────────
       PATH B – HLS.js  (primary path)
       On fatal failure, falls back to PATH A via setNativeFallback(true)
       ───────────────────────────────────────────────────────────── */

    /**
     * Trigger native-video fallback instead of an immediate error state.
     * This gives streams a second chance when HLS.js can't handle them
     * (common CORS / codec issues on some providers).
     */
    const fallbackOrError = (title: string, msg: string) => {
      if (!nativeFallback) {
        console.warn("[Player] HLS.js fatal — falling back to native <video>…");
        setNativeFallback(true);
        setStatus("loading");
      } else {
        setErrorTitle(title);
        setErrorMsg(msg);
        setStatus("error");
      }
    };

    hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        /* Low-memory live playback tuning */
        maxBufferLength: 10,
        maxMaxBufferLength: 12,
        maxBufferSize: 12 * 1000 * 1000,
        backBufferLength: 0,
        liveBackBufferLength: 0,
        maxBufferHole: 0.5,
        fragLoadingMaxRetry: 5,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetryTimeout: 4000,
        manifestLoadingMaxRetryTimeout: 4000,

        /*
         * ── Native Android: custom loader handles ALL proxying ──
         * This ensures response.url reports the REAL CDN URL so
         * HLS.js resolves relative playlist / segment paths against
         * the CDN origin, not the Cloudflare Worker domain.
         */
        ...(IS_NATIVE
          ? { loader: createNativeProxyLoader(addDebugLine) as any }
          : {}),

        xhrSetup: (xhr, url) => {
          xhr.withCredentials = false;

          /*
           * Native Android: the NativeProxyLoader already rewrote
           * context.url → Worker proxy URL.  Nothing else to do.
           */
          if (IS_NATIVE) return;

          /*
           * ── Browser proxy rewrite for EVERY sub-request ──
           * The initial .m3u8 goes through proxyRewrite(), but the
           * manifest contains absolute CDN URLs for variant playlists
           * and .ts chunks that hls.js fetches directly.  We intercept
           * every XHR here and re-open with the proxied URL so ALL
           * requests go through the Vite dev-server proxy.
           */
          /*
           * Dev server only: rewrite through Vite proxy.
           * On production (IS_PROD_BROWSER) the Cloudflare Worker already
           * rewrote all sub-playlist and segment URIs inside the manifest, so
           * every subsequent hls.js request goes to the correct destination
           * without any further interception needed here.
           */
          if (!IS_ELECTRON && !IS_PROD_BROWSER) {
            let rewritten: string | null = null;
            for (const rule of PROXY_RULES) {
              if (rule.match.test(url)) {
                rewritten = url.replace(
                  new RegExp(`https?://${rule.strip}`, "i"),
                  window.location.origin + rule.prefix
                );
                break;
              }
            }
            if (rewritten) {
              xhr.open("GET", rewritten, true);
              return;                        // skip Origin/Referer — proxy handles them
            }
          }

          /*
           * Electron path: set Origin / Referer to match stream host.
           * (User-Agent is handled by the main-process interceptor.)
           */
          try {
            const streamOrigin = new URL(url).origin;
            xhr.setRequestHeader('Origin', streamOrigin);
            xhr.setRequestHeader('Referer', streamOrigin + '/');
          } catch { /* malformed URL – skip */ }
        },
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[Player] HLS manifest parsed, starting playback…");
        addDebugLine("✅ HLS manifest parsed — starting playback");
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
        addDebugLine(`🔴 HLS ${data.fatal ? 'FATAL' : 'warn'}: ${data.type} / ${data.details}`);

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
                    fallbackOrError(errorInfo.title, errorInfo.message);
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
                    fallbackOrError(
                      "Media Decode Error",
                      "The stream format is incompatible or corrupted. Try a different channel."
                    );
                  }
                  return s;
                });
              }, 5000);
              break;

            default:
              fallbackOrError(errorInfo.title, errorInfo.message);
              hls?.destroy();
              break;
          }
        }
      });

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
  }, [resolvedUrl, retryCount, isMobile, nativeFallback]);

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

          {/* ── Debug overlay (dev only) ── */}
          {import.meta.env.DEV && (
            <>
              <button
                onClick={() => setShowDebug((p) => !p)}
                className="absolute bottom-2 right-2 z-[20] bg-black/70 text-[9px] text-yellow-400 px-2 py-1 rounded border border-yellow-500/30"
              >
                {showDebug ? "Hide Log" : "🐛 Debug"}
              </button>
              {showDebug && (
                <div className="absolute inset-x-0 bottom-8 z-[20] max-h-[40%] overflow-y-auto bg-black/90 border-t border-yellow-500/30 p-2">
                  {debugLog.length === 0 ? (
                    <p className="text-[9px] text-white/30">No log entries yet…</p>
                  ) : debugLog.map((line, i) => (
                    <p key={i} className="text-[9px] text-green-400/80 font-mono leading-relaxed">{line}</p>
                  ))}
                </div>
              )}
            </>
          )}
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

      {/* ══════════ DESKTOP: Famelack-style side-by-side overlay ══════════ */}
      {!isMobile && (
      <div className="fixed inset-0 z-40 flex flex-row items-center justify-between p-6 gap-5 bg-black">

        {/* ── VIDEO AREA (left / centre — flexible width) ── */}
        <div
          className="flex-1 relative rounded-xl overflow-hidden bg-black self-center min-w-0"
          style={{ height: "85vh" }}
        >
          {/* ── Floating button cluster: Favourite + Close ── */}
          <div className="absolute top-3 right-3 z-[10] flex items-center gap-2">
            {/* Star / Favourite */}
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(channel)}
                className={`p-2.5 rounded-full backdrop-blur-md border transition-all cursor-pointer active:scale-90 ${
                  isFav
                    ? "bg-amber-400/20 border-amber-400/40 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                    : "bg-black/60 border-white/10 text-white/60 hover:text-amber-400 hover:border-amber-400/30 hover:bg-amber-400/10"
                }`}
                title={isFav ? "Remove from favourites" : "Add to favourites"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill={isFav ? "currentColor" : "none"}
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}

            {/* Close / X */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-red-500/90 hover:bg-red-500 border border-red-400/40 text-white backdrop-blur-md transition-all cursor-pointer active:scale-90 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
              title="Close player"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Resolving overlay (desktop) ── */}
          {resolving && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 animate-modal-in rounded-xl">
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
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 animate-modal-in rounded-xl">
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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black via-black/95 to-black animate-modal-in rounded-xl">
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

          {/* ── Debug log toggle ── */}
          <button
            onClick={() => setShowDebug((p) => !p)}
            className="absolute bottom-3 right-3 z-[20] bg-black/70 text-[9px] text-yellow-400/60 hover:text-yellow-400 px-2 py-1 rounded border border-yellow-500/20 transition-colors"
          >
            {showDebug ? "Hide Log" : "🐛"}
          </button>
          {showDebug && (
            <div className="absolute inset-x-0 bottom-8 z-[20] max-h-[35%] overflow-y-auto bg-black/90 border-t border-yellow-500/30 p-2 rounded-b-xl">
              {debugLog.length === 0 ? (
                <p className="text-[9px] text-white/30">No log entries yet…</p>
              ) : debugLog.map((line, i) => (
                <p key={i} className="text-[9px] text-green-400/80 font-mono leading-relaxed">{line}</p>
              ))}
            </div>
          )}
        </div>

        {/* ── SIDEBAR (right — ~30% width) ── */}
        <div
          className="w-[30%] min-w-[260px] max-w-[400px] bg-[#1a1a1a]/[0.97] rounded-xl flex flex-col overflow-hidden self-center border border-white/[0.06] shadow-2xl"
          style={{ height: "85vh" }}
        >
          {/* Sidebar header */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
            {/* Green back button */}
            <button
              onClick={onBack ?? onClose}
              className="shrink-0 h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white transition-colors cursor-pointer active:scale-90 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
              title="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            {/* Country / playlist name */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[15px] truncate leading-tight">
                {sidebarCountryName ?? channel.country ?? "Channels"}
              </p>
              {channel.country && sidebarCountryName && sidebarCountryName !== channel.country && (
                <p className="text-white/40 text-xs truncate">{channel.country}</p>
              )}
            </div>

            {/* Live clock */}
            <span className="shrink-0 text-white/50 text-sm font-mono tabular-nums">
              {currentTime}
            </span>
          </div>

          {/* ── Sidebar search bar ── */}
          {sidebarChannels && sidebarChannels.length > 0 && !sidebarLoading && (
            <div className="shrink-0 px-3 py-2.5 border-b border-white/[0.07]">
              <div className={`relative flex items-center rounded-lg overflow-hidden transition-all duration-200 ${
                sidebarSearch
                  ? "ring-1 ring-blue-500/50 bg-[#1c2a3a]"
                  : "bg-[#252525] hover:bg-[#2a2a2a] focus-within:ring-1 focus-within:ring-blue-500/40 focus-within:bg-[#1c2a3a]"
              }`}>
                {/* Search icon */}
                <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-colors duration-200 ${sidebarSearch ? "text-blue-400" : "text-white/30"}`}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>

                <input
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Search channels…"
                  className="w-full bg-transparent pl-11 pr-10 py-3 text-[13.5px] text-white/90 placeholder-white/20 outline-none caret-blue-400 font-medium"
                />

                {/* Right side: result count pill OR clear button */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3">
                  {sidebarSearch ? (
                    <button
                      onClick={() => setSidebarSearch("")}
                      className="flex items-center justify-center h-6 w-6 rounded-full bg-white/[0.10] hover:bg-red-500/80 text-white/40 hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : (
                    <kbd className="hidden text-[9px] text-white/15 font-mono border border-white/10 rounded px-1 py-0.5 sm:inline">
                      /
                    </kbd>
                  )}
                </div>
              </div>

              {/* Result count — inline below, only while filtering */}
              {sidebarSearch && (
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <span className="text-[10.5px] text-white/30 font-medium">
                    {filteredSidebarChannels.length === 0
                      ? "No matches"
                      : `${filteredSidebarChannels.length} channel${filteredSidebarChannels.length !== 1 ? "s" : ""} found`
                    }
                  </span>
                  {/* Stale indicator — shows briefly while deferred search catches up */}
                  {sidebarSearch !== deferredSearch && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Sidebar body: channel list ── */}
          {sidebarLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
                <span className="text-xs text-white/30">Loading channels…</span>
              </div>
            </div>
          ) : sidebarError ? (
            <div className="flex-1 flex items-center justify-center px-5">
              <p className="text-sm text-red-400/70 text-center">{sidebarError}</p>
            </div>
          ) : sidebarChannels && sidebarChannels.length > 0 ? (
            filteredSidebarChannels.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="text-white/20"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p className="text-sm text-gray-400">No channels match</p>
                <button
                  onClick={() => setSidebarSearch("")}
                  className="text-[12px] text-blue-400/70 hover:text-blue-400 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
            <div className="flex-1 overflow-hidden">
              <Virtuoso
                style={{ height: "100%" }}
                totalCount={filteredSidebarChannels.length}
                itemContent={(index) => {
                  const ch = filteredSidebarChannels[index];
                  if (!ch) return null;
                  return (
                    <SidebarRow
                      ch={ch}
                      isActive={ch.id === channel.id}
                      onPlay={() => onPlayChannel?.(ch)}
                    />
                  );
                }}
                overscan={{ main: 200, reverse: 100 }}
                className="scrollbar-thin"
              />
            </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-5">
              <div className="text-3xl opacity-40">📡</div>
              <p className="text-sm text-white/30">No channels available.</p>
            </div>
          )}

          {/* Sidebar footer: channel count */}
          {sidebarChannels && !sidebarLoading && (
            <div className="shrink-0 px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-white/25 font-medium">
                {sidebarSearch
                  ? `${filteredSidebarChannels.length} of ${sidebarChannels.length}`
                  : `${sidebarChannels.length} channel${sidebarChannels.length !== 1 ? "s" : ""}`
                }
              </span>
              <span className="text-[11px] text-emerald-400/40 font-medium">
                {sidebarChannels.filter((c) => c.streamUrl).length} live
              </span>
            </div>
          )}
        </div>

      </div>
      )}
    </>
  );
}
