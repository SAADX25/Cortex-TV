/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   channelUtils.ts â€“ Shared channel display helpers

   Single source of truth for utilities used across
   ChannelList, Player, and SearchModal to avoid drift.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** Map IPTV/country codes to the bundled classic_3_ico filenames. */
export const FLAG_CODE_MAP: Record<string, string> = {
  bq: "nl",
  cw: "curacao",
  gb: "uk",
  gf: "fr",
  gp: "fr",
  hm: "au",
  pm: "fr",
  re: "fr",
  sj: "no",
  sx: "sint_maarten",
  um: "us",
  vg: "uk",
  vi: "us",
  xk: "kosovo",
};

/**
 * Returns a bundled classic_3_ico flag URL for a given country code.
 */
export function flagUrl(iso: string, width: 20 | 40 | 80 = 40): string {
  void width;
  const code = iso.toLowerCase();
  return `icons/classic_3_ico/classic_3_ico/${FLAG_CODE_MAP[code] ?? code}.ico`;
}

/**
 * Regex to strip noisy geo-block / scheduling tags from channel names.
 * Removes: [Geo-blocked], [Blocked], [Geo blocked], [Not 24/7], etc.
 */
export const STRIP_TAGS_RE = /\[geo[- ]?blocked\]|\[blocked\]|\[not 24\/7\]/gi;

/**
 * Clean a raw channel name from iptv-org tags for display.
 */
export function cleanName(name: string): string {
  return name.replace(STRIP_TAGS_RE, "").replace(/\s{2,}/g, " ").trim();
}
export const SEARCH_NOISE_WORDS = new Set([
  "hd",
  "fhd",
  "sd",
  "uhd",
  "4k",
  "live",
  "tv",
  "channel",
]);

/**
 * Normalize free text for search and ranking.
 * Keeps words/numbers, removes symbols, folds whitespace, and lowercases.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Channel names often carry quality/source tags that make exact matching poor.
 * We strip only standalone noise words so names like "HDS" are preserved.
 */
export function normalizeChannelNameForSearch(value: string): string {
  return normalizeSearchText(cleanName(value))
    .split(" ")
    .filter((part) => part && !SEARCH_NOISE_WORDS.has(part))
    .join(" ");
}

/**
 * Returns true if the stream URL is from a YouTube-family domain.
 */
export function isYouTubeStream(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("yt.be") ||
    url.includes("googlevideo.com")
  );
}

/**
 * Countries known to heavily geo-block their public streams.
 */
export const GEO_BLOCK_COUNTRIES = new Set(["UK", "GB", "FR"]);
const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const languageNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "language" })
    : null;

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  UK: "United Kingdom",
  XK: "Kosovo",
};

export function countryName(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const code = iso.toUpperCase();
  if (COUNTRY_NAME_OVERRIDES[code]) return COUNTRY_NAME_OVERRIDES[code];
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function languageName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  try {
    return languageNames?.of(code.toLowerCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export type StreamHealth = "online" | "offline" | "unknown" | "geo-blocked";

export function getStreamHealth(
  streamUrl: string | null | undefined,
  streamStatus?: string | null,
  channelName?: string,
  country?: string,
): StreamHealth {
  const raw = `${streamStatus ?? ""} ${channelName ?? ""}`.toLowerCase();
  if (raw.includes("geo") || raw.includes("blocked")) return "geo-blocked";
  if (!streamUrl) return "offline";
  if (raw.includes("offline") || raw.includes("broken") || raw.includes("error")) return "offline";
  if (raw.includes("online") || raw.includes("working")) return "online";
  if (country && GEO_BLOCK_COUNTRIES.has(country.toUpperCase()) && raw.includes("restricted")) {
    return "geo-blocked";
  }
  return "unknown";
}

export function streamHealthLabel(health: StreamHealth): string {
  switch (health) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "geo-blocked":
      return "Geo-blocked";
    default:
      return "Unknown";
  }
}

export function isUsableStream(
  streamUrl: string | null | undefined,
  streamStatus?: string | null,
  channelName?: string,
  country?: string,
): boolean {
  const health = getStreamHealth(streamUrl, streamStatus, channelName, country);
  return !!streamUrl && health !== "offline" && health !== "geo-blocked";
}

export const CATEGORY_DEFS = [
  { key: "all", label: "All", aliases: [] },
  { key: "sports", label: "Sports", aliases: ["sport", "sports"] },
  { key: "movies", label: "Movies", aliases: ["movie", "movies", "cinema", "film"] },
  { key: "music", label: "Music", aliases: ["music", "radio"] },
  { key: "news", label: "News", aliases: ["news"] },
  { key: "entertainment", label: "Entertainment", aliases: ["entertainment", "general"] },
  { key: "kids", label: "Kids", aliases: ["kids", "children", "family"] },
] as const;

export function categoryDisplayName(value: string): string {
  if (!value) return "Uncategorized";
  const normalized = normalizeSearchText(value);
  const known = CATEGORY_DEFS.find((cat) =>
    cat.key === normalized || cat.aliases.some((alias) => normalized.includes(alias))
  );
  if (known) return known.label;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function matchesCategory(categories: string[], category: string | null): boolean {
  if (!category || category === "all") return true;
  const target = normalizeSearchText(category);
  const def = CATEGORY_DEFS.find((cat) => cat.key === target);
  const aliases = def ? [def.key, ...def.aliases] : [target];
  return categories.some((raw) => {
    const normalized = normalizeSearchText(raw);
    return aliases.some((alias) => normalized === alias || normalized.includes(alias));
  });
}
