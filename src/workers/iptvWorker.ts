import {
  CATEGORY_DEFS,
  categoryDisplayName,
  countryName,
  getStreamHealth,
  isUsableStream,
  languageName,
  matchesCategory,
  normalizeChannelNameForSearch,
  normalizeSearchText,
} from "../utils/channelUtils";
import type {
  BrowseMetadata,
  ChannelWithStream,
  HomeData,
  MetadataOption,
  SearchFilters,
  WorkerRequest,
  WorkerResponse,
} from "./iptvWorker.types";

let allChannels: ChannelWithStream[] = [];
let streamUrlMap: Map<string, string> = new Map();
let streamStatusMap: Map<string, string | null> = new Map();
let countryIndex: Map<string, ChannelWithStream[]> = new Map();
let newsChannelsCache: ChannelWithStream[] = [];
let searchIndex: SearchEntry[] = [];
let browseMetadata: BrowseMetadata = {
  channelCount: 0,
  streamCount: 0,
  countries: [],
  categories: [],
  languages: [],
};

const SEARCH_ALIASES: Record<string, string[]> = {
  uk: ["uk", "gb", "united kingdom"],
  gb: ["uk", "gb", "united kingdom"],
  usa: ["us", "usa", "united states", "america"],
  us: ["us", "usa", "united states", "america"],
  uae: ["ae", "uae", "united arab emirates"],
};

const PRIORITY_COUNTRIES = new Set([
  "US",
  "GB",
  "UK",
  "CA",
  "FR",
  "DE",
  "ES",
  "IT",
  "BR",
  "MX",
  "AU",
  "IN",
  "JP",
]);

interface SearchEntry {
  channel: ChannelWithStream;
  name: string;
  nameCore: string;
  altNames: string[];
  countryCode: string;
  country: string;
  categories: string[];
  languages: string[];
  haystack: string;
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    out.push(trimmed);
  }
  return out;
}

function streamStatusRank(ch: ChannelWithStream): number {
  const health = getStreamHealth(ch.streamUrl, ch.streamStatus, ch.name, ch.country);
  switch (health) {
    case "online":
      return 4;
    case "unknown":
      return ch.streamUrl ? 3 : 0;
    case "geo-blocked":
      return 1;
    case "offline":
    default:
      return 0;
  }
}

function sortChannels(arr: ChannelWithStream[]): ChannelWithStream[] {
  return arr.sort((a, b) => {
    const statusDelta = streamStatusRank(b) - streamStatusRank(a);
    if (statusDelta !== 0) return statusDelta;
    if (a.logo && !b.logo) return -1;
    if (!a.logo && b.logo) return 1;
    return a.name.localeCompare(b.name);
  });
}

function buildChannel(raw: any): ChannelWithStream | null {
  if (raw?.is_nsfw) return null;
  const id = raw?.id ?? "";
  if (!id) return null;
  const country = (raw.country ?? "").toUpperCase();
  const languages = uniqueStrings(raw.languages);
  const altNames = uniqueStrings(raw.alt_names ?? raw.altNames ?? raw.alt_names ?? []);
  return {
    id,
    name: raw.name ?? "Unknown",
    logo: raw.logo || null,
    country,
    countryName: countryName(country),
    categories: uniqueStrings(raw.categories),
    languages,
    languageNames: languages.map(languageName),
    altNames,
    website: raw.website || null,
    isNsfw: false,
    streamUrl: streamUrlMap.get(id) ?? null,
    streamStatus: streamStatusMap.get(id) ?? null,
  };
}

function buildSearchEntry(channel: ChannelWithStream): SearchEntry {
  const normalizedName = normalizeSearchText(channel.name);
  const nameCore = normalizeChannelNameForSearch(channel.name);
  const altNames = (channel.altNames ?? []).map(normalizeChannelNameForSearch).filter(Boolean);
  const countryLabel = normalizeSearchText(channel.countryName ?? countryName(channel.country));
  const countryCode = normalizeSearchText(channel.country);
  const categories = channel.categories.map((cat) => normalizeSearchText(categoryDisplayName(cat)));
  const languages = [
    ...channel.languages.map(normalizeSearchText),
    ...(channel.languageNames ?? []).map(normalizeSearchText),
  ].filter(Boolean);
  const haystack = [
    normalizedName,
    nameCore,
    ...altNames,
    countryCode,
    countryLabel,
    ...categories,
    ...languages,
  ].filter(Boolean).join(" ");

  return {
    channel,
    name: normalizedName,
    nameCore,
    altNames,
    countryCode,
    country: countryLabel,
    categories,
    languages,
    haystack,
  };
}

