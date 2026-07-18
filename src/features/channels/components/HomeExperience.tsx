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
  cleanName,
  flagUrl,
  getStreamHealth,
  isUsableStream,
  normalizeSearchText,
} from "@/shared/lib/channelUtils";

interface HomeExperienceProps {
  data: HomeData | null;
  status: IPTVDataStatus;
  favorites: ChannelWithStream[];
  recentChannels: ChannelWithStream[];
  onRetry: () => void;
  onOpenSearch: () => void;
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
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function DiceIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="16" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
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

function knownPlayable(channel: ChannelWithStream): boolean {
  const health = getStreamHealth(channel.streamUrl, channel.streamStatus, channel.name, channel.country);
  return health === "online" || (!!channel.streamStatus && isUsableStream(channel.streamUrl, channel.streamStatus, channel.name, channel.country));
}

function uniqueChannels(channels: ChannelWithStream[]): ChannelWithStream[] {
  const seen = new Set<string>();
  const result: ChannelWithStream[] = [];
  for (const channel of channels) {
    if (seen.has(channel.id)) continue;
    seen.add(channel.id);
    result.push(channel);
  }
  return result;
}

function LegalContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-white/58">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">About</h3>
        <p className="mt-2">Cortex TV is a premium public IPTV explorer built around a real-time globe, searchable channel metadata, and an external stream player.</p>
      </section>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Privacy</h3>
        <p className="mt-2">Cortex TV stores local preferences such as favorites, recent channels, and custom playlist settings in your browser or app storage. It does not require an account for browsing public streams.</p>
      </section>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Legal</h3>
        <p className="mt-2">Cortex TV does not host video content. It indexes and plays public external streams.</p>
        <p className="mt-2">Channel metadata and public stream references are attributed to iptv-org where used. Availability, regional restrictions, and stream quality are controlled by the original providers.</p>
      </section>
    </div>
  );
}

function ModeToggle() {
  return (
    <div className="inline-flex items-center rounded-full border border-cyan-200/15 bg-black/45 p-1 shadow-[0_0_28px_rgba(0,255,255,0.08)] backdrop-blur-md">
      <button type="button" className="flex h-9 items-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.35)]">
        <GlobeIcon className="h-4 w-4" />
        TV
      </button>
      <button type="button" disabled className="flex h-9 cursor-not-allowed items-center gap-2 rounded-full px-4 text-xs font-semibold text-white/34" title="Radio coming soon">
        Radio coming soon
      </button>
    </div>
  );
}

