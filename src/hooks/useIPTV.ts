/* ──────────────────────────────────────────────────
   useIPTV.ts – Fetches and filters IPTV channels
   from the free iptv-org API by country ISO code.
   ────────────────────────────────────────────────── */

import { useEffect, useState, useRef } from "react";

const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const STREAMS_URL = "https://iptv-org.github.io/api/streams.json";

/* ── ISO alias map for countries whose GeoJSON code differs from iptv-org ── */
const ISO_ALIASES: Record<string, string[]> = {
  GB: ["GB", "UK"],   // GeoJSON uses GB, iptv-org uses UK
  UK: ["GB", "UK"],
  GBR: ["GB", "UK"],  // ISO_A3 fallback
  FRA: ["FR"],         // Natural Earth ISO_A3 → iptv-org ISO_A2
  FR: ["FR"],
  NOR: ["NO"],         // Norway ISO_A3 → NO
  NO: ["NO"],
};

/**
 * Canonical ISO-A2 code used for the iptv-org country endpoint.
 * e.g. "FRA" → "fr", "GB" → "gb"
 */
const ISO_CANONICAL: Record<string, string> = {
  FRA: "fr",
  FR: "fr",
  GB: "gb",
  UK: "gb",
  GBR: "gb",
  NOR: "no",
  NO: "no",
};

/**
 * Last-resort: map country NAME to iptv-org ISO-A2 when the code
 * coming from GeoJSON is garbage ("-99", empty, etc.).
 */
const NAME_TO_ISO: Record<string, string> = {
  france: "FR",
  "united kingdom": "GB",
  norway: "NO",
  "northern cyprus": "CY",
  "somaliland": "SO",
  kosovo: "XK",
};

/** Expand a single ISO code (or country name) into all aliases (uppercase). */
function expandIso(iso: string): string[] {
  const key = iso.toUpperCase().trim();
  /* Reject garbage codes that leak from Natural Earth GeoJSON */
  if (!key || key === "-99") return [];
  if (ISO_ALIASES[key]) return ISO_ALIASES[key];
  /* Try name-based lookup when the code is unknown */
  const byName = NAME_TO_ISO[iso.toLowerCase()];
  if (byName) return ISO_ALIASES[byName] ?? [byName];
  return [key];
}

/* ── Public types ── */
export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  country: string;        // ISO 3166-1 alpha-2 (e.g. "US")
  categories: string[];
  languages: string[];
  website: string | null;
  isNsfw: boolean;
}

export interface Stream {
  channel: string;        // matches Channel.id
  url: string;            // .m3u8 or direct stream URL
  status: string;
}

export interface ChannelWithStream extends Channel {
  streamUrl: string | null;
}

interface UseIPTVReturn {
  channels: ChannelWithStream[];
  loading: boolean;
  error: string | null;
}

/* ── Singleton cache so we only fetch the big JSON files once ── */
let channelCache: Channel[] | null = null;
let streamCache: Map<string, Stream> | null = null;
let fetchPromise: Promise<void> | null = null;

async function ensureData(): Promise<void> {
  if (channelCache && streamCache) return;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    console.log("[IPTV] Fetching channels + streams from iptv-org API…");

    const [chRes, stRes] = await Promise.all([
      fetch(CHANNELS_URL),
      fetch(STREAMS_URL),
    ]);

    if (!chRes.ok) throw new Error(`Channels API: HTTP ${chRes.status}`);
    if (!stRes.ok) throw new Error(`Streams API: HTTP ${stRes.status}`);

    const rawChannels: any[] = await chRes.json();
    const rawStreams: any[] = await stRes.json();

    /* Map channels */
    channelCache = rawChannels.map((c) => ({
      id: c.id ?? "",
      name: c.name ?? "Unknown",
      logo: c.logo || null,
      country: (c.country ?? "").toUpperCase(),
      categories: c.categories ?? [],
      languages: c.languages ?? [],
      website: c.website || null,
      isNsfw: c.is_nsfw ?? false,
    }));

    /* Map streams – keep only the first working stream per channel */
    streamCache = new Map();
    for (const s of rawStreams) {
      if (!s.channel || streamCache.has(s.channel)) continue;
      streamCache.set(s.channel, {
        channel: s.channel,
        url: s.url ?? "",
        status: s.status ?? "unknown",
      });
    }

    console.log(
      `[IPTV] Cached ${channelCache.length} channels, ${streamCache.size} streams`
    );
  })();

  return fetchPromise;
}

/* ── Global search (used by SearchModal) ── */

/** Normalised search terms so "uk" also matches country code "GB" etc. */
const SEARCH_ALIASES: Record<string, string[]> = {
  uk: ["uk", "gb"],
  gb: ["uk", "gb"],
  "united kingdom": ["uk", "gb"],
  fr: ["fr"],
  fra: ["fr"],
  france: ["fr"],
};

export async function searchAllChannels(
  query: string,
  limit = 80,
  categoryFilter?: string | null
): Promise<ChannelWithStream[]> {
  await ensureData();
  if (!channelCache || !streamCache) return [];
  const q = query.toLowerCase().trim();
  const cat = categoryFilter?.toLowerCase() ?? null;

  /* If no query AND no category filter, return nothing */
  if (!q && !cat) return [];

  /* Expand query for country-code aliases ("uk" → ["uk","gb"]) */
  const countryAliases = SEARCH_ALIASES[q] ?? null;

  const results: ChannelWithStream[] = [];
  for (const ch of channelCache) {
    if (ch.isNsfw) continue;

    /* Category filter (when active) */
    if (cat && !ch.categories.some((c) => c.toLowerCase() === cat)) continue;

    /* Text query (when provided) */
    if (q) {
      const chCountry = ch.country.toLowerCase();
      const matches =
        ch.name.toLowerCase().includes(q) ||
        ch.categories.some((c) => c.toLowerCase().includes(q)) ||
        chCountry === q ||
        (countryAliases !== null && countryAliases.includes(chCountry));
      if (!matches) continue;
    }

    results.push({
      ...ch,
      streamUrl: streamCache.get(ch.id)?.url ?? null,
    });
    if (results.length >= limit) break;
  }
  /* Channels with streams first */
  return results.sort((a, b) => {
    if (a.streamUrl && !b.streamUrl) return -1;
    if (!a.streamUrl && b.streamUrl) return 1;
    return a.name.localeCompare(b.name);
  });
}