function topOptionsFromMap(map: Map<string, MetadataOption>, limit: number): MetadataOption[] {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function buildCategoryOptions(): MetadataOption[] {
  const known: MetadataOption[] = CATEGORY_DEFS.map((def) => {
    if (def.key === "all") {
      return { value: "all", label: "All", count: allChannels.length };
    }
    return {
      value: def.key,
      label: def.label,
      count: allChannels.filter((ch) => matchesCategory(ch.categories, def.key)).length,
    };
  });

  const extras = new Map<string, MetadataOption>();
  for (const ch of allChannels) {
    for (const raw of ch.categories) {
      const label = categoryDisplayName(raw);
      const value = normalizeSearchText(label);
      if (!value || known.some((opt) => opt.value === value || normalizeSearchText(opt.label) === value)) continue;
      const existing = extras.get(value);
      if (existing) existing.count += 1;
      else extras.set(value, { value, label, count: 1 });
    }
  }

  return [...known, ...topOptionsFromMap(extras, 18)].filter((opt) => opt.count > 0);
}

function rebuildIndexes(): void {
  countryIndex = new Map();
  newsChannelsCache = [];
  searchIndex = [];

  const countryOptions = new Map<string, MetadataOption>();
  const languageOptions = new Map<string, MetadataOption>();

  for (const ch of allChannels) {
    if (ch.country) {
      let bucket = countryIndex.get(ch.country);
      if (!bucket) {
        bucket = [];
        countryIndex.set(ch.country, bucket);
      }
      bucket.push(ch);

      const countryOpt = countryOptions.get(ch.country);
      if (countryOpt) countryOpt.count += 1;
      else countryOptions.set(ch.country, {
        value: ch.country,
        label: ch.countryName ?? countryName(ch.country),
        count: 1,
      });
    }

    for (const lang of ch.languages) {
      const key = lang.toLowerCase();
      const langOpt = languageOptions.get(key);
      if (langOpt) langOpt.count += 1;
      else languageOptions.set(key, { value: key, label: languageName(key), count: 1 });
    }

    if (matchesCategory(ch.categories, "news") || normalizeSearchText(ch.name).includes("news")) {
      newsChannelsCache.push(ch);
    }

    searchIndex.push(buildSearchEntry(ch));
  }

  for (const [, bucket] of countryIndex) sortChannels(bucket);
  sortChannels(newsChannelsCache);

  browseMetadata = {
    channelCount: allChannels.length,
    streamCount: streamUrlMap.size,
    countries: topOptionsFromMap(countryOptions, 80),
    categories: buildCategoryOptions(),
    languages: topOptionsFromMap(languageOptions, 40),
  };
}

function handleInit(rawChannels: any[], rawStreams: any[]): WorkerResponse {
  const t0 = performance.now();
  streamUrlMap = new Map();
  streamStatusMap = new Map();

  for (const stream of rawStreams) {
    if (!stream?.channel || streamUrlMap.has(stream.channel)) continue;
    streamUrlMap.set(stream.channel, stream.url ?? "");
    streamStatusMap.set(stream.channel, stream.status ?? stream.health ?? null);
  }

  allChannels = [];
  for (const raw of rawChannels) {
    const channel = buildChannel(raw);
    if (channel) allChannels.push(channel);
  }

  rebuildIndexes();

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(
    `[Worker] Indexed ${allChannels.length} channels, ${streamUrlMap.size} streams, ${countryIndex.size} countries in ${elapsed}ms`,
  );

  return {
    type: "INIT_COMPLETE",
    channelCount: allChannels.length,
    streamCount: streamUrlMap.size,
  };
}

function handleFilterByCountry(id: number, countryCodes: string[]): WorkerResponse {
  const results: ChannelWithStream[] = [];
  for (const code of countryCodes) {
    const bucket = countryIndex.get(code.toUpperCase());
    if (bucket) results.push(...bucket);
  }
  const seen = new Set<string>();
  const unique = results.filter((ch) => {
    if (seen.has(ch.id)) return false;
    seen.add(ch.id);
    return true;
  });
  return { type: "FILTER_RESULT", id, channels: unique };
}

function passesFilters(
  entry: SearchEntry,
  filters: SearchFilters,
  favoriteIds: Set<string>,
): boolean {
  const ch = entry.channel;
  if (filters.favoritesOnly && !favoriteIds.has(ch.id)) return false;
  if (filters.workingOnly && !isUsableStream(ch.streamUrl, ch.streamStatus, ch.name, ch.country)) return false;
  if (filters.country && filters.country !== "all" && ch.country.toUpperCase() !== filters.country.toUpperCase()) return false;
  if (filters.category && filters.category !== "all" && !matchesCategory(ch.categories, filters.category)) return false;
  if (filters.language && filters.language !== "all") {
    const wanted = filters.language.toLowerCase();
    if (!ch.languages.some((lang) => lang.toLowerCase() === wanted)) return false;
  }
  return true;
}

function bestTextScore(entry: SearchEntry, query: string, terms: string[]): number {
  if (!query) return 120;

  const aliases = SEARCH_ALIASES[query] ?? [query];
  let score = 0;

  for (const q of aliases) {
    if (entry.nameCore === q) score = Math.max(score, 1000);
    else if (entry.name === q) score = Math.max(score, 940);
    else if (entry.nameCore.startsWith(q)) score = Math.max(score, 850);
    else if (entry.name.startsWith(q)) score = Math.max(score, 800);
    else if (entry.nameCore.includes(q) || entry.name.includes(q)) score = Math.max(score, 700);

    if (entry.altNames.some((name) => name === q)) score = Math.max(score, 650);
    else if (entry.altNames.some((name) => name.startsWith(q))) score = Math.max(score, 590);
    else if (entry.altNames.some((name) => name.includes(q))) score = Math.max(score, 540);

    if (entry.countryCode === q || entry.country === q) score = Math.max(score, 470);
    else if (entry.country.startsWith(q)) score = Math.max(score, 420);

    if (entry.categories.some((cat) => cat === q)) score = Math.max(score, 380);
    else if (entry.categories.some((cat) => cat.includes(q))) score = Math.max(score, 330);

    if (entry.languages.some((lang) => lang === q || lang.includes(q))) score = Math.max(score, 300);
  }

  if (score === 0 && terms.length > 0) {
    let termScore = 0;
    let matchedTerms = 0;
    for (const term of terms) {
      if (entry.nameCore.includes(term) || entry.name.includes(term)) {
        termScore += 95;
        matchedTerms += 1;
      } else if (entry.altNames.some((name) => name.includes(term))) {
        termScore += 70;
        matchedTerms += 1;
      } else if (entry.country.includes(term) || entry.countryCode.includes(term)) {
        termScore += 48;
        matchedTerms += 1;
      } else if (entry.categories.some((cat) => cat.includes(term))) {
        termScore += 38;
        matchedTerms += 1;
      } else if (entry.languages.some((lang) => lang.includes(term))) {
        termScore += 30;
        matchedTerms += 1;
      }
    }
    if (matchedTerms === terms.length) score = Math.max(score, 220 + termScore);
  }

  return score;
}

function scoreSearchResult(
  entry: SearchEntry,
  query: string,
  terms: string[],
  favoriteIds: Set<string>,
  recentIds: Set<string>,
): number {
  let score = bestTextScore(entry, query, terms);
  if (score <= 0) return 0;

  const ch = entry.channel;
  if (favoriteIds.has(ch.id)) score += 28;
  if (recentIds.has(ch.id)) score += 18;
  if (PRIORITY_COUNTRIES.has(ch.country)) score += 4;
  if (ch.logo) score += 4;

  const health = getStreamHealth(ch.streamUrl, ch.streamStatus, ch.name, ch.country);
  if (health === "online") score += 14;
  else if (health === "unknown" && ch.streamUrl) score += 4;
  else if (health === "geo-blocked") score -= 45;
  else if (health === "offline") score -= 70;

  return Math.max(score, 1);
}

function handleSearch(
  id: number,
  query: string,
  limit: number,
  filters: SearchFilters,
  favoriteIdsRaw: string[],
  recentIdsRaw: string[],
): WorkerResponse {
  const normalizedQuery = normalizeChannelNameForSearch(query);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const favoriteIds = new Set(favoriteIdsRaw);
  const recentIds = new Set(recentIdsRaw);
  const scored: Array<{ channel: ChannelWithStream; score: number }> = [];

  for (const entry of searchIndex) {
    if (!passesFilters(entry, filters, favoriteIds)) continue;
    const score = scoreSearchResult(entry, normalizedQuery, terms, favoriteIds, recentIds);
    if (score <= 0) continue;
    scored.push({ channel: entry.channel, score });
  }

  scored.sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;
    const statusDelta = streamStatusRank(b.channel) - streamStatusRank(a.channel);
    if (statusDelta !== 0) return statusDelta;
    return a.channel.name.localeCompare(b.channel.name);
  });

  return {
    type: "SEARCH_RESULT",
    id,
    channels: scored.slice(0, limit).map((item) => item.channel),
  };
}

