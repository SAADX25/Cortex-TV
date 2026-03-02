/* ──────────────────────────────────────────────────
   iptvWorker.ts – Off-thread IPTV data processing
   
   Runs ALL filtering, sorting, searching, and indexing
   off the main thread. The main thread only sends raw
   JSON data after fetch and receives ready-to-render
   ChannelWithStream[] arrays.
   
   Key optimisation: an inverted country index is built
   once during INIT so that every country click resolves
   in O(1) with zero main-thread compute.
   ────────────────────────────────────────────────── */

import type {
  Channel,
  ChannelWithStream,
  WorkerRequest,
  WorkerResponse,
} from "./iptvWorker.types";

/* ══════════════════════════════════════════════════
   Internal state — lives entirely inside the worker
   ══════════════════════════════════════════════════ */

/** All non-NSFW channels with their stream URL pre-joined */
let allChannels: ChannelWithStream[] = [];

/** channel.id → stream URL (for fallback processing) */
let streamUrlMap: Map<string, string> = new Map();

/**
 * Inverted country index.
 * Key   = uppercase ISO country code (e.g. "US", "GB", "UK")
 * Value = pre-sorted ChannelWithStream[] for that country
 *         (streams first, then alphabetical by name)
 */
let countryIndex: Map<string, ChannelWithStream[]> = new Map();

/** Pre-built list of news channels (sorted, streams first) */
let newsChannelsCache: ChannelWithStream[] = [];

/** Search alias map so "uk" also matches "gb" etc. */
const SEARCH_ALIASES: Record<string, string[]> = {
  uk: ["uk", "gb"],
  gb: ["uk", "gb"],
  "united kingdom": ["uk", "gb"],
  fr: ["fr"],
  fra: ["fr"],
  france: ["fr"],
};

/* ══════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════ */

/** Standard sort: streams first → alphabetical */
function sortChannels(arr: ChannelWithStream[]): ChannelWithStream[] {
  return arr.sort((a, b) => {
    if (a.streamUrl && !b.streamUrl) return -1;
    if (!a.streamUrl && b.streamUrl) return 1;
    return a.name.localeCompare(b.name);
  });
}

/* ══════════════════════════════════════════════════
   INIT — Build all indexes from raw JSON
   ══════════════════════════════════════════════════ */

function handleInit(rawChannels: any[], rawStreams: any[]): WorkerResponse {
  const t0 = performance.now();

  /* 1) Build stream URL lookup (channel id → URL, first stream wins) */
  streamUrlMap = new Map();
  for (const s of rawStreams) {
    if (!s.channel || streamUrlMap.has(s.channel)) continue;
    streamUrlMap.set(s.channel, s.url ?? "");
  }

  /* 2) Map raw channels → typed ChannelWithStream[], skip NSFW */
  allChannels = [];
  for (const c of rawChannels) {
    if (c.is_nsfw) continue;
    const id = c.id ?? "";
    allChannels.push({
      id,
      name: c.name ?? "Unknown",
      logo: c.logo || null,
      country: (c.country ?? "").toUpperCase(),
      categories: c.categories ?? [],
      languages: c.languages ?? [],
      website: c.website || null,
      isNsfw: false,
      streamUrl: streamUrlMap.get(id) ?? null,
    });
  }

  /* 3) Build inverted country index */
  countryIndex = new Map();
  for (const ch of allChannels) {
    if (!ch.country) continue;
    let arr = countryIndex.get(ch.country);
    if (!arr) {
      arr = [];
      countryIndex.set(ch.country, arr);
    }
    arr.push(ch);
  }
  /* Pre-sort each country bucket once */
  for (const [, arr] of countryIndex) {
    sortChannels(arr);
  }

  /* 4) Pre-build news channel cache */
  newsChannelsCache = [];
  for (const ch of allChannels) {
    const isNews =
      ch.categories.some((c) => c.toLowerCase().includes("news")) ||
      ch.name.toLowerCase().includes("news");
    if (isNews) newsChannelsCache.push(ch);
  }
  sortChannels(newsChannelsCache);

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(
    `[Worker] Indexed ${allChannels.length} channels, ${streamUrlMap.size} streams, ` +
    `${countryIndex.size} countries in ${elapsed}ms`
  );

  return {
    type: "INIT_COMPLETE",
    channelCount: allChannels.length,
    streamCount: streamUrlMap.size,
  };
}

/* ══════════════════════════════════════════════════
   FILTER_BY_COUNTRY — O(1) index lookup
   ══════════════════════════════════════════════════ */