export default function HomeExperience({
  data,
  status,
  favorites,
  recentChannels,
  onRetry,
  onOpenSearch,
  onPlayChannel,
  onBrowseCountry,
  onBrowseCategory,
  onOpenFavorites,
}: HomeExperienceProps) {
  const [metadata, setMetadata] = useState<BrowseMetadata | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [randomMessage, setRandomMessage] = useState<string | null>(null);
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
    return countries.filter((country) => {
      const searchable = normalizeSearchText(`${country.label} ${country.value}`);
      return searchable.includes(query);
    });
  }, [countries, countryQuery]);

  const randomCandidates = useMemo(() => {
    return uniqueChannels([
      ...favorites,
      ...recentChannels,
      ...(data?.featured ?? []),
      ...(data?.popular ?? []),
      ...(data?.continueBrowsing ?? []),
    ]).filter(knownPlayable);
  }, [data, favorites, recentChannels]);

  const handleRandom = () => {
    if (randomCandidates.length === 0) {
      setRandomMessage("No confirmed playable stream is available yet. Select a country or search channels.");
      return;
    }
    setRandomMessage(null);
    const picked = randomCandidates[Math.floor(Math.random() * randomCandidates.length)];
    if (picked) onPlayChannel(picked);
  };

  const handleCategory = (category: string) => {
    if (category === "all") onOpenSearch();
    else onBrowseCategory(category);
  };

  const dataLoading = status.phase === "idle" || status.phase === "loading" || status.phase === "updating";

  /* Country rows â€” rendered inside any scroll container */
  const countryRows = (
    <>
      {dataLoading && countries.length === 0 ? (
        <div className="space-y-2 py-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
            <div key={item} className="h-11 animate-pulse rounded-lg bg-white/[0.055]" />
          ))}
        </div>
      ) : filteredCountries.length > 0 ? (
        <div className="space-y-[3px] pb-4">
          {filteredCountries.map((country) => (
            <button
              key={country.value}
              type="button"
              onClick={() => { onBrowseCountry(country); setSheet(null); }}
              className="country-row group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150 hover:border-cyan-300/22 hover:bg-cyan-300/[0.065] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
            >
              <img
                src={flagUrl(country.value, 40)}
                alt=""
                className="h-5 w-7 shrink-0 rounded-[3px] object-cover opacity-90 shadow-[0_1px_4px_rgba(0,0,0,0.5)] group-hover:opacity-100 transition-opacity"
                loading="lazy"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white">
                {country.label}
              </span>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-200/55 transition-all group-hover:bg-cyan-300/[0.12] group-hover:text-cyan-200/85">
                {formatCount(country.count)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="my-4 rounded-xl border border-white/[0.07] bg-white/[0.04] p-4 text-center">
          <p className="text-sm font-semibold text-white/72">No countries found</p>
          <p className="mt-1 text-xs text-white/38">Try a shorter search term.</p>
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
          className="flex min-h-14 items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.045] px-3 py-2 text-left transition-all hover:border-cyan-300/28 hover:bg-cyan-300/[0.085]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-100"><CategoryGlyph category={category.value} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white/84">{category.label}</span>
            <span className="text-[11px] font-semibold text-white/35">{formatCount(category.count)} channels</span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────
          Desktop: Right country panel â€” fixed inside the globe overlay
      ───────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-30 hidden md:block">
        {/* ── Country Browser Toggle ── */}
        <button
          type="button"
          onClick={() => setCountryBrowserOpen((v) => !v)}
          className={`pointer-events-auto absolute top-5 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/16 bg-[#07101f]/85 text-cyan-100/80 shadow-[0_0_24px_rgba(34,211,238,0.14)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-200/34 hover:bg-cyan-300/10 hover:text-cyan-100 ${
            countryBrowserOpen ? "right-[316px] xl:right-[352px]" : "right-4"
          }`}
          aria-label={countryBrowserOpen ? "Close Country Browser" : "Open Country Browser"}
          title={countryBrowserOpen ? "Close Country Browser" : "Open Country Browser"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {countryBrowserOpen ? (
              <>
                <path d="M20 12H9" />
                <path d="m15 18-6-6 6-6" />
              </>
            ) : (
              <>
                <path d="M4 12h11" />
                <path d="m9 6 6 6-6 6" />
              </>
            )}
          </svg>
        </button>

        <aside className={`cortex-hud-panel pointer-events-auto absolute bottom-0 right-0 top-0 flex w-[300px] xl:w-[336px] flex-col overflow-hidden rounded-l-2xl transition-transform duration-300 ${countryBrowserOpen ? "translate-x-0" : "translate-x-full"}`}>

          {/* ── Sticky header (does NOT scroll) ── */}
          <div className="shrink-0 px-4 pt-4 pb-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-300/48">
              Country Browser
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-extrabold leading-tight text-white">
                Select a Country
              </h2>
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200/45 transition-all hover:border-cyan-300/28 hover:bg-cyan-300/[0.07] hover:text-cyan-200/85"
              >
                Refresh
              </button>
            </div>

            {/* Search input */}
            <div className="mt-3 mb-3 flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 transition-all duration-200 focus-within:border-cyan-300/38 focus-within:bg-cyan-300/[0.04] focus-within:shadow-[0_0_18px_rgba(34,211,238,0.07)]">
              <SearchIcon className={`shrink-0 transition-colors ${countryQuery ? "text-cyan-300/70" : "text-white/28"}`} />
              <input
                type="text"
                inputMode="search"
                autoComplete="off"
                value={countryQuery}
                onChange={(event) => setCountryQuery(event.target.value)}
                placeholder="Search countriesâ€¦"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/28"
              />
              {countryQuery && (
                <button
                  type="button"
                  onClick={() => setCountryQuery("")}
                  className="shrink-0 text-white/28 transition-colors hover:text-white/65"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Subtle divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
          </div>

          {/* ── Scrollable country list ── KEY FIX ── */}
          <div
            className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {countryRows}
          </div>

          {/* Error bar */}
          {status.phase === "error" && (
            <div className="mx-3 mb-3 mt-1 shrink-0 rounded-lg border border-red-300/18 bg-red-400/8 p-2.5 text-xs text-red-100/70">
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
            className="absolute inset-x-0 bottom-0 flex max-h-[84dvh] flex-col rounded-t-2xl border-t border-cyan-200/14 bg-[#07101f] shadow-[0_-24px_80px_rgba(0,0,0,0.58)]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Sheet header (sticky) */}
            <div className="shrink-0 px-4 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/62">Explore</p>
                  <h2 className="mt-1 text-lg font-bold text-white">
                    {sheet === "countries" ? "Countries" : sheet === "categories" ? "Categories" : "About Cortex TV"}
                  </h2>
                </div>
                <button type="button" onClick={() => setSheet(null)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-white/62" aria-label="Close sheet">
                  <CloseIcon />
                </button>
              </div>
              {sheet === "countries" && (
                <>
                  <div className="mt-3 flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 transition-all focus-within:border-cyan-300/40">
                    <SearchIcon className={countryQuery ? "text-cyan-200" : "text-white/32"} />
                    <input
                      value={countryQuery}
                      onChange={(event) => setCountryQuery(event.target.value)}
                      placeholder="Search countriesâ€¦"
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/34"
                    />
                  </div>
                  <div className="mt-3 h-px bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
                </>
              )}
              {sheet !== "countries" && <div className="mt-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />}
            </div>

            {/* Scrollable content */}
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
        </div>
      )}

      {/* Desktop: About modal */}
      {infoOpen && (
        <div className="fixed inset-0 z-[210] hidden items-center justify-center bg-black/55 p-6 backdrop-blur-[2px] md:flex" onMouseDown={(event) => { if (event.target === event.currentTarget) setInfoOpen(false); }}>
          <div className="w-full max-w-xl rounded-xl border border-cyan-200/14 bg-[#07101f]/98 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.58)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/62">Cortex TV</p>
                <h2 className="mt-1 text-2xl font-bold text-white">About, Privacy, and Legal</h2>
              </div>
              <button type="button" onClick={() => setInfoOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-white/62 hover:text-white" aria-label="Close">
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