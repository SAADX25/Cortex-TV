/* ──────────────────────────────────────────────────
   ChannelList.tsx – Virtualised sidebar listing IPTV
   channels. Uses react-virtuoso so only visible rows
   are mounted – slashing DOM nodes & RAM usage.
   ────────────────────────────────────────────────── */

import { useState, useCallback, useEffect, useMemo, useDeferredValue, useRef, memo } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ChannelWithStream } from "../hooks/useIPTV";

/** Flag CDN URL from ISO alpha-2 code */
const FLAG_CODE_MAP: Record<string, string> = { uk: "gb" };
const flagUrl = (iso: string) => {
  const code = iso.toLowerCase();
  return `https://flagcdn.com/w40/${FLAG_CODE_MAP[code] ?? code}.png`;
};

/**
 * Regex to strip noisy tags from channel display names.
 * Removes [Geo-blocked], [Blocked], [Geo blocked], [Not 24/7], etc.
 */
const STRIP_TAGS_RE = /\[geo[- ]?blocked\]|\[blocked\]|\[not 24\/7\]/gi;
function cleanName(name: string): string {
  return name.replace(STRIP_TAGS_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** Pulsing search icon – identical to the one in SearchModal */
function PulsingSearchIcon({ active }: { active: boolean }) {
  return (
    <div className="relative shrink-0">
      {active && (
        <div className="absolute inset-0 -m-1.5 rounded-full bg-cyan-400/20 animate-ping" />
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`relative ${active ? "text-cyan-400" : "text-white/30"} transition-colors duration-300`}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </div>
  );
}

/** Fallback TV icon */
function FallbackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/25"
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

interface ChannelListProps {
  countryName: string;
  channels: ChannelWithStream[];
  loading: boolean;
  error: string | null;
  onPlayChannel?: (channel: ChannelWithStream) => void;
  onClose?: () => void;
  favorites: ChannelWithStream[];
  onToggleFavorite: (channel: ChannelWithStream) => void;
  /** When true on mobile, adds top padding so the list starts below the docked player */
  isPlaying?: boolean;
  /** The currently-playing channel id (used to highlight the active row) */
  playingChannelId?: string | null;
}

/* ── Memoised row component ── */
const ChannelRow = memo(function ChannelRow({
  ch,
  isFav,
  isActive,
  onPlay,
  onToggleFav,
}: {
  ch: ChannelWithStream;
  isFav: boolean;
  isActive: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
}) {
  const [pingStatus, setPingStatus] = useState<
    "idle" | "checking" | "online" | "offline"
  >("idle");

  /* ── Debounced auto-ping (waits 500ms after mount before firing) ──
     During fast scrolling, rows mount and unmount rapidly. The delay
     ensures we only ping streams the user actually stops and looks at,
     eliminating hundreds of burst network requests on mid-range phones. */
  useEffect(() => {
    if (!ch.streamUrl) return;
    const controller = new AbortController();
    let networkTimer: ReturnType<typeof setTimeout> | null = null;

    /* Wait 500ms before initiating the ping — if the row scrolls
       off-screen before then, the cleanup cancels everything. */
    const debounce = setTimeout(() => {
      setPingStatus("checking");

      (async () => {
        try {
          networkTimer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(ch.streamUrl!, {
            method: "GET",
            mode: "no-cors",
            signal: controller.signal,
          });
          if (networkTimer) clearTimeout(networkTimer);
          if (!controller.signal.aborted) {
            setPingStatus(res.status < 400 || res.type === "opaque" ? "online" : "offline");
          }
        } catch {
          if (!controller.signal.aborted) {
            setPingStatus("offline");
          }
        }
      })();
    }, 500);

    return () => {
      clearTimeout(debounce);
      controller.abort();
      if (networkTimer) clearTimeout(networkTimer);
    };
  }, [ch.streamUrl]);

  const displayName = cleanName(ch.name);

  /* Ping icon styles per status */
  const pingStyles: Record<typeof pingStatus, string> = {
    idle: "text-white/15",
    checking: "text-yellow-400 animate-pulse",
    online: "text-emerald-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]",
    offline: "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]",
  };

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
      className={`group pointer-events-auto w-full rounded-xl border mb-2 text-left transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-blue-400/50 active:scale-[0.98] ${
        isActive
          ? "bg-blue-400 border-transparent shadow-[0_2px_16px_rgba(96,165,250,0.3)]"
          : ch.streamUrl
            ? "border-white/[0.05] bg-white/[0.02] hover:bg-gray-800/60 hover:border-white/[0.08] cursor-pointer"
            : "border-white/[0.03] bg-white/[0.01] opacity-40 cursor-not-allowed"
      }`}
    >
      {/* Main content */}
      <div className="flex items-center gap-3.5 px-4 py-3">
        {/* Flag / Logo – slightly larger with rounded corners */}
        <div className={`shrink-0 h-11 w-11 rounded-lg border flex items-center justify-center overflow-hidden ${
          isActive ? "border-blue-300/30 bg-blue-300/20" : "border-white/[0.06] bg-white/[0.04]"
        }`}>
          {ch.country ? (
            <img
              src={flagUrl(ch.country)}
              alt={ch.country}
              width={36}
              className="rounded-md object-cover"
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (ch.logo && img.src !== ch.logo) {
                  img.src = ch.logo;
                } else {
                  img.style.display = "none";
                  img.parentElement
                    ?.querySelector(".fallback-icon")
                    ?.classList.remove("hidden");
                }
              }}
            />
          ) : ch.logo ? (
            <img
              src={ch.logo}
              alt=""
              className="h-full w-full object-contain p-1"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement)
                  .parentElement?.querySelector(".fallback-icon")
                  ?.classList.remove("hidden");
              }}
            />
          ) : null}
          <span
            className={`fallback-icon ${
              ch.country || ch.logo ? "hidden" : ""
            }`}
          >
            <FallbackIcon />
          </span>
        </div>

        {/* Info block */}
        <div className="min-w-0 flex-1">
          {/* Name row */}
          <div className="flex items-center gap-2">
            <p className={`text-[14px] font-semibold truncate leading-tight ${
              isActive ? "text-black" : "text-white group-hover:text-white/90"
            } transition-colors duration-200`}>
              {displayName}
            </p>
            {/* YouTube badge */}
            {ch.streamUrl && (ch.streamUrl.includes("youtube.com") || ch.streamUrl.includes("youtu.be") || ch.streamUrl.includes("yt.be") || ch.streamUrl.includes("googlevideo.com")) && (
              <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/15">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 28.57 20"
                  className="h-2.5 w-auto text-red-400"
                  aria-label="YouTube"
                >
                  <path
                    fill="currentColor"
                    d="M27.97 3.12A3.58 3.58 0 0 0 25.45.6C23.22 0 14.28 0 14.28 0S5.35 0 3.12.6A3.58 3.58 0 0 0 .6 3.12C0 5.35 0 10 0 10s0 4.65.6 6.88a3.58 3.58 0 0 0 2.52 2.52C5.35 20 14.28 20 14.28 20s8.94 0 11.17-.6a3.58 3.58 0 0 0 2.52-2.52c.6-2.23.6-6.88.6-6.88s0-4.65-.6-6.88Z"
                  />
                  <path fill="#fff" d="m11.43 14.28 7.44-4.28-7.44-4.28v8.56Z" />
                </svg>
                <span className="text-[8px] font-bold text-red-400/70 uppercase tracking-wide">YT</span>
              </span>
            )}
          </div>
          {/* Category + status row */}
          <div className="flex items-center gap-2 mt-1">
            {ch.categories.length > 0 && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                isActive ? "bg-blue-300/25 text-blue-900" : "text-white/30"
              }`}>
                {ch.categories[0].substring(0, 8)}
              </span>
            )}
            {isActive && (
              <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-300/20">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-900 animate-pulse" />
                <span className="text-[8px] text-blue-900 font-bold uppercase tracking-wider">Playing</span>
              </span>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Stream ping status */}
          {ch.streamUrl && (
            <span
              className={`p-1 transition-all ${pingStyles[pingStatus]}`}
              title={
                pingStatus === "idle"
                  ? "Waiting…"
                  : pingStatus === "checking"
                    ? "Checking…"
                    : pingStatus === "online"
                      ? "Stream is online"
                      : "Stream is offline"
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
          )}

          {/* Favorite star */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-90 ${
              isFav
                ? isActive ? "bg-black/10 hover:bg-black/20" : "bg-amber-400/10 hover:bg-amber-400/20"
                : isActive ? "hover:bg-black/10" : "hover:bg-white/[0.06]"
            }`}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={isFav ? (isActive ? "#1e3a5f" : "#fbbf24") : "none"}
              stroke={isFav ? (isActive ? "#1e3a5f" : "#fbbf24") : (isActive ? "#1e3a5f" : "currentColor")}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isFav ? "drop-shadow-[0_0_3px_rgba(251,191,36,0.3)]" : isActive ? "text-blue-900/50" : "text-white/20"}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>

          {/* Stream status dot */}
          {ch.streamUrl ? (
            <div className={`h-2.5 w-2.5 rounded-full ring-2 ${
              isActive
                ? "bg-blue-900/60 ring-blue-900/20"
                : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] ring-emerald-400/10"
            }`} />
          ) : (
            <span className={`text-[9px] font-medium uppercase tracking-wider ${isActive ? "text-blue-900/50" : "text-white/15"}`}>off</span>
          )}
        </div>
      </div>
    </div>
    );
  });

