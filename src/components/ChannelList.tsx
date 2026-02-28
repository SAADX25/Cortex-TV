/* ──────────────────────────────────────────────────
   ChannelList.tsx – Virtualised sidebar listing IPTV
   channels. Uses react-virtuoso so only visible rows
   are mounted – slashing DOM nodes & RAM usage.
   ────────────────────────────────────────────────── */

import { useState, useCallback, useEffect, useMemo, memo } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ChannelWithStream } from "../hooks/useIPTV";

/** Flag CDN URL from ISO alpha-2 code */
const FLAG_CODE_MAP: Record<string, string> = { uk: "gb" };
const flagUrl = (iso: string) => {
  const code = iso.toLowerCase();
  return `https://flagcdn.com/w40/${FLAG_CODE_MAP[code] ?? code}.png`;
};

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

  /* ── Auto-ping on mount (safe with virtuoso — only visible rows mount) ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ch.streamUrl) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    setPingStatus("checking");

    (async () => {
      try {
        timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(ch.streamUrl!, {
          method: "GET",
          mode: "no-cors",
          signal: controller.signal,
        });
        if (timer) clearTimeout(timer);
        if (!controller.signal.aborted) {
          setPingStatus(res.status < 400 || res.type === "opaque" ? "online" : "offline");
        }
      } catch {
        if (!controller.signal.aborted) {
          setPingStatus("offline");
        }
      }
    })();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [ch.streamUrl]);

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
      className={`pointer-events-auto w-full flex items-center gap-4 md:gap-3 rounded-lg px-4 md:px-3 py-3.5 md:py-2.5 mb-1 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 active:scale-[0.98] ${
        isActive
          ? "bg-cyan-500/15 ring-1 ring-cyan-400/30"
          : ch.streamUrl
            ? "hover:bg-cyan-500/10 cursor-pointer"
            : "opacity-40 cursor-not-allowed"
      }`}
    >
      {/* Flag / Logo */}
      <div className="shrink-0 h-10 w-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
        {ch.country ? (
          <img
            src={flagUrl(ch.country)}
            alt={ch.country}
            width={32}
            className="rounded-sm object-cover"
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
            className="h-full w-full object-contain"
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

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${isActive ? "text-cyan-400" : "text-white"}`}>{ch.name}</p>
          {isActive && (
            <span className="shrink-0 flex items-center gap-1 text-[9px] text-cyan-400/80 font-medium uppercase tracking-wider">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_4px_rgba(0,255,255,0.6)]" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {ch.categories.length > 0 && (
            <span className="text-[10px] text-cyan-400/60 uppercase tracking-wider truncate">
              {ch.categories.slice(0, 2).join(" · ")}
            </span>
          )}
        </div>
      </div>

      {/* Stream ping status indicator */}
      {ch.streamUrl && (
        <span
          className={`shrink-0 p-1 transition-all ${pingStyles[pingStatus]}`}
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Activity / signal icon */}
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
        className="shrink-0 p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
        title={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={isFav ? "#22d3ee" : "none"}
          stroke={isFav ? "#22d3ee" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isFav ? "text-cyan-400" : "text-white/30"}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      {/* Stream indicator */}
      {ch.streamUrl ? (
        <div className="shrink-0 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      ) : (
        <span className="shrink-0 text-[10px] text-white/20">offline</span>
      )}
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
  /* Debounced value — filter only runs after 300 ms pause in typing */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* Build a Set for O(1) favourite lookup instead of .some() per row */
  const favSet = useMemo(
    () => new Set(favorites.map((f) => f.id)),
    [favorites]
  );

  const filtered = useMemo(
    () =>
      debouncedSearch
        ? channels.filter(
            (ch) =>
              ch.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              ch.categories.some((c) =>
                c.toLowerCase().includes(debouncedSearch.toLowerCase())
              )
          )
        : channels,
    [channels, debouncedSearch]
  );

  /* Row renderer for Virtuoso */
  const renderRow = useCallback(
    (index: number) => {
      const ch = filtered[index];
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
    [filtered, favSet, playingChannelId, onPlayChannel, onToggleFavorite]
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
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 md:pt-4 pb-5 md:pb-4 border-b border-white/5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">
            {countryName}
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="pointer-events-auto shrink-0 flex items-center justify-center h-10 w-10 md:h-8 md:w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <div className="px-5 py-3 border-b border-white/5">
        <input
          type="text"
          placeholder="Search channels…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 md:px-3 py-3 md:py-2 text-base md:text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
        />
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
            overscan={200}
            className="scrollbar-thin"
            style={{ height: "100%", padding: "8px 12px" }}
          />
        )}
      </div>

      {/* ── Footer stats ── */}
      {!loading && (
        <div className="px-5 py-4 md:py-3 border-t border-white/5 text-[11px] md:text-[10px] text-white/30 flex justify-between">
          <span>
            {filtered.length} channel{filtered.length !== 1 ? "s" : ""}
          </span>
          <span>
            {filtered.filter((c) => c.streamUrl).length} with streams
          </span>
        </div>
      )}
    </div>
  );
}
