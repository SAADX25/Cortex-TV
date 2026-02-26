/* ──────────────────────────────────────────────────
   ChannelList.tsx – Slide-in sidebar listing IPTV
   channels for the selected country.
   ────────────────────────────────────────────────── */

import { useState, useCallback } from "react";
import type { ChannelWithStream } from "../hooks/useIPTV";

/** Build a flag CDN URL from a lowercase ISO 3166-1 alpha-2 code */
const flagUrl = (iso: string) =>
  `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;

/** Fallback TV icon shown when no flag/logo is available */
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
  /** Country display name shown in the header */
  countryName: string;
  /** Filtered channel list */
  channels: ChannelWithStream[];
  /** Whether the data is still loading */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Called when a playable channel is selected */
  onPlayChannel?: (channel: ChannelWithStream) => void;
  /** Close the sidebar */
  onClose: () => void;
}

export default function ChannelList({
  countryName,
  channels,
  loading,
  error,
  onPlayChannel,
  onClose,
}: ChannelListProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? channels.filter(
        (ch) =>
          ch.name.toLowerCase().includes(search.toLowerCase()) ||
          ch.categories.some((c) =>
            c.toLowerCase().includes(search.toLowerCase())
          )
      )
    : channels;

  return (
    <div className="absolute inset-y-0 right-0 w-[420px] max-w-full z-30 flex flex-col bg-black/80 backdrop-blur-xl border-l border-cyan-500/15 animate-slide-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/70">
            Channels
          </p>
          <h2 className="text-lg font-semibold text-white truncate">
            {countryName}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-5 py-3 border-b border-white/5">
        <input
          type="text"
          placeholder="Search channels…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
        />
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <span className="text-sm text-white/40">
                Loading channels…
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-2 my-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
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

        {!loading &&
          filtered.map((ch) => (
            <button
              key={ch.id}
              onClick={() => ch.streamUrl && onPlayChannel?.(ch)}
              disabled={!ch.streamUrl}
              className={`pointer-events-auto w-full flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1 text-left transition-colors ${
                ch.streamUrl
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
                      /* Flag failed → try channel logo, else show fallback */
                      const img = e.target as HTMLImageElement;
                      if (ch.logo && img.src !== ch.logo) {
                        img.src = ch.logo;
                      } else {
                        img.style.display = "none";
                        img.parentElement!.querySelector(".fallback-icon")
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
                        .parentElement!.querySelector(".fallback-icon")
                        ?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span className={`fallback-icon ${ch.country || ch.logo ? "hidden" : ""}`}>
                  <FallbackIcon />
                </span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {ch.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {ch.categories.length > 0 && (
                    <span className="text-[10px] text-cyan-400/60 uppercase tracking-wider truncate">
                      {ch.categories.slice(0, 2).join(" · ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Stream indicator */}
              {ch.streamUrl ? (
                <div className="shrink-0 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              ) : (
                <span className="shrink-0 text-[10px] text-white/20">
                  offline
                </span>
              )}
            </button>
          ))}
      </div>

      {/* ── Footer stats ── */}
      {!loading && (
        <div className="px-5 py-3 border-t border-white/5 text-[10px] text-white/30 flex justify-between">
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