/* ── Preload data (called on app startup) ── */
export function preloadIPTVData(): void {
  ensureData().catch(() => {});
}

/* ── Quick Access News: fetch all channels with NEWS category/name ── */
export async function fetchNewsChannels(
  limit = 300,
  extraPlaylistChannels?: ChannelWithStream[]
): Promise<ChannelWithStream[]> {
  await ensureData();
  if (!channelCache || !streamCache) return extraPlaylistChannels ?? [];

  const results: ChannelWithStream[] = [];
  const seenIds = new Set<string>();

  /* 1) Include playlist channels that are YouTube-sourced or have NEWS in category/name */
  if (extraPlaylistChannels) {
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
  }

  /* 2) IPTV-org channels with NEWS category or name */
  for (const ch of channelCache) {
    if (ch.isNsfw) continue;
    if (seenIds.has(ch.id)) continue;

    const isNews =
      ch.categories.some((c) => c.toLowerCase().includes("news")) ||
      ch.name.toLowerCase().includes("news");
    if (!isNews) continue;

    results.push({
      ...ch,
      streamUrl: streamCache.get(ch.id)?.url ?? null,
    });
    seenIds.add(ch.id);
    if (results.length >= limit) break;
  }

  /* Channels with streams first, then alphabetical */
  return results.sort((a, b) => {
    if (a.streamUrl && !b.streamUrl) return -1;
    if (!a.streamUrl && b.streamUrl) return 1;
    return a.name.localeCompare(b.name);
  });
}

/* ── Country-endpoint fallback (works for any country) ── */
function fetchCountryFallback(
  isoCode: string,
  token: number,
  abortRef: React.MutableRefObject<number>,
  streams: Map<string, Stream> | null,
  setChannels: React.Dispatch<React.SetStateAction<ChannelWithStream[]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
  const code = isoCode.toLowerCase();
  const url = `https://iptv-org.github.io/api/countries/${code}.json`;
  console.log(`[IPTV] Trying country endpoint fallback: ${url}`);

  fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Country endpoint ${code}: HTTP ${res.status}`);
      const raw: any[] = await res.json();
      if (token !== abortRef.current) return;

      const mapped: ChannelWithStream[] = raw
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
          streamUrl: streams?.get(c.id ?? "")?.url ?? null,
        }))
        .sort((a: ChannelWithStream, b: ChannelWithStream) => {
          if (a.streamUrl && !b.streamUrl) return -1;
          if (!a.streamUrl && b.streamUrl) return 1;
          return a.name.localeCompare(b.name);
        });

      setChannels(mapped);
      setLoading(false);
      console.log(
        `[IPTV] Fallback (${code}): ${mapped.length} channels (${mapped.filter((c) => c.streamUrl).length} with streams)`
      );
    })
    .catch((err) => {
      if (token !== abortRef.current) return;
      console.error(`[IPTV] Fallback (${code}) failed:`, err);
      setChannels([]);
      setLoading(false);
    });
}

/* ── Hook ── */
export function useIPTV(countryIso: string | null): UseIPTVReturn {
  const [channels, setChannels] = useState<ChannelWithStream[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!countryIso) {
      setChannels([]);
      setError(null);
      return;
    }

    const token = ++abortRef.current;
    setLoading(true);
    setError(null);

    const isoSet = new Set(expandIso(countryIso));

    ensureData()
      .then(() => {
        if (token !== abortRef.current) return; // stale

        const filtered = (channelCache ?? [])
          .filter((ch) => isoSet.has(ch.country) && !ch.isNsfw)
          .map<ChannelWithStream>((ch) => ({
            ...ch,
            streamUrl: streamCache?.get(ch.id)?.url ?? null,
          }))
          /* Channels with a stream bubble to the top */
          .sort((a, b) => {
            if (a.streamUrl && !b.streamUrl) return -1;
            if (!a.streamUrl && b.streamUrl) return 1;
            return a.name.localeCompare(b.name);
          });

        /* ── Fallback: If 0 channels found, try the country-specific endpoint ── */
        if (filtered.length === 0) {
          const upper = countryIso.toUpperCase();
          const byName = NAME_TO_ISO[countryIso.toLowerCase()];
          const canonical =
            ISO_CANONICAL[upper] ??
            (byName ? ISO_CANONICAL[byName] ?? byName.toLowerCase() : null) ??
            countryIso.toLowerCase();
          fetchCountryFallback(canonical, token, abortRef, streamCache, setChannels, setLoading);
          return;
        }

        setChannels(filtered);
        setLoading(false);
        console.log(
          `[IPTV] ${filtered.length} channels for [${[...isoSet].join(",")}] (${filtered.filter((c) => c.streamUrl).length} with streams)`
        );
      })
      .catch((err) => {
        if (token !== abortRef.current) return;
        console.error("[IPTV] Fetch error:", err);
        setError(err.message ?? "Failed to load channels");
        setLoading(false);
      });
  }, [countryIso]);

  return { channels, loading, error };
}