export default function ChannelList({
  countryName,
  channels,
  loading,
  error,
  onPlayChannel,
  onClose,
  favorites,
  onToggleFavorite,
  isPlaying = false,
  playingChannelId = null,
}: ChannelListProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  /* useDeferredValue lets React keep the input snappy while deferring
     the expensive filter/re-render to a lower-priority update */
  const deferredSearch = useDeferredValue(search);
  const isStale = search !== deferredSearch;

  /* Build a Set for O(1) favourite lookup instead of .some() per row */
  const favSet = useMemo(
    () => new Set(favorites.map((f) => f.id)),
    [favorites]
  );

  const filtered = useMemo(
    () => {
      if (!deferredSearch) return channels;
      const q = deferredSearch.toLowerCase();
      return channels.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          ch.categories.some((c) => c.toLowerCase().includes(q))
      );
    },
    [channels, deferredSearch]
  );

  /* Stable ref for filtered list — prevents renderRow identity from
     changing on every keystroke, so Virtuoso can skip re-renders of
     rows whose data hasn't actually changed. */
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  /* Row renderer for Virtuoso (stable identity via ref) */
  const renderRow = useCallback(
    (index: number) => {
      const ch = filteredRef.current[index];
      if (!ch) return null;
      return (
        <ChannelRow
          ch={ch}
          isFav={favSet.has(ch.id)}
          isActive={ch.id === playingChannelId}
          onPlay={() => onPlayChannel?.(ch)}
          onToggleFav={() => onToggleFavorite(ch)}
        />
      );
    },
    [favSet, playingChannelId, onPlayChannel, onToggleFavorite]
  );

  /* Empty / loading / error states shown inside the Virtuoso area */
  const showVirtualList = !loading && !error && filtered.length > 0;

  return (
    <div
      className={
        "fixed top-12 md:top-0 bottom-0 right-0 w-full md:w-[420px] md:max-w-full z-[60] md:z-30 md:absolute flex flex-col bg-black/95 md:bg-black/80 backdrop-blur-xl border-l border-cyan-500/15 animate-slide-in" +
        /* When the player is docked at top on mobile, push list below video + control bar */
        (isPlaying ? " pt-[calc(100vw*9/16+2.5rem)] md:pt-0" : "") +
        /* Always leave room for the bottom nav bar on mobile */
        " pb-24 md:pb-0"
      }
    >
      {/* ── Header + Search (combined glassmorphic block) ── */}
      <div className="shrink-0 bg-gradient-to-b from-white/[0.03] to-transparent">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
          <div className="min-w-0 flex-1">
            {countryName !== "Quick Access News" && countryName !== "Favorite Channels" && (
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-400/50 mb-1">Browsing</p>
            )}
            <h2 className="text-xl font-bold text-white truncate leading-tight">
              {countryName}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="pointer-events-auto shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer active:scale-90"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Search bar — cloned from SearchModal for visual consistency */}
        <div className="px-5 pt-3 pb-4">
          <div
            className={`flex relative items-center gap-3 rounded-xl border h-12 px-5 transition-all duration-300 shadow-lg ${
              focused
                ? "border-cyan-500/40 bg-[#1a2b4c] ring-2 ring-cyan-500/20 shadow-[0_4px_28px_rgba(0,255,255,0.12)]"
                : "border-white/10 bg-[#1a2b4c]"
            }`}
          >
            <PulsingSearchIcon active={focused || !!search} />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search channels, countries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent text-[15px] md:text-lg text-white placeholder-white/25 outline-none font-light tracking-wide min-w-0 caret-cyan-400"
            />
            {/* Result badge */}
            {search && !isStale && (
              <span className="shrink-0 text-xs text-cyan-400/60 font-mono">
                {filtered.length} found
              </span>
            )}
            {/* Spinner while deferred */}
            {isStale && (
              <div className="shrink-0 h-5 w-5 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
            )}
            {/* Clear query button */}
            {search && (
              <button
                onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                className="shrink-0 flex items-center justify-center h-9 w-9 -mr-2 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/40 hover:text-white/80 transition-all active:scale-95 cursor-pointer"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bottom separator */}
        <div className={`h-px transition-colors duration-300 ${
          search ? "bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" : "bg-white/[0.04]"
        }`} />
      </div>

      {/* ── Virtualised list ── */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <span className="text-sm text-white/40">Loading channels…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 my-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-3">📡</div>
            <p className="text-sm text-white/40">
              {search
                ? "No channels match your search."
                : "No channels found for this country."}
            </p>
          </div>
        )}

        {showVirtualList && (
          <Virtuoso
            totalCount={filtered.length}
            itemContent={renderRow}
            overscan={{ main: 300, reverse: 100 }}
            className="scrollbar-thin"
            style={{ height: "100%", padding: "8px 12px" }}
          />
        )}
      </div>

      {/* ── Footer stats ── */}
      {!loading && (
        <div className="shrink-0 px-5 py-3.5 md:py-2.5 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400/40" />
            <span className="text-[11px] md:text-[10px] text-white/30 font-medium">
              {filtered.length} channel{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] md:text-[10px] text-emerald-400/40 font-medium">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
            {filtered.filter((c) => c.streamUrl).length} live
          </span>
        </div>
      )}
    </div>
  );
}