function handleFetchNews(
  id: number,
  limit: number,
  extraPlaylistChannels: ChannelWithStream[],
): WorkerResponse {
  const results: ChannelWithStream[] = [];
  const seenIds = new Set<string>();

  for (const ch of extraPlaylistChannels) {
    const isYouTube = !!ch.streamUrl && /youtube\.com|youtu\.be|yt\.be|googlevideo\.com/i.test(ch.streamUrl);
    const isNews = matchesCategory(ch.categories, "news") || normalizeSearchText(ch.name).includes("news");
    if (isYouTube || isNews) {
      results.push(ch);
      seenIds.add(ch.id);
    }
  }

  for (const ch of newsChannelsCache) {
    if (seenIds.has(ch.id)) continue;
    results.push(ch);
    seenIds.add(ch.id);
    if (results.length >= limit) break;
  }

  return { type: "NEWS_RESULT", id, channels: sortChannels(results) };
}

function handleProcessFallback(id: number, rawChannels: any[]): WorkerResponse {
  const mapped: ChannelWithStream[] = [];
  for (const raw of rawChannels) {
    const channel = buildChannel(raw);
    if (channel) mapped.push(channel);
  }
  return { type: "FALLBACK_RESULT", id, channels: sortChannels(mapped) };
}

function weightedHomeScore(ch: ChannelWithStream, avoid: Set<string>): number {
  if (avoid.has(ch.id)) return -1000;
  let score = 0;
  if (isUsableStream(ch.streamUrl, ch.streamStatus, ch.name, ch.country)) score += 50;
  else if (ch.streamUrl) score += 22;
  if (ch.logo) score += 12;
  if (PRIORITY_COUNTRIES.has(ch.country)) score += 10;
  if (matchesCategory(ch.categories, "news")) score += 8;
  if (matchesCategory(ch.categories, "sports")) score += 7;
  if (matchesCategory(ch.categories, "movies")) score += 6;
  if (matchesCategory(ch.categories, "music")) score += 5;
  if (matchesCategory(ch.categories, "entertainment")) score += 4;
  return score;
}

