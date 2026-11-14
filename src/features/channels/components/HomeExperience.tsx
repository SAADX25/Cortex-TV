import SafeImage from "@/shared/components/SafeImage";
import { useEffect, useMemo, useState } from "react";
import {
  getBrowseMetadata,
  type BrowseMetadata,
  type ChannelWithStream,
  type HomeData,
  type IPTVDataStatus,
  type MetadataOption,
} from "@/features/iptv/hooks/useIPTV";
import {
  CATEGORY_DEFS,
  countrySearchText,
  flagUrl,
  normalizeSearchText,
} from "@/shared/lib/channelUtils";

interface HomeExperienceProps {
  data: HomeData | null;
  status: IPTVDataStatus;
  favorites: ChannelWithStream[];
  recentChannels: ChannelWithStream[];
  onRetry: () => void;
  onOpenSearch: () => void;
  onOpenNews?: () => void;
  onPlayChannel: (channel: ChannelWithStream) => void;
  onToggleFavorite: (channel: ChannelWithStream) => void;
  onBrowseCountry: (country: MetadataOption) => void;
  onBrowseCategory: (category: string) => void;
  onOpenFavorites: () => void;
}

type SheetName = "countries" | "categories" | "about" | null;

const PRIMARY_CATEGORY_KEYS = [
  "all",
  "news",
  "sports",
  "movies",
  "music",
  "entertainment",
  "kids",
  "documentary",
  "religious",
  "business",
];

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg className={spinning ? "animate-spin" : ""} xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
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

function categoryIcon(category: string) {
  switch (category) {
    case "news":
      return <path d="M4 19h16M5 5h14v10H5zM8 9h4M8 12h8" />;
    case "sports":
      return <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM5 6H3a3 3 0 0 0 3 3M19 6h2a3 3 0 0 1-3 3" />;
    case "movies":
      return <path d="M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4" />;
    case "music":
      return <path d="M9 18V5l12-2v13M6 18a3 3 0 1 0 6 0M18 16a3 3 0 1 0 6 0" />;
    case "business":
      return <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />;
    case "kids":
      return <path d="M9 9h.01M15 9h.01M8 14c1.2 1 2.5 1.5 4 1.5s2.8-.5 4-1.5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20" />;
    default:
      return <path d="M4 6h16M4 12h16M4 18h16" />;
  }
}

function CategoryGlyph({ category }: { category: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {categoryIcon(category)}
    </svg>
  );
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return String(count);
}

function LegalContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-blue-100/70">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300/85">About</h3>
        <p className="mt-2">Cortex TV is a public IPTV broadcast explorer built around an interactive 3D globe, live news deck, searchable channel metadata, and a native stream player.</p>
      </section>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300/85">Privacy</h3>
        <p className="mt-2">Cortex TV stores local preferences such as favorites, recent channels, and custom playlist settings in your browser or app storage. It does not require an account for browsing public streams.</p>
      </section>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300/85">Legal</h3>
        <p className="mt-2">Cortex TV does not host video content. It indexes and plays public external streams.</p>
        <p className="mt-2">Channel metadata and public stream references are attributed to iptv-org where used. Availability, regional restrictions, and stream quality are controlled by the original providers.</p>
      </section>
    </div>
  );
}

