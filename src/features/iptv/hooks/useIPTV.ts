import { useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  ensureWorkerData,
  filterByCountry,
  processFallbackChannels,
} from "@/features/iptv/workers/iptvWorkerClient";
import type { ChannelWithStream } from "@/features/iptv/types";

export {
  fetchNewsChannels,
  getBrowseMetadata,
  getHomeData,
  getIPTVDataStatus,
  preloadIPTVData,
  searchAllChannels,
  subscribeIPTVDataStatus,
} from "@/features/iptv/workers/iptvWorkerClient";

export type {
  BrowseMetadata,
  Channel,
  ChannelWithStream,
  HomeData,
  MetadataOption,
  SearchFilters,
} from "@/features/iptv/types";
export type { IPTVDataStatus } from "@/features/iptv/workers/iptvWorkerClient";

const ISO_ALIASES: Record<string, string[]> = {
  GB: ["GB", "UK"],
  UK: ["GB", "UK"],
  GBR: ["GB", "UK"],
  FRA: ["FR"],
  FR: ["FR"],
  NOR: ["NO"],
  NO: ["NO"],
};

const ISO_CANONICAL: Record<string, string> = {
  FRA: "fr",
  FR: "fr",
  GB: "gb",
  UK: "gb",
  GBR: "gb",
  NOR: "no",
  NO: "no",
};

const NAME_TO_ISO: Record<string, string> = {
  france: "FR",
  "united kingdom": "GB",
  norway: "NO",
  "northern cyprus": "CY",
  somaliland: "SO",
  kosovo: "XK",
};

function expandIso(iso: string): string[] {
  const key = iso.toUpperCase().trim();
  if (!key || key === "-99") return [];
  if (ISO_ALIASES[key]) return ISO_ALIASES[key];
  const byName = NAME_TO_ISO[iso.toLowerCase()];
  if (byName) return ISO_ALIASES[byName] ?? [byName];
  return [key];
}

interface UseIPTVReturn {
  channels: ChannelWithStream[];
  loading: boolean;
  error: string | null;
}

function fetchCountryFallback(
  isoCode: string,
  token: number,
  abortRef: MutableRefObject<number>,
  setChannels: Dispatch<SetStateAction<ChannelWithStream[]>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
) {
  const code = isoCode.toLowerCase();
  const url = `https://iptv-org.github.io/api/countries/${code}.json`;
  console.log(`[IPTV] Trying country endpoint fallback: ${url}`);

  fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Country endpoint ${code}: HTTP ${res.status}`);
      const raw: any[] = await res.json();
      if (token !== abortRef.current) return;

      const mapped = await processFallbackChannels(raw);
      if (token !== abortRef.current) return;

      setChannels(mapped);
      setLoading(false);
      console.log(
        `[IPTV] Fallback (${code}): ${mapped.length} channels (${mapped.filter((c) => c.streamUrl).length} with streams)`,
      );
    })
    .catch((err) => {
      if (token !== abortRef.current) return;
      console.error(`[IPTV] Fallback (${code}) failed:`, err);
      setChannels([]);
      setLoading(false);
    });
}

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

    const countryCodes = expandIso(countryIso);

    ensureWorkerData()
      .then(async () => {
        if (token !== abortRef.current) return;

        const filtered = await filterByCountry(countryCodes);
        if (token !== abortRef.current) return;

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
          `[IPTV] ${filtered.length} channels for [${countryCodes.join(",")}] (${filtered.filter((c) => c.streamUrl).length} with streams)`,
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