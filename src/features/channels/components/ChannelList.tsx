import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import SafeImage from "@/shared/components/SafeImage";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { useLocale } from "@/shared/lib/useLocale";
import type { ChannelWithStream } from "@/shared/types";
import {
  CATEGORY_DEFS,
  categoryDisplayName,
  cleanName,
  countryName,
  countryNameAr,
  flagUrl,
  getStreamHealth,
  isUsableStream,
  isYouTubeStream,
  languageName,
  matchesCategory,
  normalizeSearchText,
  streamHealthLabel,
} from "@/shared/lib/channelUtils";

interface ChannelListProps {
  embedded?: boolean;
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
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function TvIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-sky-300/45">
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

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function Logo({ channel, active }: { channel: ChannelWithStream; active: boolean }) {
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${active ? "border-sky-300/50 bg-blue-500/25 shadow-[0_0_12px_rgba(56,189,248,0.28)]" : "border-blue-400/20 bg-[#0b1e40]/90"}`}>
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
        <TvIcon />
      )}
    </div>
  );
}

const ChannelRow = memo(function ChannelRow({
  channel,
  channelNumber,
  isFavorite,
  isActive,
  onPlay,
  onToggleFavorite,
}: {
  channel: ChannelWithStream;
  channelNumber: number;
  isFavorite: boolean;
  isActive: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  const health = getStreamHealth(channel.streamUrl, channel.streamStatus, channel.name, channel.country);
  const disabled = !channel.streamUrl;
  const category = channel.categories[0] ? categoryDisplayName(channel.categories[0]) : "General";
  const isNewsChannel = matchesCategory(channel.categories, "news");
  const healthClass =
    health === "online"
      ? "border border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
      : health === "geo-blocked"
        ? "border border-amber-400/35 bg-amber-500/20 text-amber-200"
        : health === "offline"
          ? "border border-slate-400/25 bg-slate-500/20 text-slate-300"
          : "border border-blue-400/25 bg-blue-500/15 text-sky-200/85";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onPlay()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if ((event.key === "Enter" || event.key === " ") && !disabled) {
          event.preventDefault();
          onPlay();
        }
      }}
      aria-disabled={disabled}
      aria-current={isActive ? "true" : undefined}
      className={`group relative mb-2 rounded-xl border px-3 py-2.5 outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-sky-400/50 ${
        isActive
          ? "border-sky-400/65 bg-gradient-to-r from-blue-600/30 via-blue-700/25 to-sky-500/15 text-white shadow-[0_6px_24px_rgba(37,99,235,0.28)]"
          : disabled
            ? "border-blue-400/[0.06] bg-[#081530]/40 opacity-50"
            : "border-blue-400/[0.12] bg-[#0a1a38]/65 hover:border-sky-400/45 hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-sky-500/10"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
      )}
      <div className="flex items-center gap-2.5">
        <span className={`min-w-7 shrink-0 text-center font-mono text-[10px] font-bold tabular-nums ${isActive ? "text-sky-300" : "text-blue-200/45 group-hover:text-sky-300/75"}`}>
          {String(channelNumber).padStart(2, "0")}
        </span>
        <Logo channel={channel} active={isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[13.5px] font-bold text-white">{cleanName(channel.name)}</p>
            {isYouTubeStream(channel.streamUrl) && (
              <span className="shrink-0 rounded border border-sky-400/30 bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-200">YT</span>
            )}
          </div>
          <p className={`mt-0.5 truncate text-[11px] font-medium ${isActive ? "text-sky-200/80" : "text-blue-200/55"}`}>
            {channel.countryName ?? countryName(channel.country)} · {category}{channel.languageNames?.[0] ? ` · ${channel.languageNames[0]}` : ""}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${healthClass}`}>
              {streamHealthLabel(health)}
            </span>
            {isNewsChannel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-red-200">
                <span className="h-1 w-1 rounded-full bg-red-400" />
                NEWS
              </span>
            )}
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-400/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-100">
                ON AIR
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95 ${
            isFavorite
              ? "border-amber-300/45 bg-amber-400/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
              : "border-blue-400/15 bg-blue-950/50 text-blue-200/45 hover:border-amber-300/35 hover:bg-amber-400/15 hover:text-amber-200"
          }`}
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

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/65">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 rounded-lg border border-blue-400/25 bg-[#0a1b3a] px-2.5 text-xs font-medium text-white outline-none transition-all hover:border-sky-400/40 focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25"
      >
        <option value="" className="bg-[#091836] text-white">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#091836] text-white">
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function activeFilterCount(filters: LocalFilters): number {
  return [filters.country, filters.category, filters.language, filters.favoritesOnly, filters.workingOnly].filter(Boolean).length;
}

export default function ChannelList({
  embedded = false,
  countryName: title,
  channels,
  loading,
  error,
  onPlayChannel,
  onClose,
  favorites,
  onToggleFavorite,
  playingChannelId = null,
}: ChannelListProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LocalFilters>(DEFAULT_FILTERS);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredSearch = useDeferredValue(useDebouncedValue(search));
  const isStale = search !== deferredSearch;

  const isNewsView = /news/i.test(title);
  const favoriteIds = useMemo(() => new Set(favorites.map((channel) => channel.id)), [favorites]);

  const filterOptions = useMemo(() => {
    const countryMap = new Map<string, { value: string; label: string; count: number }>();
    const languageMap = new Map<string, { value: string; label: string; count: number }>();
    const categoryDefs = CATEGORY_DEFS.filter((definition) => definition.key !== "all");
    const categoryCounts = new Map<string, number>();

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
      for (const definition of categoryDefs) {
        if (matchesCategory(channel.categories, definition.key)) {
          categoryCounts.set(definition.key, (categoryCounts.get(definition.key) ?? 0) + 1);
        }
      }
    }

    const categories = categoryDefs
      .map((definition) => ({
        value: definition.key,
        label: definition.label,
        count: categoryCounts.get(definition.key) ?? 0,
      }))
      .filter((option) => option.count > 0);

    return {
      countries: [...countryMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      languages: [...languageMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      categories,
    };
  }, [channels]);

  const filtered = useMemo(() => {
    const query = normalizeSearchText(deferredSearch);
    const terms = query ? query.split(" ").filter(Boolean) : [];
    return channels.filter((channel) => {
      if (filters.country && channel.country !== filters.country) return false;
      if (filters.category && !matchesCategory(channel.categories, filters.category)) return false;
      if (filters.language && !channel.languages.some((lang) => lang.toLowerCase() === filters.language)) return false;
      if (filters.favoritesOnly && !favoriteIds.has(channel.id)) return false;
      if (filters.workingOnly && !isUsableStream(channel.streamUrl, channel.streamStatus, channel.name, channel.country)) return false;
      if (terms.length === 0) return true;
      const fields = [
        channel.name,
        cleanName(channel.name),
        channel.country,
        channel.countryName ?? countryName(channel.country),
        countryNameAr(channel.country),
        ...channel.categories,
        ...channel.languages,
        ...(channel.languageNames ?? []),
        ...(channel.altNames ?? []),
      ].map(normalizeSearchText).join(" ");
      return terms.every((term) => fields.includes(term));
    });
  }, [channels, deferredSearch, favoriteIds, filters]);

  const firstPlayable = useMemo(
    () => filtered.find((channel) => isUsableStream(channel.streamUrl, channel.streamStatus, channel.name, channel.country))
      ?? filtered.find((channel) => !!channel.streamUrl)
      ?? null,
    [filtered],
  );

  const renderRow = useCallback((index: number, channel: ChannelWithStream) => {
    return (
      <ChannelRow
        channel={channel}
        channelNumber={index + 1}
        isFavorite={favoriteIds.has(channel.id)}
        isActive={channel.id === playingChannelId}
        onPlay={() => onPlayChannel?.(channel)}
        onToggleFavorite={() => onToggleFavorite(channel)}
      />
    );
  }, [favoriteIds, onPlayChannel, onToggleFavorite, playingChannelId]);

  const activeFilters = activeFilterCount(filters);
  const liveCount = useMemo(
    () => filtered.reduce((acc, channel) => (channel.streamUrl ? acc + 1 : acc), 0),
    [filtered],
  );
  const hasFilters = activeFilters > 0 || !!search;

  const pillCategories = useMemo(() => {
    const visible = CATEGORY_DEFS.filter(
      (item) => item.key === "all" || filterOptions.categories.some((c) => c.value === item.key),
    );
    return (visible.length > 1 ? visible : CATEGORY_DEFS.slice(0, 5)).slice(0, 6);
  }, [filterOptions.categories]);

  const filterPanel = (
    <div className="grid gap-2.5 rounded-xl border border-blue-400/20 bg-[#081633]/90 p-3 shadow-[inset_0_1px_0_rgba(191,219,254,0.06)]">
      {filterOptions.countries.length > 1 && (
        <SelectFilter label="Country" value={filters.country} options={filterOptions.countries} onChange={(value) => setFilters((prev) => ({ ...prev, country: value }))} />
      )}
      <SelectFilter label="Category" value={filters.category} options={filterOptions.categories} onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))} />
      {filterOptions.languages.length > 0 && (
        <SelectFilter label="Language" value={filters.language} options={filterOptions.languages} onChange={(value) => setFilters((prev) => ({ ...prev, language: value }))} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex h-9 cursor-pointer items-center justify-between rounded-lg border border-blue-400/20 bg-blue-950/50 px-3 text-xs font-medium text-blue-100/85 hover:border-sky-400/35">
          <span>Favorites</span>
          <input type="checkbox" checked={filters.favoritesOnly} onChange={(event) => setFilters((prev) => ({ ...prev, favoritesOnly: event.target.checked }))} className="h-4 w-4 accent-sky-400" />
        </label>
        <label className="flex h-9 cursor-pointer items-center justify-between rounded-lg border border-blue-400/20 bg-blue-950/50 px-3 text-xs font-medium text-blue-100/85 hover:border-sky-400/35">
          <span>Live / Working</span>
          <input type="checkbox" checked={filters.workingOnly} onChange={(event) => setFilters((prev) => ({ ...prev, workingOnly: event.target.checked }))} className="h-4 w-4 accent-sky-400" />
        </label>
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); inputRef.current?.focus(); }}
          className="h-9 rounded-lg border border-sky-400/30 bg-blue-600/20 text-xs font-bold text-sky-100 transition-colors hover:bg-blue-600/35"
        >
          Clear search & filters
        </button>
      )}
    </div>
  );

  return (
    <div className={embedded ? "embedded-channel-list" : "cortex-hud-panel channel-browser fixed top-0 mobile-safe-panel-top right-0 bottom-0 z-[60] flex w-full flex-col mobile-safe-panel-bottom md:absolute md:top-0 md:z-30 md:w-[430px] md:rounded-l-2xl md:pb-0"}>
      <div className="shrink-0 border-b border-blue-400/15 bg-gradient-to-b from-[#0e244d]/95 via-[#091836]/80 to-transparent px-4 pb-3.5 pt-4 md:px-5 md:pt-5">
        <div className={`flex items-start justify-between gap-3 ${onClose ? "md:pr-12" : ""}`}>
          <div className="min-w-0 flex-1">
            {isNewsView ? (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-red-400/35 bg-red-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {t("ON AIR · NEWS DESK", "على الهواء · غرفة الأخبار")}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.85)]" />
                {t("Channel guide", "دليل القنوات")}
              </p>
            )}
            <h2 className="mt-1 truncate text-xl font-extrabold tracking-tight text-white">{title}</h2>
            <p className="mt-0.5 text-xs font-medium text-blue-200/60">
              {channels.length} channels · {channels.filter((channel) => channel.streamUrl).length} with streams
            </p>
          </div>
        </div>

        {/* Quick Launch / Flip CTA for standalone list */}
        {!embedded && firstPlayable && onPlayChannel && !loading && (
          <button
            type="button"
            onClick={() => onPlayChannel(firstPlayable)}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-sky-300/35 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 px-3.5 py-2 text-left text-xs font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.4)] transition-all hover:from-blue-500 hover:to-sky-400 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <PlayIcon />
              </span>
              <span className="truncate">
                {isNewsView ? `Watch & Flip Live News (${cleanName(firstPlayable.name)})` : `Start Watching · ${cleanName(firstPlayable.name)}`}
              </span>
            </span>
            <span className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
              CH ↑↓
            </span>
          </button>
        )}

        {/* Search bar + Filter toggle */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-blue-400/25 bg-[#0a1b3a]/90 px-3 shadow-[inset_0_1px_0_rgba(191,219,254,0.06)] transition-all duration-200 focus-within:border-sky-400/75 focus-within:bg-[#0e254f] focus-within:ring-2 focus-within:ring-blue-500/25">
            <span className={`shrink-0 transition-colors ${search ? "text-sky-300" : "text-blue-200/45"}`}><SearchIcon /></span>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && firstPlayable && onPlayChannel) {
                  event.preventDefault();
                  onPlayChannel(firstPlayable);
                } else if (event.key === "Escape" && search) {
                  event.stopPropagation();
                  setSearch("");
                }
              }}
              placeholder={t("Search channels…", "ابحث عن قناة...")}
              aria-label={t("Search channels", "ابحث عن قناة")}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-blue-200/40"
            />
            {isStale && <span className="h-4 w-4 shrink-0 rounded-full border-2 border-sky-300/25 border-t-sky-300 animate-spin" />}
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-blue-200/60 transition-colors hover:bg-blue-500/25 hover:text-white"
                aria-label="Clear channel search"
              >
                <CloseIcon />
              </button>
            )}
          </div>

          {!embedded && (
            <button
              type="button"
              onClick={() => setShowDesktopFilters((prev) => !prev)}
              className={`relative hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                showDesktopFilters || activeFilters > 0
                  ? "border-sky-400/55 bg-blue-600/35 text-white shadow-[0_4px_14px_rgba(37,99,235,0.3)]"
                  : "border-blue-400/25 bg-[#0a1b3a]/90 text-blue-200/75 hover:border-sky-400/45 hover:text-white"
              }`}
              aria-label="Toggle channel filters"
              title="Filters"
            >
              <FilterIcon />
              {activeFilters > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[9px] font-extrabold text-slate-950">
                  {activeFilters}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMobileFilters((prev) => !prev)}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all md:hidden ${
              showMobileFilters || activeFilters > 0
                ? "border-sky-400/55 bg-blue-600/35 text-white"
                : "border-blue-400/25 bg-[#0a1b3a]/90 text-blue-200/75 hover:text-white"
            }`}
            aria-label="Toggle filters"
          >
            <FilterIcon />
            {activeFilters > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[9px] font-extrabold text-slate-950">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        <div className="category-pills">
          {pillCategories.map((item) => (
            <button
              key={item.key}
              className={(!filters.category && item.key === "all") || filters.category === item.key ? "active" : ""}
              onClick={() => setFilters((previous) => ({ ...previous, category: item.key === "all" ? null : item.key }))}
            >
              {t(item.label, ({ all: "الكل", news: "أخبار", sports: "رياضة", movies: "أفلام", music: "موسيقى", entertainment: "ترفيه", kids: "أطفال", documentary: "وثائقي", religious: "ديني", business: "اقتصاد" } as Record<string, string>)[item.key] ?? item.label)}
            </button>
          ))}
        </div>

        {!embedded && showDesktopFilters && <div className="mt-3 hidden md:block">{filterPanel}</div>}

        {showMobileFilters && (
          <div className="fixed inset-0 z-[85] bg-black/55 backdrop-blur-[2px] md:hidden" onClick={() => setShowMobileFilters(false)}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-blue-400/25 bg-[#07152e] p-4 shadow-[0_-24px_80px_rgba(0,0,0,0.65)]" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/75">Browse Filters</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Country, category, and stream status</h3>
                </div>
                <button type="button" onClick={() => setShowMobileFilters(false)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-400/25 bg-blue-950/60 text-blue-100" aria-label="Close filters">
                  <CloseIcon />
                </button>
              </div>
              {filterPanel}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden" data-channel-results>
        {loading && (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-blue-900/25" />)}
          </div>
        )}

        {error && !loading && (
          <div className="m-4 rounded-xl border border-red-400/30 bg-red-500/15 p-4">
            <p className="text-sm font-bold text-red-100">Could not load channels</p>
            <p className="mt-1 text-sm text-red-100/75">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="rounded-2xl border border-blue-400/20 bg-blue-950/50 p-4"><TvIcon /></div>
            <h3 className="mt-4 text-base font-bold text-white/85">No channels match</h3>
            <p className="mt-1.5 text-sm text-blue-200/55">Try clearing the search or relaxing one of the filters.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }}
                className="mt-4 rounded-xl border border-sky-400/35 bg-blue-600/25 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-blue-600/40"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <Virtuoso
            data={filtered}
            computeItemKey={(_index, channel) => channel.id}
            itemContent={renderRow}
            overscan={{ main: 320, reverse: 120 }}
            className="scrollbar-thin"
            style={{ height: "100%", padding: "10px 12px" }}
          />
        )}
      </div>

      {!loading && !error && (
        <div className="shrink-0 border-t border-blue-400/15 bg-[#050f24]/85 px-5 py-2.5 text-[11px] font-semibold text-blue-200/60">
          <div className="flex items-center justify-between">
            <span>{filtered.length} channel{filtered.length !== 1 ? "s" : ""}</span>
            <span className="text-emerald-300/85">{liveCount} with streams</span>
          </div>
        </div>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="fixed bottom-[5.5rem] left-1/2 z-[100] -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-blue-400/35 bg-[#0a1d42]/95 backdrop-blur-md text-sky-100 shadow-[0_8px_32px_rgba(0,0,0,0.65)] transition-all hover:bg-blue-700 hover:text-white active:scale-95 md:absolute md:top-4 md:right-4 md:bottom-auto md:left-auto md:translate-x-0 md:h-9 md:w-9 md:rounded-xl md:border-blue-400/25 md:bg-blue-950/70 md:text-blue-100 md:shadow-none"
          aria-label="Close channel list"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