export default function HomeExperience({
  data,
  status,
  onRetry,
  onOpenSearch,
  onOpenNews,
  onBrowseCountry,
  onBrowseCategory,
}: HomeExperienceProps) {
  const [metadata, setMetadata] = useState<BrowseMetadata | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [countryBrowserOpen, setCountryBrowserOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBrowseMetadata()
      .then((next) => {
        if (!cancelled) setMetadata(next);
      })
      .catch((err) => console.error("[Home] Metadata failed:", err));
    return () => { cancelled = true; };
  }, []);

  const browse = metadata ?? data;
  const countries = browse?.countries ?? [];
  const categories = browse?.categories ?? data?.categories ?? [];
  const channelCount = browse?.channelCount ?? data?.channelCount ?? status.channelCount;
  const streamCount = browse?.streamCount ?? data?.streamCount ?? status.streamCount;

  const categoryOptions = useMemo(() => {
    return PRIMARY_CATEGORY_KEYS.map((key) => {
      const definition = CATEGORY_DEFS.find((item) => item.key === key);
      const match = categories.find((item) => item.value === key || normalizeSearchText(item.label) === key);
      return {
        value: key,
        label: definition?.label ?? key,
        count: key === "all" ? channelCount : match?.count ?? 0,
      };
    });
  }, [categories, channelCount]);

  const filteredCountries = useMemo(() => {
    const query = normalizeSearchText(countryQuery);
    if (!query) return countries;
    const terms = query.split(" ").filter(Boolean);
    return countries.filter((country) => {
      const searchable = countrySearchText(country.value, country.label);
      return terms.every((term) => searchable.includes(term));
    });
  }, [countries, countryQuery]);

  const handleCategory = (category: string) => {
    if (category === "all") onOpenSearch();
    else onBrowseCategory(category);
  };

  const dataLoading = status.phase === "idle" || status.phase === "loading" || status.phase === "updating";

  const countrySearchBar = (
    <div className="flex h-10 items-center gap-2 rounded-xl border border-blue-400/25 bg-[#0a1b3a]/90 px-3 shadow-[inset_0_1px_0_rgba(191,219,254,0.06)] transition-all duration-200 focus-within:border-sky-400/75 focus-within:bg-[#0e254f] focus-within:ring-2 focus-within:ring-blue-500/25">
      <SearchIcon className={`shrink-0 transition-colors ${countryQuery ? "text-sky-300" : "text-blue-200/45"}`} />
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={countryQuery}
        onChange={(event) => setCountryQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filteredCountries[0]) {
            event.preventDefault();
            onBrowseCountry(filteredCountries[0]);
            setSheet(null);
          } else if (event.key === "Escape" && countryQuery) {
            event.stopPropagation();
            setCountryQuery("");
          }
        }}
        placeholder="Search countries or regions…"
        aria-label="Search countries"
        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:font-medium placeholder:text-blue-200/40"
      />
      {countryQuery && (
        <span className="shrink-0 rounded-md bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-sky-200">
          {filteredCountries.length}
        </span>
      )}
      {countryQuery && (
        <button
          type="button"
          onClick={() => setCountryQuery("")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-blue-200/60 transition-colors hover:bg-blue-500/25 hover:text-white"
          aria-label="Clear country search"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );

  /* Country rows — rendered inside any scroll container */
  const countryRows = (
    <>
      {dataLoading && countries.length === 0 ? (
        <div className="space-y-2 py-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-xl bg-blue-900/25" />
          ))}
        </div>
      ) : filteredCountries.length > 0 ? (
        <div className="space-y-1 pb-4">
          {filteredCountries.map((country) => (
            <button
              key={country.value}
              type="button"
              onClick={() => { onBrowseCountry(country); setSheet(null); }}
              className="country-row group flex w-full items-center gap-3 rounded-xl border border-blue-400/[0.08] bg-[#0a1936]/55 px-3 py-2.5 text-left transition-all duration-150 hover:border-sky-400/45 hover:bg-gradient-to-r hover:from-blue-600/25 hover:to-sky-500/10 hover:shadow-[0_4px_18px_rgba(37,99,235,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 active:scale-[0.985]"
            >
              <SafeImage
                src={flagUrl(country.value, 40)}
                alt=""
                className="h-5 w-7 shrink-0 rounded-[4px] object-cover ring-1 ring-white/15 shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-slate-100 transition-colors group-hover:text-white">
                {country.label}
              </span>
              <span className="hidden sm:inline-block shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-300/45 group-hover:text-sky-300/75">
                {country.value}
              </span>
              <span className="shrink-0 rounded-full border border-blue-400/20 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-sky-200 transition-all group-hover:border-sky-300/40 group-hover:bg-blue-500/35 group-hover:text-white">
                {formatCount(country.count)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="my-4 rounded-xl border border-blue-400/20 bg-blue-950/40 p-5 text-center">
          <p className="text-sm font-bold text-white/85">
            {countryQuery ? `No countries match "${countryQuery}"` : "No countries loaded yet"}
          </p>
          <p className="mt-1 text-xs text-blue-200/55">
            {countryQuery ? "Try English, Arabic, or ISO codes like US, UK, UAE." : "Click Refresh to retry loading the broadcast directory."}
          </p>
          {countryQuery && (
            <button
              type="button"
              onClick={() => setCountryQuery("")}
              className="mt-3 rounded-lg border border-sky-400/35 bg-blue-600/25 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-blue-600/40"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </>
  );

  const categoriesGrid = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
      {categoryOptions.map((category) => (
        <button
          key={category.value}
          type="button"
          onClick={() => { handleCategory(category.value); setSheet(null); }}
          className="flex min-h-14 items-center gap-3 rounded-xl border border-blue-400/15 bg-[#0b1d3f]/75 px-3 py-2 text-left transition-all hover:border-sky-400/45 hover:bg-blue-600/25"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-sky-200"><CategoryGlyph category={category.value} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white/90">{category.label}</span>
            <span className="text-[11px] font-semibold text-blue-200/55">{formatCount(category.count)} channels</span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────
          Desktop: Right country directory — royal broadcast blue HUD
      ───────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-30 hidden md:block">
        {/* ── Docked Country Directory Toggle ── */}
        <button
          type="button"
          onClick={() => setCountryBrowserOpen((v) => !v)}
          className={`pointer-events-auto absolute top-5 z-[70] flex items-center justify-center gap-2 border border-blue-400/30 bg-gradient-to-r from-[#0d2248]/95 to-[#081632]/95 text-sky-100 shadow-[0_8px_28px_rgba(2,8,24,0.6),0_0_20px_rgba(37,99,235,0.22)] backdrop-blur-xl transition-all duration-300 hover:border-sky-300/55 hover:from-blue-600/80 hover:to-blue-700/80 hover:text-white active:scale-95 ${
            countryBrowserOpen
              ? "right-[352px] xl:right-[392px] h-10 w-10 rounded-l-xl rounded-r-none border-r-0"
              : "right-4 h-10 rounded-xl px-3.5"
          }`}
          aria-label={countryBrowserOpen ? "Close Country Browser" : "Open Country Browser"}
          title={countryBrowserOpen ? "Close Country Browser" : "Open Country Browser"}
        >
          {countryBrowserOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          ) : (
            <>
              <GlobeIcon className="h-4 w-4 text-sky-300" />
              <span className="text-xs font-bold tracking-wide">Countries</span>
              <span className="rounded-md bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-sky-200">
                {countries.length || "…"}
              </span>
            </>
          )}
        </button>

        <aside
          className={`cortex-hud-panel pointer-events-auto absolute bottom-0 right-0 top-0 flex w-[352px] xl:w-[392px] flex-col overflow-hidden rounded-l-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            countryBrowserOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* ── Sticky Royal Blue Directory Header ── */}
          <div className="shrink-0 border-b border-blue-400/15 bg-gradient-to-b from-[#0e244d]/95 via-[#091836]/85 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                  Broadcast Directory
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-[17px] font-extrabold tracking-tight text-white">Countries</h2>
                  <span className="rounded-full border border-blue-400/25 bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-sky-200">
                    {countries.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-blue-200/55">
                  {channelCount ? `${channelCount.toLocaleString()} channels · ${streamCount.toLocaleString()} live` : "Global IPTV Index"}
                </p>
              </div>

              <button
                type="button"
                onClick={onRetry}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-400/25 bg-blue-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-200 transition-all hover:border-sky-300/45 hover:bg-blue-500/30 hover:text-white active:scale-95"
                title="Refresh broadcast index"
              >
                <RefreshIcon spinning={dataLoading} />
                Refresh
              </button>
            </div>

            {/* Quick News Desk & Search shortcuts */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {onOpenNews && (
                <button
                  type="button"
                  onClick={onOpenNews}
                  className="flex items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-gradient-to-r from-blue-600/80 via-blue-500/75 to-sky-500/75 px-3 py-2 text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] transition-all hover:from-blue-500 hover:to-sky-400 active:scale-[0.98]"
                >
                  <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)] animate-pulse" />
                  Live News Flip
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSearch}
                className={`flex items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-950/60 px-3 py-2 text-[12px] font-bold text-blue-100 transition-all hover:border-sky-400/45 hover:bg-blue-800/40 hover:text-white active:scale-[0.98] ${onOpenNews ? "" : "col-span-2"}`}
              >
                <SearchIcon className="h-3.5 w-3.5 text-sky-300" />
                Global Search
              </button>
            </div>

            {/* Search input */}
            <div className="mt-3">
              {countrySearchBar}
            </div>
          </div>

          {/* ── Scrollable country list ── */}
          <div
            className="country-scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {countryRows}
          </div>

          {/* Error bar */}
          {status.phase === "error" && (
            <div className="mx-3 mb-3 mt-1 shrink-0 rounded-xl border border-red-400/30 bg-red-500/15 p-2.5 text-xs text-red-100">
              {status.error ?? "Channel metadata could not be refreshed."}
            </div>
          )}
        </aside>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          Mobile: Bottom sheet (countries / categories / about)
      ───────────────────────────────────────────────────────────────── */}
      {sheet && (
        <div className="fixed inset-0 z-[9200] bg-black/55 backdrop-blur-[2px] md:hidden" onClick={() => setSheet(null)}>
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[84dvh] flex-col rounded-t-2xl border-t border-blue-400/25 bg-[#07152e] shadow-[0_-24px_80px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 px-4 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/75">Explore</p>
                  <h2 className="mt-1 text-lg font-bold text-white">
                    {sheet === "countries" ? "Countries" : sheet === "categories" ? "Categories" : "About Cortex TV"}
                  </h2>
                </div>
              </div>
              {sheet === "countries" && (
                <>
                  <div className="mt-3">{countrySearchBar}</div>
                  <div className="mt-3 h-px bg-gradient-to-r from-transparent via-blue-400/25 to-transparent" />
                </>
              )}
              {sheet !== "countries" && <div className="mt-3 h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />}
            </div>

            {sheet === "countries" && (
              <div
                className="country-scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="pt-2">{countryRows}</div>
              </div>
            )}
            {sheet === "categories" && (
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
                <div className="pt-3">{categoriesGrid}</div>
              </div>
            )}
            {sheet === "about" && (
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
                <div className="pt-3"><LegalContent /></div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSheet(null)}
            className="fixed bottom-[5.5rem] left-1/2 z-[9300] -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-blue-400/35 bg-[#0a1d42]/95 backdrop-blur-md text-sky-100 shadow-[0_8px_32px_rgba(0,0,0,0.65)] transition-all hover:bg-blue-800 hover:text-white active:scale-95"
            aria-label="Close sheet"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Desktop: About modal */}
      {infoOpen && (
        <div className="fixed inset-0 z-[210] hidden items-center justify-center bg-black/55 p-6 backdrop-blur-[2px] md:flex" onMouseDown={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}>
          <div className="w-full max-w-xl rounded-2xl border border-blue-400/25 bg-[#07142b]/98 p-5 shadow-[0_24px_90px_rgba(2,8,24,0.75)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300/75">Cortex TV</p>
                <h2 className="mt-1 text-2xl font-bold text-white">About, Privacy, and Legal</h2>
              </div>
              <button type="button" onClick={() => setInfoOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-400/25 bg-blue-950/60 text-blue-100 hover:text-white" aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <LegalContent />
          </div>
        </div>
      )}
    </>
  );
}
