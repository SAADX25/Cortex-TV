/* ──────────────────────────────────────────────────
   useIPTV.ts – Fetches and filters IPTV channels
   from the free iptv-org API by country ISO code.
   
   All heavy processing (indexing, filtering, sorting,
   searching) is offloaded to a Web Worker via the
   iptvWorkerClient adapter. The main thread only
   performs network fetches and trivial ISO expansion.
   ────────────────────────────────────────────────── */

import { useEffect, useState, useRef } from "react";
import {
  ensureWorkerData,
  filterByCountry,
  processFallbackChannels,
} from "../workers/iptvWorkerClient";

/* ── Re-export worker-delegated functions (preserves all consumer imports) ── */
export {
  searchAllChannels,
  fetchNewsChannels,
  preloadIPTVData,
} from "../workers/iptvWorkerClient";

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

/* ── Country-endpoint fallback (fetch on main thread, process in worker) ── */
function fetchCountryFallback(
  isoCode: string,
  token: number,
  abortRef: React.MutableRefObject<number>,
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

      /* Offload mapping + sorting to the worker */
      const mapped = await processFallbackChannels(raw);
      if (token !== abortRef.current) return;

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

    /* Expand ISO on main thread (trivial string lookup) */
    const countryCodes = expandIso(countryIso);

    /* Ensure data is fetched (main thread) and indexed (worker) */
    ensureWorkerData()
      .then(async () => {
        if (token !== abortRef.current) return; // stale

        /* O(1) lookup via the worker's inverted country index */
        const filtered = await filterByCountry(countryCodes);
        if (token !== abortRef.current) return; // stale

        /* ── Fallback: If 0 channels found, try the country-specific endpoint ── */
        if (filtered.length === 0) {
          const upper = countryIso.toUpperCase();
          const byName = NAME_TO_ISO[countryIso.toLowerCase()];
          const canonical =
            ISO_CANONICAL[upper] ??
            (byName ? ISO_CANONICAL[byName] ?? byName.toLowerCase() : null) ??
            countryIso.toLowerCase();
          fetchCountryFallback(canonical, token, abortRef, setChannels, setLoading);
          return;
        }

        setChannels(filtered);
        setLoading(false);
        console.log(
          `[IPTV] ${filtered.length} channels for [${countryCodes.join(",")}] (${filtered.filter((c) => c.streamUrl).length} with streams)`
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