function handleFilterByCountry(
  id: number,
  countryCodes: string[]
): WorkerResponse {
  const results: ChannelWithStream[] = [];
  for (const code of countryCodes) {
    const bucket = countryIndex.get(code);
    if (bucket) results.push(...bucket);
  }
  /* De-duplicate if multiple codes map to overlapping channels */
  const seen = new Set<string>();
  const unique = results.filter((ch) => {
    if (seen.has(ch.id)) return false;
    seen.add(ch.id);
    return true;
  });
  return { type: "FILTER_RESULT", id, channels: unique };
}

/* ══════════════════════════════════════════════════
   SEARCH — Linear scan but off-thread (UI stays 60fps)
   ══════════════════════════════════════════════════ */

function handleSearch(
  id: number,
  query: string,
  limit: number,
  categoryFilter: string | null
): WorkerResponse {
  const q = query.toLowerCase().trim();
  const cat = categoryFilter?.toLowerCase() ?? null;

  if (!q && !cat) return { type: "SEARCH_RESULT", id, channels: [] };

  const countryAliases = SEARCH_ALIASES[q] ?? null;
  const results: ChannelWithStream[] = [];

  for (const ch of allChannels) {
    /* Category filter */
    if (cat && !ch.categories.some((c) => c.toLowerCase() === cat)) continue;

    /* Text query */
    if (q) {
      const chCountry = ch.country.toLowerCase();
      const matches =
        ch.name.toLowerCase().includes(q) ||
        ch.categories.some((c) => c.toLowerCase().includes(q)) ||
        chCountry === q ||
        (countryAliases !== null && countryAliases.includes(chCountry));
      if (!matches) continue;
    }

    results.push(ch);
    if (results.length >= limit) break;
  }

  return { type: "SEARCH_RESULT", id, channels: sortChannels(results) };
}

/* ══════════════════════════════════════════════════
   FETCH_NEWS — Pre-indexed + playlist merge
   ══════════════════════════════════════════════════ */

function handleFetchNews(
  id: number,
  limit: number,
  extraPlaylistChannels: ChannelWithStream[]
): WorkerResponse {
  const results: ChannelWithStream[] = [];
  const seenIds = new Set<string>();

  /* 1) Include playlist channels that are YouTube-sourced or news */
  for (const ch of extraPlaylistChannels) {
    const isYouTube =
      ch.streamUrl &&
      (ch.streamUrl.includes("youtube.com") ||
        ch.streamUrl.includes("youtu.be") ||
        ch.streamUrl.includes("yt.be") ||
        ch.streamUrl.includes("googlevideo.com"));
    const isNews =
      ch.categories.some((c) => c.toLowerCase().includes("news")) ||
      ch.name.toLowerCase().includes("news");
    if (isYouTube || isNews) {
      results.push(ch);
      seenIds.add(ch.id);
    }
  }

  /* 2) Append from pre-built news cache */
  for (const ch of newsChannelsCache) {
    if (seenIds.has(ch.id)) continue;
    results.push(ch);
    seenIds.add(ch.id);
    if (results.length >= limit) break;
  }

  return { type: "NEWS_RESULT", id, channels: sortChannels(results) };
}

/* ══════════════════════════════════════════════════
   PROCESS_FALLBACK — Map raw country-endpoint JSON
   ══════════════════════════════════════════════════ */

function handleProcessFallback(id: number, rawChannels: any[]): WorkerResponse {
  const mapped: ChannelWithStream[] = rawChannels
    .filter((c: any) => !c.is_nsfw)
    .map((c: any) => ({
      id: c.id ?? "",
      name: c.name ?? "Unknown",
      logo: c.logo || null,
      country: (c.country ?? "").toUpperCase(),
      categories: c.categories ?? [],
      languages: c.languages ?? [],
      website: c.website || null,
      isNsfw: false,
      streamUrl: streamUrlMap.get(c.id ?? "") ?? null,
    }));

  return { type: "FALLBACK_RESULT", id, channels: sortChannels(mapped) };
}

/* ══════════════════════════════════════════════════
   Message dispatcher
   ══════════════════════════════════════════════════ */

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
        response = handleSearch(msg.id, msg.query, msg.limit, msg.categoryFilter);
        break;
      case "FETCH_NEWS":
        response = handleFetchNews(msg.id, msg.limit, msg.extraPlaylistChannels);
        break;
      case "PROCESS_FALLBACK":
        response = handleProcessFallback(msg.id, msg.rawChannels);
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
