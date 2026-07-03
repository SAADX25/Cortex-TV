import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ChannelWithStream } from "../hooks/useIPTV";
import {
  CATEGORY_DEFS,
  categoryDisplayName,
  cleanName,
  countryName,
  flagUrl,
  getStreamHealth,
  isUsableStream,
  isYouTubeStream,
  languageName,
  matchesCategory,
  normalizeSearchText,
  streamHealthLabel,
} from "../utils/channelUtils";

interface ChannelListProps {
  countryName: string;
  channels: ChannelWithStream[];
  loading: boolean;
  error: string | null;
  onPlayChannel?: (channel: ChannelWithStream) => void;
  onClose?: () => void;
  favorites: ChannelWithStream[];
  onToggleFavorite: (channel: ChannelWithStream) => void;
  isPlaying?: boolean;
  playingChannelId?: string | null;
}

interface LocalFilters {
  country: string | null;
  category: string | null;
  language: string | null;
  favoritesOnly: boolean;
  workingOnly: boolean;
}

const DEFAULT_FILTERS: LocalFilters = {
  country: null,
  category: null,
  language: null,
  favoritesOnly: false,
  workingOnly: false,
};

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function TvIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-white/28">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <path d="m17 2-5 5-5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function categoryIcon(value: string) {
  if (value === "sports") return "Trophy";
  if (value === "movies") return "Film";
  if (value === "music") return "Music";
  if (value === "news") return "News";
  if (value === "kids") return "Kids";
  if (value === "entertainment") return "Spark";
  return "All";
}

function MiniIcon({ name }: { name: string }) {
  const common = { xmlns: "http://www.w3.org/2000/svg", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (name === "Trophy") return <svg {...common}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
  if (name === "Film") return <svg {...common}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M17 3v18" /><path d="M3 12h18" /></svg>;
  if (name === "Music") return <svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
  if (name === "News") return <svg {...common}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" /><path d="M18 14h-8" /><path d="M10 6h8v4h-8V6Z" /></svg>;
  if (name === "Kids") return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" /></svg>;
  if (name === "Spark") return <svg {...common}><path d="M12 2v6" /><path d="M12 16v6" /><path d="M2 12h6" /><path d="M16 12h6" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /></svg>;
}

function Logo({ channel, active }: { channel: ChannelWithStream; active: boolean }) {
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${active ? "border-blue-200/35 bg-blue-200/20" : "border-white/[0.07] bg-white/[0.05]"}`}>
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
        <TvIcon />
      )}
    </div>
  );
}

const ChannelRow = memo(function ChannelRow({
  channel,
  isFavorite,
  isActive,
  onPlay,
  onToggleFavorite,
}: {
  channel: ChannelWithStream;
  isFavorite: boolean;
  isActive: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  const health = getStreamHealth(channel.streamUrl, channel.streamStatus, channel.name, channel.country);
  const disabled = !channel.streamUrl;
  const category = channel.categories[0] ? categoryDisplayName(channel.categories[0]) : "General";
  const healthClass =
    health === "online"
      ? isActive ? "bg-blue-900/20 text-blue-950" : "bg-emerald-400/90 text-emerald-950"
      : health === "geo-blocked"
        ? "bg-amber-300/90 text-amber-950"
        : health === "offline"
          ? "bg-red-400/90 text-red-950"
          : isActive ? "bg-blue-900/12 text-blue-950" : "bg-white/10 text-white/58";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onPlay()}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !disabled) {
          event.preventDefault();
          onPlay();
        }
      }}
      aria-disabled={disabled}
      className={`group mb-2 rounded-lg border px-3 py-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-cyan-300/40 ${isActive ? "border-transparent bg-blue-300 text-blue-950 shadow-[0_8px_24px_rgba(96,165,250,0.24)]" : disabled ? "border-white/[0.04] bg-white/[0.02] opacity-55" : "border-white/[0.06] bg-white/[0.035] hover:border-cyan-300/24 hover:bg-cyan-300/[0.065]"}`}
    >
      <div className="flex items-center gap-3">
        <Logo channel={channel} active={isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className={`truncate text-sm font-semibold ${isActive ? "text-blue-950" : "text-white/92"}`}>{cleanName(channel.name)}</p>
            {isYouTubeStream(channel.streamUrl) && <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-200">YT</span>}
          </div>
          <p className={`mt-1 truncate text-[11px] ${isActive ? "text-blue-950/65" : "text-white/36"}`}>
            {channel.countryName ?? countryName(channel.country)} / {category}{channel.languageNames?.[0] ? ` / ${channel.languageNames[0]}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${healthClass}`}>{streamHealthLabel(health)}</span>
            {isActive && <span className="text-[10px] font-bold uppercase tracking-wide text-blue-950/65">Selected</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all active:scale-95 ${isFavorite ? "bg-amber-300/18 text-amber-200" : isActive ? "bg-blue-900/10 text-blue-950/55" : "bg-white/[0.05] text-white/36 hover:text-amber-200"}`}
          aria-label={isFavorite ? `Remove ${channel.name} from favorites` : `Add ${channel.name} to favorites`}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>
    </div>
  );
});

