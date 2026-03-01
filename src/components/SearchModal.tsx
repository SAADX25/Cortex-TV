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
import { Virtuoso } from "react-virtuoso";

/* ── Flag CDN helper ── */
const FLAG_CODE_MAP: Record<string, string> = { uk: "gb" };
const flagUrl = (iso: string) => {
  const code = iso.toLowerCase();
  return `https://flagcdn.com/w80/${FLAG_CODE_MAP[code] ?? code}.png`;
};

/* ── Category icon components (inline Lucide-style SVGs) ── */
const CatIcons: Record<string, React.ReactNode> = {
  all: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
  ),
  news: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
  ),
  sports: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  ),
  movies: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7 3 0 18"/><path d="m17 3 0 18"/><path d="M3 7.5h4"/><path d="M17 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 16.5h4"/></svg>
  ),
  music: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  ),
  entertainment: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>
  ),
  kids: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></svg>
  ),
};

/* ── Large category icons for mobile grid tiles ── */
const GridCatIcons: Record<string, React.ReactNode> = {
  all: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
  ),
  news: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
  ),
  sports: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  ),
  movies: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7 3 0 18"/><path d="m17 3 0 18"/><path d="M3 7.5h4"/><path d="M17 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 16.5h4"/></svg>
  ),
  music: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  ),
  entertainment: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>
  ),
  kids: (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></svg>
  ),
};

/* ── Quick-filter categories ── */
const FILTER_CHIPS = [
  { label: "All", value: null, icon: "all" },
  { label: "Sports", value: "sports", icon: "sports" },
  { label: "Movies", value: "movies", icon: "movies" },
  { label: "Music", value: "music", icon: "music" },
  { label: "Entertainment", value: "entertainment", icon: "entertainment" },
  { label: "Kids", value: "kids", icon: "kids" },
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
  onNavigate?: (tab: "globe" | "search" | "favorites" | "settings" | "news") => void;
}

