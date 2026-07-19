/* ──────────────────────────────────────────────────
   Player.tsx – HLS Video Player using hls.js
   Native <video> element with smart error handling,
   retry logic, and detailed error categorisation.
   ────────────────────────────────────────────────── */

import { useRef, useEffect, useState, useCallback, useMemo, useDeferredValue, memo } from "react";
import Hls from "hls.js";
import {
  IS_ELECTRON,
  IS_NATIVE,
  IS_PROD_BROWSER,
  PROXY_RULES,
  getActiveProxyUrl,
  markProxyFailed,
  setCustomProxyUrl,
  proxyRewrite,
  createNativeProxyLoader
} from "@/features/player/services/playbackProxy";
import { categoriseError } from "@/features/player/services/playbackErrors";

import PlayerShell from "./PlayerShell";
import PlayerHeader from "./PlayerHeader";
import VideoSurface from "./VideoSurface";
import { FloatingControls } from "./PlayerControls";

import type { ChannelWithStream } from "@/shared/types";
import { resolveStream } from "@/features/iptv/services/StreamResolver";
import { createPlayerLogLine, logPlayerDebug } from "@/features/player/services/playerLogger";
import type { PlayerProps, StreamStatus } from "../types";
import { flagUrl, cleanName, GEO_BLOCK_COUNTRIES, getStreamHealth } from "@/shared/lib/channelUtils";
import ChannelList from "@/features/channels/components/ChannelList";




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
  customProxyUrl,
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
  const [reportCopied, setReportCopied] = useState(false);
  const MAX_RETRIES = 2;

  /* ── Refs for stable callbacks in effect ── */
  const skipLogicRef = useRef({ sidebarChannels, onPlayChannel, channel });
  useEffect(() => {
    skipLogicRef.current = { sidebarChannels, onPlayChannel, channel };
  }, [sidebarChannels, onPlayChannel, channel]);

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
    logPlayerDebug(msg);
    setDebugLog((prev) => [...prev.slice(-40), createPlayerLogLine(msg)]);
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
    setReportCopied(false);
    setNativeFallback(false);   // reset fallback on manual retry
  }, []);

  const handleReportBrokenStream = useCallback(() => {
    const report = [
      "Cortex TV broken stream report",
      `Channel: ${cleanName(channel.name)}`,
      `Country: ${channel.country || "Unknown"}`,
      `Stream: ${channel.streamUrl || "No stream URL"}`,
      `Status: ${errorTitle || "Stream unavailable"}`,
      `Message: ${errorMsg || "Stream unavailable. Try another channel."}`,
    ].join("\n");

    setReportCopied(true);
    window.setTimeout(() => setReportCopied(false), 2400);
    navigator.clipboard?.writeText(report).catch(() => {
      console.info("[Player] Broken stream report", report);
    });
  }, [channel.country, channel.name, channel.streamUrl, errorMsg, errorTitle]);

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

  useEffect(() => {
    setCustomProxyUrl(customProxyUrl || null);
    return () => setCustomProxyUrl(null);
  }, [customProxyUrl]);

  /* ── 2. Resolve Stream URL (Extract real URL from proxies or wrappers) ── */
  useEffect(() => {
    setReportCopied(false);
    let cancelled = false;
    const streamHealth = getStreamHealth(channel.streamUrl, channel.streamStatus, channel.name, channel.country);

    if (streamHealth === "geo-blocked") {
      setResolvedUrl(null);
      setResolving(false);
      setErrorTitle("Stream restricted");
      setErrorMsg("This stream is restricted by the provider or region.");
      setStatus("error");
      addDebugLine(`Known restricted stream for "${channel.name}"`);
      return;
    }

    if (streamHealth === "offline" || !channel.streamUrl) {
      setResolvedUrl(null);
      setResolving(false);
      setErrorTitle("Stream unavailable");
      setErrorMsg("Stream unavailable. Try another channel.");
      setStatus("error");
      addDebugLine(`No playable stream for "${channel.name}"`);
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setErrorTitle("");

    setResolving(true);
    setResolvedUrl(null);
    addDebugLine(`🔍 Resolving: ${channel.streamUrl}`);
    addDebugLine(`📱 Platform: IS_NATIVE=${IS_NATIVE}, IS_ELECTRON=${IS_ELECTRON}`);
    addDebugLine(`🌐 HLS.js supported: ${Hls.isSupported()}`);

    // Quick connectivity test for the Cloudflare Worker (native only)
    if (IS_NATIVE) {
      fetch(getActiveProxyUrl() + encodeURIComponent('https://httpbin.org/get'), { method: 'HEAD', mode: 'no-cors' })
        .then(() => { if (!cancelled) addDebugLine('☁️ CF Worker reachable') })
        .catch((e) => { if (!cancelled) addDebugLine(`☁️ CF Worker UNREACHABLE: ${e.message}`) });
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
  }, [addDebugLine, channel.country, channel.name, channel.streamStatus, channel.streamUrl, retryCount]);

  useEffect(() => {
    /* Wait until the resolver has produced a URL */
    if (!resolvedUrl) return;

    /* Pick the visible <video> based on device type */
    const video = isMobile ? videoRef.current : desktopVideoRef.current;

    if (!video) {
      setStatus("error");
      setErrorTitle("Stream unavailable");
      setErrorMsg("Stream unavailable. Try another channel.");
      return;
    }

    let hls: Hls | null = null;
    let networkRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let mediaRetryTimer: ReturnType<typeof setTimeout> | null = null;

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
        setErrorTitle("Stream unavailable");
        setErrorMsg(
          nativeFallback
            ? "Stream unavailable. Try another channel."
            : "Stream unavailable. Try another channel."
        );
        setStatus("error");
      };

      video.addEventListener("loadedmetadata", onLoadedMeta);
      video.addEventListener("error", onNativeError);

      /* Timeout: if native player can't connect in 15 s, treat as dead */
      const timeout = setTimeout(() => {
        setStatus((s) => {
          if (s === "loading") {
            setErrorTitle("Stream unavailable");
            setErrorMsg(
              "Stream unavailable. Try another channel."
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
        // Auto-skip logic
        const { sidebarChannels: sc, onPlayChannel: opc, channel: currentCh } = skipLogicRef.current;
        let skipped = false;
        if (sc && opc) {
          const idx = sc.findIndex(c => c.id === currentCh.id);
          if (idx !== -1 && idx + 1 < sc.length) {
            console.log(`[Player] Auto-skipping dead stream to next channel: ${sc[idx+1].name}`);
            addDebugLine(`⏭️ Auto-skipping to ${sc[idx+1].name}`);
            opc(sc[idx+1]);
            skipped = true;
          }
        }

        if (!skipped) {
          setErrorTitle(title);
          setErrorMsg(msg);
          setStatus("error");
        }
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
              const activeProxyUrl = getActiveProxyUrl();
              if (resolvedUrl && resolvedUrl.startsWith(activeProxyUrl)) {
                 markProxyFailed(activeProxyUrl);
                 const nextProxyUrl = getActiveProxyUrl();
                 if (nextProxyUrl !== activeProxyUrl) {
                    addDebugLine(`🔄 Proxy failed, switching to ${nextProxyUrl.substring(0, 40)}...`);
                    const newUrl = proxyRewrite(channel.streamUrl!);
                    setResolvedUrl(newUrl);
                    break;
                 }
              }

              hls?.startLoad();
              if (networkRetryTimer) clearTimeout(networkRetryTimer);
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
              if (mediaRetryTimer) clearTimeout(mediaRetryTimer);
              mediaRetryTimer = setTimeout(() => {
                setStatus((s) => {
                  if (s !== "playing") {
                    fallbackOrError(
                      "Stream unavailable",
                      "Stream unavailable. Try another channel."
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
          setErrorTitle("Stream unavailable");
          setErrorMsg(
            "Stream unavailable. Try another channel."
          );
          return "error";
        }
        return s;
      });
    }, 15000);

    return () => {
      clearTimeout(timeout);
      if (networkRetryTimer) clearTimeout(networkRetryTimer);
      if (mediaRetryTimer) clearTimeout(mediaRetryTimer);

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
    <PlayerShell isMobile={isMobile} isLandscape={isLandscape} hasSidebar={!!(sidebarChannels && sidebarChannels.length > 0)}>
      {isMobile ? (
        <>
          <FloatingControls isMobile={true} onClose={onClose} />
          <VideoSurface
            ref={videoRef}
            isMobile={true}
            isLandscape={isLandscape}
            channel={channel}
            status={status}
            resolving={resolving}
            retryCount={retryCount}
            maxRetries={MAX_RETRIES}
            errorTitle={errorTitle}
            errorMsg={errorMsg}
            reportCopied={reportCopied}
            showDebug={showDebug}
            debugLog={debugLog}
            onRetry={handleRetry}
            onReport={handleReportBrokenStream}
            onClose={onClose}
            onPlaying={handlePlaying}
            toggleDebug={() => setShowDebug(p => !p)}
          />
          <PlayerHeader
            isLandscape={isLandscape}
            channelName={channel.name}
            channelCategories={channel.categories}
            channelLogo={channel.logo}
            status={status}
            onClose={onClose}
          />
        </>
      ) : (
        <>
          <div
            className="flex-1 relative rounded-xl overflow-hidden bg-black self-center min-w-0"
            style={{ height: "85vh" }}
          >
            <FloatingControls
              isMobile={false}
              onClose={onClose}
              channel={channel}
              isFav={isFav}
              onToggleFavorite={onToggleFavorite}
            />
            <VideoSurface
              ref={desktopVideoRef}
              isMobile={false}
              isLandscape={false}
              channel={channel}
              status={status}
              resolving={resolving}
              retryCount={retryCount}
              maxRetries={MAX_RETRIES}
              errorTitle={errorTitle}
              errorMsg={errorMsg}
              reportCopied={reportCopied}
              showDebug={showDebug}
              debugLog={debugLog}
              onRetry={handleRetry}
              onReport={handleReportBrokenStream}
              onClose={onClose}
              onPlaying={handlePlaying}
              toggleDebug={() => setShowDebug(p => !p)}
            />
          </div>

          {/* ── SIDEBAR (right) using ChannelList ── */}
          {sidebarChannels && sidebarChannels.length > 0 && (
            <ChannelList
              countryName={sidebarCountryName ?? channel.country ?? "Channels"}
              channels={sidebarChannels}
              loading={sidebarLoading ?? false}
              error={sidebarError ?? null}
              onPlayChannel={onPlayChannel}
              onClose={onClose}
              favorites={favorites ?? []}
              onToggleFavorite={onToggleFavorite ?? (() => {})}
              isPlaying={true}
              playingChannelId={channel.id}
            />
          )}
        </>
      )}
    </PlayerShell>
  );
}
