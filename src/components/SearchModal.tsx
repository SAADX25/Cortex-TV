/* ──────────────────────────────────────────────────
   SearchModal.tsx – Minimalist Search
   Glassmorphic fullscreen overlay with centered
   search bar that transitions upward on results.
   ────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  searchAllChannels,
  preloadIPTVData,
  type ChannelWithStream,
} from "../hooks/useIPTV";

/* ── Flag CDN helper ── */
const FLAG_CODE_MAP: Record<string, string> = { uk: "gb" };
const flagUrl = (iso: string) => {
  const code = iso.toLowerCase();
  return `https://flagcdn.com/w80/${FLAG_CODE_MAP[code] ?? code}.png`;
};

/* ── Quick-filter categories ── */
const FILTER_CHIPS = [
  { label: "All", value: null },
  { label: "News", value: "news" },
  { label: "Sports", value: "sports" },
  { label: "Movies", value: "movies" },
  { label: "Music", value: "music" },
  { label: "Entertainment", value: "entertainment" },
  { label: "Kids", value: "kids" },
] as const;

/* ── Pulsing search icon ── */
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

/* ── Broken signal icon for empty state ── */
function BrokenSignalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/15"
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="15" x2="18" y2="15" />
      <line x1="11" y1="18" x2="16" y2="18" />
      <line x1="3" y1="5" x2="21" y2="21" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Result card ── */