export default function SearchModal({
  open,
  onClose,
  onSelectChannel,
  onNavigate,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [results, setResults] = useState<ChannelWithStream[]>([]);
  const [searching, setSearching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    }, 300);

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
      className={`fixed top-12 md:top-0 bottom-0 left-0 right-0 z-[200] flex flex-col bg-[#0f172a] md:bg-transparent pb-20 md:pb-0 ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
    >
      {/* ── Full-screen backdrop (desktop only – mobile has solid bg) ── */}
      <div className="hidden md:block absolute inset-0 bg-black/80 backdrop-blur-xl" />

      {/* ── Content wrapper ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex-1 flex flex-col overflow-hidden ${closing ? "animate-modal-out" : "animate-modal-in"}`}
      >
        {/* ── Search area ── */}
        <div className={`shrink-0 w-full max-w-2xl mx-auto px-4 md:px-6 pb-0 pt-4 md:pt-6 md:transition-all md:duration-500 md:ease-out ${
          showHint
            ? "md:pt-[32vh]"
            : "md:pt-12"
        }`}>

          {/* ── Search bar (mobile + desktop) ── */}
          <div
            className={`flex relative items-center gap-3 md:gap-4 rounded-xl md:rounded-full border h-12 md:h-14 px-5 md:px-6 transition-all duration-300 shadow-lg md:shadow-none ${
              focused
                ? "border-cyan-500/40 bg-[#1a2b4c] md:ring-2 ring-cyan-500/20 shadow-[0_4px_28px_rgba(0,255,255,0.12)] md:shadow-[0_4px_24px_rgba(0,255,255,0.04)]"
                : "border-white/10 bg-[#1a2b4c] md:border-transparent md:bg-white/[0.07] md:hover:bg-white/[0.11]"
            }`}
          >
            <PulsingSearchIcon active={focused || hasQuery} />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search channels, countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent text-[15px] md:text-lg text-white placeholder-white/25 outline-none font-light tracking-wide min-w-0 caret-cyan-400"
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
            {/* Clear query button */}
            {hasQuery && (
              <button
                onClick={() => setQuery("")}
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

          {/* ── Mobile: square grid tiles (idle discovery) ── */}
          {showHint && (
            <div className="md:hidden grid grid-cols-3 gap-4 mt-8">
              {FILTER_CHIPS.map((chip) => {
                const isActive = activeFilter === chip.value;
                return (
                  <button
                    key={chip.label}
                    onClick={() => setActiveFilter(isActive ? null : chip.value)}
                    className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all duration-200 active:scale-95 cursor-pointer ${
                      isActive
                        ? "bg-cyan-600 border-cyan-400/40 shadow-xl shadow-cyan-500/30 text-white"
                        : "bg-white/[0.03] border-white/5 text-white/60 backdrop-blur-md"
                    }`}
                  >
                    {GridCatIcons[chip.icon]}
                    <span className="text-sm font-medium text-white/90">{chip.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Mobile: compact chip strip (while searching / results active) ── */}
          {!showHint && (
            <div className="md:hidden flex items-center gap-2 mt-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {FILTER_CHIPS.map((chip) => {
                const isActive = activeFilter === chip.value;
                return (
                  <button
                    key={chip.label}
                    onClick={() => setActiveFilter(isActive ? null : chip.value)}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] whitespace-nowrap transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-cyan-500 text-black font-bold shadow-lg shadow-cyan-500/30 scale-[1.02]"
                        : "bg-white/[0.06] text-gray-300 font-medium active:bg-white/[0.12] active:scale-95"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Desktop: horizontal pill chips ── */}
          <div className="hidden md:flex items-center gap-2.5 mt-5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.value;
              return (
                <button
                  key={chip.label}
                  onClick={() => setActiveFilter(isActive ? null : chip.value)}
                  className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-cyan-500 text-black font-bold shadow-lg shadow-cyan-500/30 scale-[1.02]"
                      : "bg-white/[0.06] text-gray-300 font-medium hover:bg-white/10"
                  }`}
                >
                  {CatIcons[chip.icon]}
                  {chip.label}
                </button>
              );
            })}
          </div>

        </div>

        {/* ── Results / states area ── */}
        <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto scrollbar-thin transition-all duration-500 ease-out [-webkit-overflow-scrolling:touch] ${
          showHint ? "md:opacity-0 md:pointer-events-none" : "mt-4 md:mt-6 opacity-100"
        }`}>

          <div className="w-full max-w-5xl mx-auto px-4 md:px-6 pb-24 md:pb-24">
            {/* Loading state */}
            {searching && (
              <div className="flex flex-col items-center justify-center py-14 md:py-20">
                <div className="relative">
                  <div className="h-8 w-8 md:h-10 md:w-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
                  </div>
                </div>
                <p className="mt-3 md:mt-4 text-[13px] md:text-sm text-white/25">Searching global database…</p>
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div className="flex flex-col items-center justify-center py-14 md:py-20 text-center">
                <div className="relative mb-4 md:mb-5">
                  <div className="absolute inset-0 -m-4 rounded-full bg-red-500/5 blur-xl" />
                  <div className="relative p-3.5 md:p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <BrokenSignalIcon />
                  </div>
                </div>
                <h3 className="text-[15px] md:text-base font-semibold text-white/50 mb-1.5">
                  No channels found
                </h3>
                <p className="text-[13px] md:text-sm text-white/20 max-w-md px-4">
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

            {/* Results */}
            {showResults && (
              <>
                {/* Results count bar */}
                <div className="flex items-center justify-between mb-3 md:mb-4 px-1">
                  <p className="text-[11px] text-white/20 uppercase tracking-wider">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                    {resultCount > 0 && (
                      <> · <span className="text-emerald-400/50">{resultCount} live</span></>
                    )}
                  </p>
                  {hasFilter && (
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="text-[10px] text-cyan-400/50 hover:text-cyan-400 active:text-cyan-300 transition-colors cursor-pointer"
                    >
                      Clear filter ✕
                    </button>
                  )}
                </div>

                {/* Mobile: virtualised compact list (RAM saver – only visible rows mount) */}
                <div className="md:hidden">
                  {scrollContainerRef.current && (
                    <Virtuoso
                      customScrollParent={scrollContainerRef.current}
                      totalCount={results.length}
                      overscan={300}
                      itemContent={(index) => {
                        const ch = results[index];
                        return (
                          <div className="mb-1">
                            <ResultCard
                              channel={ch}
                              onSelect={() => handleSelect(ch)}
                            />
                          </div>
                        );
                      }}
                    />
                  )}
                </div>

                {/* Desktop: card grid */}
                <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

        {/* ── Mobile: bottom nav dock ── */}
        <div className="md:hidden shrink-0 fixed bottom-0 left-0 right-0 z-[9001]">
          <div className="bg-[#0A0F1C] border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
            {/* Navigation row */}
            <div className="flex items-stretch h-[52px]">
              {/* Globe */}
              <button
                onClick={() => onNavigate?.("globe")}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/40 active:text-white/60 active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                <span className="text-[9px] font-medium tracking-wide">Globe</span>
              </button>

              {/* Search (active) */}
              <button
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-cyan-400 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="text-[9px] font-bold tracking-wide">Search</span>
              </button>

              {/* Favorites */}
              <button
                onClick={() => onNavigate?.("favorites")}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/40 active:text-white/60 active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-[9px] font-medium tracking-wide">Favorites</span>
              </button>

              {/* News */}
              <button
                onClick={() => onNavigate?.("news")}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/40 active:text-white/60 active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                  <path d="M18 14h-8" />
                  <path d="M15 18h-5" />
                  <path d="M10 6h8v4h-8V6Z" />
                </svg>
                <span className="text-[9px] font-medium tracking-wide">News</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => onNavigate?.("settings")}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/40 active:text-white/60 active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-[9px] font-medium tracking-wide">Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom keyboard hint bar (hidden on mobile — no keyboard shortcuts) ── */}
        <div className="shrink-0 absolute bottom-0 inset-x-0 hidden md:flex items-center justify-center gap-6 py-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
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
