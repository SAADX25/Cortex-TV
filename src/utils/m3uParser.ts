/* ──────────────────────────────────────────────────
   m3uParser.ts – Fetch & parse M3U / M3U8 playlists
   Extracts channel name, logo, group, and stream URL
   from #EXTINF + URL line pairs.
   ────────────────────────────────────────────────── */

import type { ChannelWithStream } from "../hooks/useIPTV";

/** Group-title keywords that signal adult/NSFW content */
const NSFW_KEYWORDS = [
  "adult", "xxx", "18+", "erotic", "porn", "sex", "mature",
  "x-rated", "adults only",
];

function isNsfwGroup(group: string): boolean {
  const g = group.toLowerCase();
  return NSFW_KEYWORDS.some((kw) => g.includes(kw));
}

/**
 * Fetch an M3U playlist from a URL and parse it into
 * ChannelWithStream[] compatible with the rest of the app.
 */
export async function fetchAndParseM3U(
  url: string
): Promise<ChannelWithStream[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`M3U fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  return parseM3U(text);
}

/**
 * Parse raw M3U text into ChannelWithStream[].
 *
 * Supported tag attributes (case-insensitive):
 *   tvg-logo="…"   → logo
 *   tvg-country="…" → country (ISO)
 *   group-title="…" → categories[0]
 *   tvg-name="…"   → name (fallback: display title after comma)
 */
export function parseM3U(text: string): ChannelWithStream[] {
  const lines = text.split(/\r?\n/);
  const channels: ChannelWithStream[] = [];
  let idx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF")) continue;

    /* Find the next non-empty, non-comment line → that's the stream URL */
    let streamUrl: string | null = null;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next || next.startsWith("#")) continue;
      streamUrl = next;
      break;
    }
    if (!streamUrl) continue;

    /* Extract attributes from the #EXTINF line */
    const logo = extractAttr(line, "tvg-logo");
    const country = extractAttr(line, "tvg-country") ?? "";
    const group = extractAttr(line, "group-title") ?? "";
    const tvgName = extractAttr(line, "tvg-name");

    /* Channel display name: text after the last comma on the EXTINF line */
    const commaIdx = line.lastIndexOf(",");
    const displayName =
      commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : "";
    const name = tvgName || displayName || `Channel ${++idx}`;
    const isNsfw = isNsfwGroup(group);

    /* Skip NSFW channels to keep the app family-friendly */
    if (isNsfw) continue;

    channels.push({
      id: `m3u_${idx++}_${hashCode(streamUrl)}`,
      name,
      logo: logo || null,
      country: country.toUpperCase(),
      categories: group ? [group] : [],
      languages: [],
      website: null,
      isNsfw: false,
      streamUrl,
    });
  }

  return channels;
}

/* ── Helpers ── */

/** Extract a tag attribute value: tvg-logo="value" */
function extractAttr(line: string, attr: string): string | null {
  const re = new RegExp(`${attr}="([^"]*)"`, "i");
  const m = line.match(re);
  return m ? m[1] : null;
}

/** Simple string hash for generating unique IDs */
function hashCode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
