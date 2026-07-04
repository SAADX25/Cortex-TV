import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  getBrowseMetadata,
  preloadIPTVData,
  searchAllChannels,
  type BrowseMetadata,
  type ChannelWithStream,
  type SearchFilters,
} from "../hooks/useIPTV";
import {
  CATEGORY_DEFS,
  categoryDisplayName,
  cleanName,
  countryName,
  flagUrl,
  getStreamHealth,
  streamHealthLabel,
} from "../utils/channelUtils";

const DEFAULT_FILTERS: SearchFilters = {
  country: null,
  category: null,
  language: null,
  favoritesOnly: false,
  workingOnly: false,
};

const CATEGORY_ICONS: Record<string, ReactNode> = {
  all: <GlobeIcon />,
  sports: <TrophyIcon />,
  movies: <FilmIcon />,
  music: <MusicIcon />,
  news: <NewsIcon />,
  entertainment: <SparkIcon />,
  kids: <SmileIcon />,
};

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectChannel: (channel: ChannelWithStream) => void;
  initialFilters?: SearchFilters;
  favorites?: ChannelWithStream[];
  recentChannels?: ChannelWithStream[];
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M2 14h4" />
      <path d="M10 8h4" />
      <path d="M18 16h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M3 12h18" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
      <path d="M18 14h-8" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6" />
      <path d="M12 16v6" />
      <path d="M2 12h6" />
      <path d="M16 12h6" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function mergeFilters(filters?: SearchFilters): SearchFilters {
  return { ...DEFAULT_FILTERS, ...(filters ?? {}) };
}

function hasActiveFilters(filters: SearchFilters): boolean {
  return !!(filters.country || filters.category || filters.language || filters.favoritesOnly || filters.workingOnly);
}

function countActiveFilters(filters: SearchFilters): number {
  return [filters.country, filters.category, filters.language, filters.favoritesOnly, filters.workingOnly].filter(Boolean).length;
}

