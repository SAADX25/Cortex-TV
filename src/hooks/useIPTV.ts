/* ──────────────────────────────────────────────────
   useIPTV.ts – Fetches and filters IPTV channels
   from the free iptv-org API by country ISO code.
   ────────────────────────────────────────────────── */

import { useEffect, useState, useRef } from "react";

const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const STREAMS_URL = "https://iptv-org.github.io/api/streams.json";

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

    const iso = countryIso.toUpperCase();

    ensureData()
      .then(() => {
        if (token !== abortRef.current) return; // stale

        const filtered = (channelCache ?? [])
          .filter((ch) => ch.country === iso && !ch.isNsfw)
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

        setChannels(filtered);
        setLoading(false);
        console.log(
          `[IPTV] ${filtered.length} channels for "${iso}" (${filtered.filter((c) => c.streamUrl).length} with streams)`
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