function SelectFilter({ label, value, options, onChange }: { label: string; value: string | null; options: Array<{ value: string; label: string; count: number }>; onChange: (value: string | null) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className="h-9 rounded-lg border border-white/[0.08] bg-[#13213a] px-2 text-xs text-white/82 outline-none focus:border-cyan-300/40">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
        ))}
      </select>
    </label>
  );
}

function activeFilterCount(filters: LocalFilters): number {
  return [filters.country, filters.category, filters.language, filters.favoritesOnly, filters.workingOnly].filter(Boolean).length;
}

export default function ChannelList({
  countryName: title,
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
  const [filters, setFilters] = useState<LocalFilters>(DEFAULT_FILTERS);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredSearch = useDeferredValue(search);
  const isStale = search !== deferredSearch;

  const favoriteIds = useMemo(() => new Set(favorites.map((channel) => channel.id)), [favorites]);

  const filterOptions = useMemo(() => {
    const countryMap = new Map<string, { value: string; label: string; count: number }>();
    const languageMap = new Map<string, { value: string; label: string; count: number }>();
    for (const channel of channels) {
      if (channel.country) {
        const item = countryMap.get(channel.country) ?? { value: channel.country, label: channel.countryName ?? countryName(channel.country), count: 0 };
        item.count += 1;
        countryMap.set(channel.country, item);
      }
      for (const lang of channel.languages) {
        const key = lang.toLowerCase();
        const item = languageMap.get(key) ?? { value: key, label: languageName(key), count: 0 };
        item.count += 1;
        languageMap.set(key, item);
      }
    }

    const categories = CATEGORY_DEFS.map((definition) => ({
      value: definition.key,
      label: definition.label,
      count: definition.key === "all" ? channels.length : channels.filter((channel) => matchesCategory(channel.categories, definition.key)).length,
    })).filter((option) => option.value !== "all" && option.count > 0);

    return {
      countries: [...countryMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      languages: [...languageMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      categories,
    };
  }, [channels]);

  const categoryChips = useMemo(() => [
    { value: null, label: "All", count: channels.length },
    ...filterOptions.categories.slice(0, 6),
  ], [channels.length, filterOptions.categories]);

  const filtered = useMemo(() => {
    const query = normalizeSearchText(deferredSearch);
    return channels.filter((channel) => {
      if (filters.country && channel.country !== filters.country) return false;
      if (filters.category && !matchesCategory(channel.categories, filters.category)) return false;
      if (filters.language && !channel.languages.some((lang) => lang.toLowerCase() === filters.language)) return false;
      if (filters.favoritesOnly && !favoriteIds.has(channel.id)) return false;
      if (filters.workingOnly && !isUsableStream(channel.streamUrl, channel.streamStatus, channel.name, channel.country)) return false;
      if (!query) return true;
      const fields = [
        channel.name,
        cleanName(channel.name),
        channel.country,
        channel.countryName ?? countryName(channel.country),
        ...channel.categories,
        ...channel.languages,
        ...(channel.languageNames ?? []),
        ...(channel.altNames ?? []),
      ].map(normalizeSearchText).join(" ");
      return fields.includes(query);
    });
  }, [channels, deferredSearch, favoriteIds, filters]);

  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  const renderRow = useCallback((index: number) => {
    const channel = filteredRef.current[index];
    if (!channel) return null;
    return (
      <ChannelRow
        channel={channel}
        isFavorite={favoriteIds.has(channel.id)}
        isActive={channel.id === playingChannelId}
        onPlay={() => onPlayChannel?.(channel)}
        onToggleFavorite={() => onToggleFavorite(channel)}
      />
    );
  }, [favoriteIds, onPlayChannel, onToggleFavorite, playingChannelId]);

  const activeFilters = activeFilterCount(filters);
  const liveCount = filtered.filter((channel) => channel.streamUrl).length;
  const hasFilters = activeFilters > 0 || !!search;

  const filterPanel = (
    <div className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.035] p-3">
      {filterOptions.countries.length > 1 && <SelectFilter label="Country" value={filters.country} options={filterOptions.countries} onChange={(value) => setFilters((prev) => ({ ...prev, country: value }))} />}
      <SelectFilter label="Category" value={filters.category} options={filterOptions.categories} onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))} />
      {filterOptions.languages.length > 0 && <SelectFilter label="Language" value={filters.language} options={filterOptions.languages} onChange={(value) => setFilters((prev) => ({ ...prev, language: value }))} />}
      <label className="flex h-9 items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 text-xs text-white/72">
        Favorites only
        <input type="checkbox" checked={filters.favoritesOnly} onChange={(event) => setFilters((prev) => ({ ...prev, favoritesOnly: event.target.checked }))} className="h-4 w-4 accent-cyan-300" />
      </label>
      <label className="flex h-9 items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 text-xs text-white/72">
        Working streams
        <input type="checkbox" checked={filters.workingOnly} onChange={(event) => setFilters((prev) => ({ ...prev, workingOnly: event.target.checked }))} className="h-4 w-4 accent-cyan-300" />
      </label>
      {hasFilters && (
        <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); inputRef.current?.focus(); }} className="h-9 rounded-lg border border-cyan-300/20 text-xs font-semibold text-cyan-100/82 hover:bg-cyan-300/10">
          Clear search and filters
        </button>
      )}
    </div>
  );

  return (
    <div className={`fixed top-12 right-0 bottom-0 z-[60] flex w-full flex-col border-l border-cyan-500/15 bg-black/95 pb-24 backdrop-blur-xl md:absolute md:top-0 md:z-30 md:w-[430px] md:bg-black/82 md:pb-0 ${isPlaying ? "pt-[calc(100vw*9/16+2.5rem)] md:pt-0" : ""}`}>
      <div className="shrink-0 border-b border-white/[0.05] bg-gradient-to-b from-white/[0.045] to-transparent px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/50">Browsing</p>
            <h2 className="mt-1 truncate text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-xs text-white/35">{channels.length} channels / {channels.filter((channel) => channel.streamUrl).length} with streams</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/45 transition-all hover:bg-white/10 hover:text-white" aria-label="Close channel list">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="mt-4 flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#13213a] px-4 focus-within:border-cyan-300/35">
          <span className={search ? "text-cyan-200" : "text-white/30"}><SearchIcon /></span>
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this list"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
          />
          {isStale && <span className="h-4 w-4 rounded-full border-2 border-cyan-300/20 border-t-cyan-300 animate-spin" />}
          <button type="button" onClick={() => setShowMobileFilters((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/52 hover:text-cyan-100 md:hidden" aria-label="Toggle filters">
            <FilterIcon />
            {activeFilters > 0 && <span className="absolute ml-6 mt-[-24px] flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-300 px-1 text-[9px] font-bold text-slate-950">{activeFilters}</span>}
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {categoryChips.map((chip) => {
            const active = filters.category === chip.value || (!filters.category && chip.value === null);
            return (
              <button key={chip.value ?? "all"} type="button" onClick={() => setFilters((prev) => ({ ...prev, category: chip.value }))} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${active ? "bg-cyan-300 text-slate-950" : "bg-white/[0.06] text-white/64 hover:bg-white/[0.1]"}`}>
                <MiniIcon name={categoryIcon(chip.value ?? "all")} />
                <span className="font-semibold">{chip.label}</span>
                <span className="opacity-70">{chip.count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 hidden md:block">{filterPanel}</div>
        {showMobileFilters && <div className="mt-3 md:hidden">{filterPanel}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-white/[0.05]" />)}
          </div>
        )}

        {error && !loading && (
          <div className="m-5 rounded-lg border border-red-400/20 bg-red-500/10 p-4">
            <p className="text-sm font-semibold text-red-100">Could not load channels</p>
            <p className="mt-1 text-sm text-red-100/62">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4"><TvIcon /></div>
            <h3 className="mt-4 text-base font-semibold text-white/70">No channels match</h3>
            <p className="mt-2 text-sm text-white/34">Try clearing the search or relaxing one of the filters.</p>
            {hasFilters && <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }} className="mt-4 rounded-lg border border-cyan-300/20 px-4 py-2 text-sm font-semibold text-cyan-100/82 hover:bg-cyan-300/10">Clear filters</button>}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <Virtuoso
            totalCount={filtered.length}
            itemContent={renderRow}
            overscan={{ main: 320, reverse: 120 }}
            className="scrollbar-thin"
            style={{ height: "100%", padding: "10px 12px" }}
          />
        )}
      </div>

      {!loading && !error && (
        <div className="shrink-0 border-t border-white/[0.05] bg-white/[0.02] px-5 py-3 text-[11px] text-white/35">
          <div className="flex items-center justify-between">
            <span>{filtered.length} channel{filtered.length !== 1 ? "s" : ""}</span>
            <span className="text-emerald-300/55">{liveCount} with streams</span>
          </div>
        </div>
      )}
    </div>
  );
}