function ResultCard({
  channel,
  onSelect,
}: {
  channel: ChannelWithStream;
  onSelect: () => void;
}) {
  const hasStream = !!channel.streamUrl;
  return (
    <div
      className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
        hasStream
          ? "border-white/[0.06] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:shadow-[0_0_30px_rgba(0,255,255,0.06)] cursor-pointer"
          : "border-white/[0.04] bg-white/[0.015] opacity-40 cursor-not-allowed"
      }`}
      onClick={() => hasStream && onSelect()}
    >
      {/* Top section */}
      <div className="p-4 pb-3">
        {/* Country flag badge + stream dot */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {channel.country ? (
              <div className="h-6 w-8 rounded overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                <img
                  src={flagUrl(channel.country)}
                  alt={channel.country}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    img.parentElement!.querySelector(".flag-fb")?.classList.remove("hidden");
                  }}
                />
                <span className="flag-fb hidden text-[8px] text-white/30 font-mono uppercase">
                  {channel.country}
                </span>
              </div>
            ) : null}
            <span className="text-[10px] text-white/25 uppercase tracking-wider font-mono">
              {channel.country || "??"}
            </span>
          </div>

          {hasStream ? (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              <span className="text-[9px] text-emerald-400/60 uppercase tracking-wider">Live</span>
            </div>
          ) : (
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Offline</span>
          )}
        </div>

        {/* Channel logo + name */}
        <div className="flex items-center gap-3">
          {channel.logo ? (
            <div className="shrink-0 h-9 w-9 rounded-lg bg-white/5 border border-white/[0.06] flex items-center justify-center overflow-hidden">
              <img
                src={channel.logo}
                alt=""
                className="h-full w-full object-contain p-1"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors duration-300">
              {channel.name}
            </p>
            {channel.categories.length > 0 && (
              <p className="text-[10px] text-white/25 uppercase tracking-wider truncate mt-0.5">
                {channel.categories.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Play Now button (hover reveal) */}
      {hasStream && (
        <div className="px-4 pb-3 pt-0">
          <div className="h-0 group-hover:h-9 overflow-hidden transition-all duration-300 ease-out">
            <button className="w-full h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 text-xs font-medium flex items-center justify-center gap-2 hover:bg-cyan-500/25 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Play Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════ */

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectChannel: (channel: ChannelWithStream) => void;
}

export default function SearchModal({
  open,
  onClose,
  onSelectChannel,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [results, setResults] = useState<ChannelWithStream[]>([]);
  const [searching, setSearching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Preload IPTV data when modal first opens */
  useEffect(() => {
    if (open) preloadIPTVData();
  }, [open]);

  /* Reset state on open */
  useEffect(() => {
    if (open) {
      setClosing(false);
      setQuery("");
      setActiveFilter(null);
      setResults([]);
      setFocused(false);
      setTimeout(() => {
        inputRef.current?.focus();
        setFocused(true);
      }, 150);
    }
  }, [open]);

  /* Debounced search — reacts to both query and filter */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasQuery = query.trim().length > 0;
    const hasFilter = activeFilter !== null;

    if (!hasQuery && !hasFilter) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchAllChannels(
        query,
        80,
        activeFilter
      );
      setResults(res);
      setSearching(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeFilter]);

  /* Animated close */
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  /* Select a result */
  const handleSelect = useCallback(
    (ch: ChannelWithStream) => {
      onSelectChannel(ch);
      handleClose();
    },
    [onSelectChannel, handleClose]
  );

  /* Derived states */
  const hasQuery = query.trim().length > 0;
  const hasFilter = activeFilter !== null;
  const showResults = !searching && results.length > 0;
  const showEmpty = !searching && (hasQuery || hasFilter) && results.length === 0;
  const showHint = !searching && !hasQuery && !hasFilter;

  const resultCount = useMemo(
    () => results.filter((r) => r.streamUrl).length,
    [results]
  );

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
      onClick={handleClose}
    >
      {/* ── Full-screen backdrop ── */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

      {/* ── Content wrapper ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex-1 flex flex-col overflow-hidden ${closing ? "animate-modal-out" : "animate-modal-in"}`}
      >
        {/* ── Search area — centered initially, slides up on results ── */}
        <div className={`shrink-0 w-full max-w-2xl mx-auto px-6 pb-0 transition-all duration-500 ease-out ${
          showHint ? "pt-[32vh]" : "pt-[6vh]"
        }`}>
          {/* ── Large search input ── */}
          <div
            className={`relative flex items-center gap-4 rounded-2xl border px-6 py-4 transition-all duration-500 ${
              focused
                ? "border-cyan-500/40 bg-white/[0.04] shadow-[0_0_40px_rgba(0,255,255,0.08),inset_0_0_20px_rgba(0,255,255,0.03)]"
                : "border-white/[0.06] bg-white/[0.02]"
            }`}
          >
            <PulsingSearchIcon active={focused || hasQuery} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search channels, categories, or countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent text-lg text-white placeholder-white/20 outline-none font-light tracking-wide"
            />
            {/* Result badge */}
            {(hasQuery || hasFilter) && !searching && results.length > 0 && (
              <span className="shrink-0 text-xs text-cyan-400/60 font-mono">
                {results.length} found
              </span>
            )}
            {searching && (
              <div className="shrink-0 h-5 w-5 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
            )}
          </div>

          {/* ── Quick filter chips ── */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-thin">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.value;
              return (
                <button
                  key={chip.label}
                  onClick={() =>
                    setActiveFilter(isActive ? null : chip.value)
                  }
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer border ${
                    isActive
                      ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(0,255,255,0.1)]"
                      : "bg-white/[0.03] border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/15 hover:bg-white/[0.06]"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Results / states area ── */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin transition-all duration-500 ease-out ${
          showHint ? "opacity-0 pointer-events-none" : "mt-6 opacity-100"
        }`}>
          <div className="w-full max-w-5xl mx-auto px-6 pb-24">
            {/* Loading state */}
            {searching && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
                  </div>
                </div>
                <p className="mt-4 text-sm text-white/25">Searching global database…</p>
              </div>
            )}



            {/* Empty state */}
            {showEmpty && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-5">
                  <div className="absolute inset-0 -m-4 rounded-full bg-red-500/5 blur-xl" />
                  <div className="relative p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <BrokenSignalIcon />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white/50 mb-1.5">
                  No channels found
                </h3>
                <p className="text-sm text-white/20 max-w-md">
                  No channels found in the global database
                  {hasQuery && (
                    <> matching &ldquo;<span className="text-cyan-400/50">{query}</span>&rdquo;</>
                  )}
                  {hasFilter && (
                    <> in <span className="text-cyan-400/50 capitalize">{activeFilter}</span></>
                  )}
                  . Try a different search term or filter.
                </p>
              </div>
            )}

            {/* Results grid */}
            {showResults && (
              <>
                {/* Results count bar */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] text-white/20 uppercase tracking-wider">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                    {resultCount > 0 && (
                      <> · <span className="text-emerald-400/50">{resultCount} live</span></>
                    )}
                  </p>
                  {hasFilter && (
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="text-[10px] text-cyan-400/50 hover:text-cyan-400 transition-colors cursor-pointer"
                    >
                      Clear filter ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {results.map((ch) => (
                    <ResultCard
                      key={ch.id}
                      channel={ch}
                      onSelect={() => handleSelect(ch)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Bottom keyboard hint bar ── */}
        <div className="shrink-0 absolute bottom-0 inset-x-0 flex items-center justify-center gap-6 py-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded text-[10px] font-mono text-white/25 bg-white/[0.04] border border-white/[0.06]">
              ESC
            </kbd>
            <span className="text-[10px] text-white/20">to exit</span>
          </div>
          <div className="h-3 w-px bg-white/[0.06]" />
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded text-[10px] font-mono text-white/25 bg-white/[0.04] border border-white/[0.06]">
              ↵
            </kbd>
            <span className="text-[10px] text-white/20">to select</span>
          </div>
          <div className="h-3 w-px bg-white/[0.06]" />
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded text-[10px] font-mono text-white/25 bg-white/[0.04] border border-white/[0.06]">
              Ctrl K
            </kbd>
            <span className="text-[10px] text-white/20">to open search</span>
          </div>
        </div>
      </div>
    </div>
  );
}