function ResultRow({
  channel,
  highlighted,
  isFavorite,
  isRecent,
  onSelect,
  onHighlight,
}: {
  channel: ChannelWithStream;
  highlighted: boolean;
  isFavorite: boolean;
  isRecent: boolean;
  onSelect: () => void;
  onHighlight: () => void;
}) {
  const health = getStreamHealth(channel.streamUrl, channel.streamStatus, channel.name, channel.country);
  const disabled = !channel.streamUrl;
  const healthTone =
    health === "online"
      ? "bg-emerald-400/90 text-emerald-950"
      : health === "geo-blocked"
        ? "bg-amber-300/90 text-amber-950"
        : health === "offline"
          ? "bg-red-400/90 text-red-950"
          : "bg-white/[0.09] text-white/58";

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      onMouseEnter={onHighlight}
      disabled={disabled}
      className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed ${highlighted ? "border-cyan-300/42 bg-cyan-300/[0.10]" : "border-white/[0.06] bg-white/[0.035] hover:border-cyan-300/22 hover:bg-cyan-300/[0.055]"} ${disabled ? "opacity-55" : ""}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.055]">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt=""
            className="h-full w-full object-contain p-1.5"
            loading="lazy"
            onError={(event) => {
              const img = event.currentTarget;
              if (channel.country) img.src = flagUrl(channel.country, 80);
              else img.style.display = "none";
            }}
          />
        ) : channel.country ? (
          <img src={flagUrl(channel.country, 80)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <GlobeIcon />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-white/90">{cleanName(channel.name)}</p>
          {isFavorite && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-200">Fav</span>}
          {isRecent && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-cyan-200">Recent</span>}
        </div>
        <p className="mt-1 truncate text-xs text-white/38">
          {channel.countryName ?? countryName(channel.country)} / {channel.categories[0] ? categoryDisplayName(channel.categories[0]) : "General"}
          {channel.languageNames?.[0] ? ` / ${channel.languageNames[0]}` : ""}
        </p>
      </div>
      <span className={`hidden shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${healthTone}`}>
        {streamHealthLabel(health)}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-100">
        <PlayIcon />
      </span>
    </button>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string | null;
  options: Array<{ value: string; label: string; count?: number }>;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-10 min-w-0 rounded-lg border border-white/[0.08] bg-[#111d33] px-3 text-sm text-white/82 outline-none transition-all focus:border-cyan-300/40"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}{option.count !== undefined ? ` (${option.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex h-10 items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-white/74">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
    </label>
  );
}

function FilterPanel({
  metadata,
  filters,
  setFilter,
  clearFilters,
}: {
  metadata: BrowseMetadata | null;
  filters: SearchFilters;
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-white/[0.07] bg-black/24 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
      <SelectFilter label="Country" value={filters.country} options={metadata?.countries ?? []} onChange={(value) => setFilter("country", value)} />
      <SelectFilter label="Category" value={filters.category} options={(metadata?.categories ?? []).filter((item) => item.value !== "all")} onChange={(value) => setFilter("category", value)} />
      <SelectFilter label="Language" value={filters.language} options={metadata?.languages ?? []} onChange={(value) => setFilter("language", value)} />
      <ToggleFilter label="Favorites" checked={!!filters.favoritesOnly} onChange={(checked) => setFilter("favoritesOnly", checked)} />
      <ToggleFilter label="Working" checked={!!filters.workingOnly} onChange={(checked) => setFilter("workingOnly", checked)} />
      {hasActiveFilters(filters) && (
        <button type="button" onClick={clearFilters} className="h-10 rounded-lg border border-cyan-300/18 px-3 text-xs font-semibold text-cyan-100/82 transition-all hover:bg-cyan-300/10 sm:col-span-2 lg:col-span-5">
          Clear filters
        </button>
      )}
    </div>
  );
}

export default function SearchModal({
  open,
  onClose,
  onSelectChannel,
  initialFilters,
  favorites = [],
  recentChannels = [],
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(() => mergeFilters(initialFilters));
  const [metadata, setMetadata] = useState<BrowseMetadata | null>(null);
  const [results, setResults] = useState<ChannelWithStream[]>([]);
  const [searching, setSearching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const favoriteIds = useMemo(() => favorites.map((channel) => channel.id), [favorites]);
  const recentIds = useMemo(() => recentChannels.map((channel) => channel.id), [recentChannels]);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const recentSet = useMemo(() => new Set(recentIds), [recentIds]);
  const activeFilterCount = countActiveFilters(filters);
  const hasQuery = query.trim().length > 0;
  const filtersActive = hasActiveFilters(filters);
  const showEmpty = !searching && (hasQuery || filtersActive) && results.length === 0;
  const showResults = !searching && results.length > 0;

  const setFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setShowFilters(false);
      onClose();
    }, 220);
  }, [onClose]);

  const handleSelect = useCallback((channel: ChannelWithStream) => {
    if (!channel.streamUrl) return;
    onSelectChannel(channel);
    handleClose();
  }, [handleClose, onSelectChannel]);

  useEffect(() => {
    if (!open) return;
    preloadIPTVData();
    getBrowseMetadata().then(setMetadata).catch((err) => console.error("[Search] Metadata failed:", err));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextFilters = mergeFilters(initialFilters);
    setClosing(false);
    setQuery("");
    setResults([]);
    setFilters(nextFilters);
    setShowFilters(hasActiveFilters(nextFilters));
    setHighlightedIndex(0);
    setFocused(false);
    setTimeout(() => {
      inputRef.current?.focus();
      setFocused(true);
    }, 100);
  }, [open, initialFilters]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!hasQuery && !filtersActive) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const nextResults = await searchAllChannels(query, 120, filters, favoriteIds, recentIds);
        setResults(nextResults);
        setHighlightedIndex(0);
      } catch (err) {
        console.error("[Search] Query failed:", err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, favoriteIds, recentIds, hasQuery, filtersActive, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showFilters) setShowFilters(false);
        else handleClose();
        return;
      }
      if (!results.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, results.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter") {
        const selected = results[highlightedIndex] ?? results[0];
        if (selected?.streamUrl) {
          event.preventDefault();
          handleSelect(selected);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, results, highlightedIndex, handleSelect, handleClose, showFilters]);

  if (!open) return null;

  const categoryOptions = CATEGORY_DEFS.map((definition) => {
    const match = metadata?.categories.find((item) => item.value === definition.key);
    return {
      value: definition.key,
      label: definition.label,
      count: match?.count ?? (definition.key === "all" ? metadata?.channelCount ?? 0 : 0),
    };
  });

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-start justify-center bg-black/42 px-2 mobile-safe-modal-top backdrop-blur-[2px] sm:px-4 md:pt-24 ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className={`w-[calc(100%-0.75rem)] max-w-[760px] max-h-[calc(100dvh_-_var(--cortex-safe-top)_-_5.75rem)] overflow-hidden rounded-[22px] border border-cyan-200/[0.14] bg-[#07101f]/98 shadow-[0_24px_90px_rgba(0,0,0,0.58)] sm:w-full md:max-h-none md:rounded-2xl ${closing ? "animate-modal-out" : "animate-modal-in"}`}>
        <div className="bg-[#0a1628]/98 p-3.5 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 md:mb-4 md:items-start md:gap-4">
            <div className="min-w-0 pr-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-200/62 md:text-[10px] md:tracking-[0.24em] md:text-cyan-200/70">Global search</p>
              <h2 className="mt-0.5 truncate text-lg font-bold leading-tight tracking-normal text-white md:mt-1 md:text-2xl">Find a public channel</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-[14px] border transition-all md:h-11 md:w-11 md:rounded-xl ${showFilters ? "border-cyan-300/45 bg-cyan-300/15 text-cyan-100" : "border-white/[0.11] bg-white/[0.06] text-white/66 hover:border-cyan-300/28 hover:bg-white/[0.09] hover:text-white"}`}
                aria-label="Toggle search filters"
                title="Filters"
              >
                <SlidersIcon />
                {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-slate-950">{activeFilterCount}</span>}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/[0.11] bg-white/[0.06] text-white/62 transition-all hover:border-white/[0.20] hover:bg-white/[0.09] hover:text-white md:h-11 md:w-11 md:rounded-xl"
                aria-label="Close search"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className={`relative flex h-12 w-full items-center gap-2 rounded-[18px] border px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all md:h-16 md:gap-3 md:rounded-2xl md:px-4 ${focused ? "border-cyan-300/60 bg-[#172b4b] ring-4 ring-cyan-300/[0.10]" : "border-white/[0.12] bg-[#13233d] hover:border-white/[0.18]"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] transition-all md:h-9 md:w-9 md:rounded-xl ${focused || hasQuery ? "bg-cyan-300/16 text-cyan-100" : "bg-white/[0.06] text-white/40"}`}>
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search channels"
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:font-medium placeholder:text-white/40 md:text-lg"
              aria-label="Search channel, country, category, or language"
            />
            {searching && <span className="h-5 w-5 shrink-0 rounded-full border-2 border-cyan-300/20 border-t-cyan-300 animate-spin" />}
            {hasQuery && (
              <button type="button" onClick={() => setQuery("")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/52 transition-all hover:bg-white/[0.09] hover:text-white" aria-label="Clear search">
                <CloseIcon />
              </button>
            )}
            <kbd className="hidden rounded-md border border-white/[0.12] bg-black/24 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/40 md:block">Ctrl K</kbd>
          </div>

          <div className="mt-3 md:mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">Category</span>
              {activeFilterCount > 0 && <span className="text-xs font-semibold text-cyan-100/70">{activeFilterCount} active</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {categoryOptions.map((category) => {
                const active = (filters.category ?? "all") === category.value || (!filters.category && category.value === "all");
                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setFilter("category", category.value === "all" ? null : category.value)}
                    className={`flex h-9 min-w-0 items-center justify-center gap-2 rounded-[14px] border px-2 text-xs transition-all md:h-10 md:rounded-xl md:text-sm ${active ? "border-cyan-200/70 bg-cyan-300 text-slate-950" : "border-white/[0.08] bg-white/[0.055] text-white/72 hover:border-cyan-300/28 hover:bg-cyan-300/[0.08] hover:text-white"}`}
                  >
                    <span className={`shrink-0 ${active ? "text-slate-950" : "text-cyan-100/82"}`}>{CATEGORY_ICONS[category.value] ?? <SparkIcon />}</span>
                    <span className="truncate font-semibold">{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 md:mt-4">
              <FilterPanel metadata={metadata} filters={filters} setFilter={setFilter} clearFilters={clearFilters} />
            </div>
          )}
        </div>

        {(searching || showEmpty || showResults) && (
          <div className="border-t border-white/[0.06] bg-[#07101f] p-3 md:p-4">
            {searching && (
              <div className="py-10 text-center">
                <div className="mx-auto h-9 w-9 rounded-full border-2 border-cyan-300/20 border-t-cyan-300 animate-spin" />
                <p className="mt-4 text-sm text-white/42">Searching the global index...</p>
              </div>
            )}

            {showEmpty && (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-white/28"><SearchIcon /></div>
                <h3 className="mt-4 text-base font-semibold text-white/72">No results found</h3>
                <p className="mt-2 text-sm text-white/38">Try a simpler term or clear one of the filters.</p>
                {filtersActive && <button type="button" onClick={clearFilters} className="mt-4 h-9 rounded-lg border border-cyan-300/20 px-4 text-sm font-semibold text-cyan-100/82 hover:bg-cyan-300/10">Clear filters</button>}
              </div>
            )}

            {showResults && (
              <div>
                <div className="mb-3 flex items-center justify-between px-1 text-xs text-white/38">
                  <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
                  <span className="hidden md:inline">Arrow keys + Enter</span>
                </div>
                <div style={{ height: "min(380px, 45vh)" }}>
                  <Virtuoso
                    style={{ height: "100%" }}
                    totalCount={results.length}
                    overscan={{ main: 360, reverse: 120 }}
                    className="scrollbar-thin"
                    itemContent={(index) => {
                      const channel = results[index];
                      if (!channel) return null;
                      return (
                        <ResultRow
                          channel={channel}
                          highlighted={index === highlightedIndex}
                          isFavorite={favoriteSet.has(channel.id)}
                          isRecent={recentSet.has(channel.id)}
                          onSelect={() => handleSelect(channel)}
                          onHighlight={() => setHighlightedIndex(index)}
                        />
                      );
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}