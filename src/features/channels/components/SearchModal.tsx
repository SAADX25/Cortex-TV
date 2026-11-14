import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Virtuoso } from "react-virtuoso";
import type { VirtuosoHandle } from "react-virtuoso";
import SafeImage from "@/shared/components/SafeImage";
import { useLocale } from "@/shared/lib/useLocale";
import {
  getBrowseMetadata,
  preloadIPTVData,
  searchAllChannels,
  type BrowseMetadata,
  type ChannelWithStream,
  type SearchFilters,
} from "@/features/iptv/hooks/useIPTV";
import {
  CATEGORY_DEFS,
  categoryDisplayName,
  cleanName,
  countryName,
  flagUrl,
  getStreamHealth,
  streamHealthLabel,
} from "@/shared/lib/channelUtils";

const DEFAULT_FILTERS: SearchFilters = {
  country: null,
  category: null,
  language: null,
  favoritesOnly: false,
  workingOnly: false,
};

const QUICK_SEARCH_TERMS = [
  "Al Jazeera",
  "BBC",
  "CNN",
  "France 24",
  "Sky News",
  "Al Arabiya",
];

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
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      ? "border border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
      : health === "geo-blocked"
        ? "border border-amber-400/35 bg-amber-500/20 text-amber-200"
        : health === "offline"
          ? "border border-slate-400/25 bg-slate-500/20 text-slate-300"
          : "border border-blue-400/25 bg-blue-500/15 text-sky-200/85";

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      onMouseEnter={onHighlight}
      disabled={disabled}
      className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed ${
        highlighted
          ? "border-sky-400/60 bg-gradient-to-r from-blue-600/30 to-sky-500/15 shadow-[0_4px_18px_rgba(37,99,235,0.22)]"
          : "border-blue-400/[0.12] bg-[#0a1a38]/65 hover:border-sky-400/40 hover:bg-blue-600/20"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-400/20 bg-[#0d2248]/90">
        {channel.logo ? (
          <SafeImage
            src={channel.logo}
            alt=""
            className="h-full w-full object-contain p-1.5"
            loading="lazy"
          />
        ) : channel.country ? (
          <SafeImage src={flagUrl(channel.country, 80)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <GlobeIcon />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold text-white">{cleanName(channel.name)}</p>
          {isFavorite && <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-200">Fav</span>}
          {isRecent && <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-sky-200">Recent</span>}
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-blue-200/60">
          {channel.countryName ?? countryName(channel.country)} · {channel.categories[0] ? categoryDisplayName(channel.categories[0]) : "General"}
          {channel.languageNames?.[0] ? ` · ${channel.languageNames[0]}` : ""}
        </p>
      </div>
      <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${healthTone}`}>
        {streamHealthLabel(health)}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-blue-500/25 text-sky-100">
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
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/65">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-10 min-w-0 rounded-xl border border-blue-400/25 bg-[#0b1d3f] px-3 text-sm font-medium text-white outline-none transition-all hover:border-sky-400/45 focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25"
      >
        <option value="" className="bg-[#091836] text-white">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#091836] text-white">
            {option.label}{option.count !== undefined ? ` (${option.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border border-blue-400/25 bg-blue-950/50 px-3 text-sm font-medium text-blue-100/85 hover:border-sky-400/40">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-sky-400" />
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
    <div className="grid gap-3 rounded-xl border border-blue-400/20 bg-[#081633]/90 p-3.5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
      <SelectFilter label="Country" value={filters.country} options={metadata?.countries ?? []} onChange={(value) => setFilter("country", value)} />
      <SelectFilter label="Category" value={filters.category} options={(metadata?.categories ?? []).filter((item) => item.value !== "all")} onChange={(value) => setFilter("category", value)} />
      <SelectFilter label="Language" value={filters.language} options={metadata?.languages ?? []} onChange={(value) => setFilter("language", value)} />
      <ToggleFilter label="Favorites" checked={!!filters.favoritesOnly} onChange={(checked) => setFilter("favoritesOnly", checked)} />
      <ToggleFilter label="Working" checked={!!filters.workingOnly} onChange={(checked) => setFilter("workingOnly", checked)} />
      {hasActiveFilters(filters) && (
        <button type="button" onClick={clearFilters} className="h-10 rounded-xl border border-sky-400/35 bg-blue-600/20 px-3 text-xs font-bold text-sky-100 transition-all hover:bg-blue-600/35 sm:col-span-2 lg:col-span-5">
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
  const { t } = useLocale();
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
  const resultListRef = useRef<VirtuosoHandle>(null);
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
  const showDiscovery = !searching && !hasQuery && !filtersActive;

  useEffect(() => {
    if (open && showResults) resultListRef.current?.scrollIntoView({ index: highlightedIndex, behavior: "auto" });
  }, [open, showResults, highlightedIndex]);

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
    let cancelled = false;
    preloadIPTVData();
    getBrowseMetadata().then((data) => { if (!cancelled) setMetadata(data); }).catch((err) => console.error("[Search] Metadata failed:", err));
    return () => { cancelled = true; };
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
    let cancelled = false;
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
        if (!cancelled) { setResults(nextResults); setHighlightedIndex(0); }
      } catch (err) {
        console.error("[Search] Query failed:", err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 150);

    return () => {
      cancelled = true;
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
      const target = event.target as HTMLElement | null;
      const onFilterControl = !!target?.closest("select, input[type=checkbox], button");
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, results.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter" && !onFilterControl) {
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

  const quickChannels = [...recentChannels, ...favorites].filter(
    (ch, idx, arr) => !!ch.streamUrl && arr.findIndex((item) => item.id === ch.id) === idx,
  ).slice(0, 6);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Search channels", "البحث عن القنوات")}
      className={`fixed inset-0 z-[200] flex items-start justify-center bg-black/55 px-0 backdrop-blur-[3px] md:px-4 md:pt-20 ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className={`classic-search-panel relative w-full max-w-[880px] max-h-[calc(100dvh_-_4.5rem)] rounded-b-[22px] border-b border-blue-400/25 bg-[#07152e]/98 shadow-[0_28px_100px_rgba(2,8,24,0.85)] md:max-h-none md:rounded-2xl md:border ${closing ? "animate-modal-out" : "animate-modal-in"}`}>
        <div className="bg-gradient-to-b from-[#0d2248]/95 to-[#07152e]/98 p-3.5 md:p-5 pt-[max(var(--cortex-safe-top),0.875rem)] md:pt-5">
          <div className="mb-3 flex items-center justify-between gap-3 md:mb-4 md:items-start md:gap-4 pr-12">
            <div className="min-w-0 pr-1">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                Global Broadcast Search
              </p>
              <h2 className="mt-0.5 truncate text-lg font-extrabold leading-tight tracking-tight text-white md:mt-1 md:text-2xl">
                {t("Find a public channel", "ابحث عن قناة")}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all md:h-11 md:w-11 ${
                  showFilters || activeFilterCount > 0
                    ? "border-sky-400/60 bg-blue-600/35 text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]"
                    : "border-blue-400/25 bg-[#0b1f44]/85 text-blue-100/75 hover:border-sky-400/45 hover:bg-blue-600/25 hover:text-white"
                }`}
                aria-label="Toggle search filters"
                title="Filters"
              >
                <SlidersIcon />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-400 px-1 text-[10px] font-extrabold text-slate-950">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className={`relative flex h-12 w-full items-center gap-2.5 rounded-2xl border px-3 shadow-[inset_0_1px_0_rgba(191,219,254,0.08)] transition-all md:h-14 md:gap-3 md:px-4 ${
            focused
              ? "border-sky-400/75 bg-[#0e2652] ring-4 ring-blue-500/20"
              : "border-blue-400/25 bg-[#0a1c3d] hover:border-sky-400/45"
          }`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all md:h-9 md:w-9 ${
              focused || hasQuery ? "bg-blue-500/30 text-sky-200" : "bg-blue-950/70 text-blue-200/55"
            }`}>
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
              placeholder={t("Search channels, countries, or news…", "ابحث باسم القناة أو الدولة أو الأخبار...")}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:font-medium placeholder:text-blue-200/40 md:text-base"
              aria-label="Search channel, country, category, or language"
            />
            {searching && <span className="h-5 w-5 shrink-0 rounded-full border-2 border-sky-300/25 border-t-sky-300 animate-spin" />}
            {hasQuery && (
              <button
                type="button"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-200/65 transition-all hover:bg-blue-500/25 hover:text-white"
                aria-label="Clear search"
              >
                <CloseIcon />
              </button>
            )}
            <kbd className="hidden rounded-lg border border-blue-400/25 bg-[#061229] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-200/65 md:block">Ctrl K</kbd>
          </div>

          <div className="mt-3 md:mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300/65">Category</span>
              {activeFilterCount > 0 && <span className="text-xs font-bold text-sky-300">{activeFilterCount} active</span>}
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {categoryOptions.map((category) => {
                const active = (filters.category ?? "all") === category.value || (!filters.category && category.value === "all");
                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setFilter("category", category.value === "all" ? null : category.value)}
                    className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs transition-all md:h-10 md:text-sm ${
                      active
                        ? "border-sky-300/50 bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)]"
                        : "border-blue-400/20 bg-[#0b1d3f]/75 text-blue-100/80 hover:border-sky-400/45 hover:bg-blue-600/25 hover:text-white"
                    }`}
                  >
                    <span className={`shrink-0 ${active ? "text-white" : "text-sky-300"}`}>{CATEGORY_ICONS[category.value] ?? <SparkIcon />}</span>
                    <span className="whitespace-nowrap font-bold">{category.label}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-blue-500/20 text-sky-200/75"
                    }`}>{category.count}</span>
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

        {showDiscovery && (
          <div className="border-t border-blue-400/15 bg-[#061229]/95 p-4 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/75">Quick Broadcast Jump</span>
                <button
                  type="button"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS, category: "news", workingOnly: true })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-400/35 bg-red-500/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-red-100 transition-colors hover:bg-red-500/35"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  Live News Only
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SEARCH_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => { setQuery(term); inputRef.current?.focus(); }}
                    className="rounded-lg border border-blue-400/20 bg-[#0b1f44]/75 px-2.5 py-1.5 text-xs font-semibold text-blue-100 transition-all hover:border-sky-400/45 hover:bg-blue-600/30 hover:text-white"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {quickChannels.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/75">Recent & Favorites</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickChannels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleSelect(ch)}
                      className="flex items-center gap-2.5 rounded-xl border border-blue-400/15 bg-[#0b1d3f]/70 p-2 text-left transition-all hover:border-sky-400/45 hover:bg-blue-600/25"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-blue-400/20 bg-[#07152e]">
                        {ch.logo ? (
                          <SafeImage src={ch.logo} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          <SafeImage src={flagUrl(ch.country, 40)} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{cleanName(ch.name)}</span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/25 text-sky-200">
                        <PlayIcon />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(searching || showEmpty || showResults) && (
          <div className="border-t border-blue-400/15 bg-[#061229] p-3 md:p-4">
            {searching && (
              <div className="py-10 text-center">
                <div className="mx-auto h-9 w-9 rounded-full border-2 border-blue-400/25 border-t-sky-400 animate-spin" />
                <p className="mt-4 text-sm font-medium text-blue-200/70">Searching the global broadcast index…</p>
              </div>
            )}

            {showEmpty && (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-950/50 text-sky-300/60"><SearchIcon /></div>
                <h3 className="mt-4 text-base font-bold text-white/85">No channels found</h3>
                <p className="mt-1.5 text-sm text-blue-200/55">Try a simpler term, another language, or clear one of the filters.</p>
                {filtersActive && (
                  <button type="button" onClick={clearFilters} className="mt-4 h-9 rounded-xl border border-sky-400/35 bg-blue-600/25 px-4 text-sm font-bold text-sky-100 hover:bg-blue-600/40">
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {showResults && (
              <div>
                <div className="mb-2.5 flex items-center justify-between px-1 text-xs font-semibold text-blue-200/60">
                  <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
                  <span className="hidden md:inline text-sky-300/75">Arrow keys + Enter</span>
                </div>
                <div style={{ height: "min(380px, 45vh)" }}>
                  <Virtuoso
                    ref={resultListRef}
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

        <button
          type="button"
          onClick={handleClose}
          className="classic-search-close icon-button"
          aria-label="Close search"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