function pickHomeChannels(limit: number, avoid: Set<string>, predicate?: (ch: ChannelWithStream) => boolean): ChannelWithStream[] {
  return allChannels
    .filter((ch) => !predicate || predicate(ch))
    .map((channel) => ({ channel, score: weightedHomeScore(channel, avoid) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.channel.name.localeCompare(b.channel.name))
    .slice(0, limit)
    .map((item) => {
      avoid.add(item.channel.id);
      return item.channel;
    });
}

function handleHomeData(id: number, favoriteIds: string[], recentIds: string[]): WorkerResponse {
  const avoid = new Set<string>([...favoriteIds, ...recentIds]);
  const featured = pickHomeChannels(12, avoid, (ch) =>
    !!ch.logo &&
    (matchesCategory(ch.categories, "news") ||
      matchesCategory(ch.categories, "sports") ||
      matchesCategory(ch.categories, "movies") ||
      matchesCategory(ch.categories, "entertainment")),
  );
  const popular = pickHomeChannels(12, avoid, (ch) => PRIORITY_COUNTRIES.has(ch.country));
  const continueBrowsing = pickHomeChannels(16, avoid);

  const data: HomeData = {
    featured,
    popular,
    continueBrowsing,
    countries: browseMetadata.countries.slice(0, 14),
    categories: browseMetadata.categories.filter((cat) => cat.value !== "all").slice(0, 10),
    languages: browseMetadata.languages.slice(0, 10),
    channelCount: browseMetadata.channelCount,
    streamCount: browseMetadata.streamCount,
  };

  return { type: "HOME_DATA_RESULT", id, data };
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  let response: WorkerResponse;

  try {
    switch (msg.type) {
      case "INIT":
        response = handleInit(msg.rawChannels, msg.rawStreams);
        break;
      case "FILTER_BY_COUNTRY":
        response = handleFilterByCountry(msg.id, msg.countryCodes);
        break;
      case "SEARCH":
        response = handleSearch(
          msg.id,
          msg.query,
          msg.limit,
          msg.filters,
          msg.favoriteIds,
          msg.recentIds,
        );
        break;
      case "FETCH_NEWS":
        response = handleFetchNews(msg.id, msg.limit, msg.extraPlaylistChannels);
        break;
      case "PROCESS_FALLBACK":
        response = handleProcessFallback(msg.id, msg.rawChannels);
        break;
      case "GET_HOME_DATA":
        response = handleHomeData(msg.id, msg.favoriteIds, msg.recentIds);
        break;
      case "GET_METADATA":
        response = { type: "METADATA_RESULT", id: msg.id, metadata: browseMetadata };
        break;
      default:
        response = { type: "ERROR", message: `Unknown message type: ${(msg as any).type}` };
    }
  } catch (err: any) {
    response = {
      type: "ERROR",
      id: (msg as any).id,
      message: err.message ?? "Worker error",
    };
  }

  self.postMessage(response);
};