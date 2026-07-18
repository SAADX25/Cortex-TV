/* ──────────────────────────────────────────────────
   StreamResolver.ts – Educational mock stream resolver
   Demonstrates how token-based DRM resolution works
   for IPTV streams. Intercepts URLs that require
   authentication / temporary tokens and resolves them
   into playable .m3u8 links.
   ────────────────────────────────────────────────── */

/** Domains / schemes that signal the URL needs resolving */
const RESOLVE_SCHEME = "resolve://";
const RESOLVE_DOMAINS = [
  "secure-stream.example.com",
  "drm-gateway.example.com",
  "token-required.example.com",
];

/**
 * Simulate an API call that returns a short-lived playback token.
 * In production this would hit a real auth endpoint.
 */
async function fetchPlaybackToken(host: string): Promise<string> {
  /* Simulate network latency (400 – 900 ms) */
  const latency = 400 + Math.random() * 500;
  await new Promise((r) => setTimeout(r, latency));

  /* Generate a mock JWT-like token */
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1-hour TTL

  return `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(
    JSON.stringify({ host, exp: expiry })
  )}.${randomPart}`;
}

/**
 * Checks whether the given URL requires token resolution.
 */
function needsResolving(url: string): boolean {
  if (url.startsWith(RESOLVE_SCHEME)) return true;
  try {
    const { hostname } = new URL(url);
    return RESOLVE_DOMAINS.some((d) => hostname.endsWith(d));
  } catch {
    return false;
  }
}

/**
 * Resolve a stream URL.
 *
 * - If the URL uses the `resolve://` scheme or points to a known
 *   token-gated domain, the resolver fetches a temporary playback
 *   token and returns a fully-qualified `.m3u8` URL.
 * - Otherwise the original URL is returned untouched.
 *
 * @param originalUrl – The raw stream URL from the channel data.
 * @returns A playable stream URL (possibly with an appended token).
 */
export const resolveStream = async (
  originalUrl: string
): Promise<string> => {
  if (!needsResolving(originalUrl)) {
    return originalUrl;
  }

  console.log("[StreamResolver] URL requires token resolution:", originalUrl);

  /* Strip the custom scheme if present and normalise to https */
  let targetUrl = originalUrl;
  if (targetUrl.startsWith(RESOLVE_SCHEME)) {
    targetUrl = "https://" + targetUrl.slice(RESOLVE_SCHEME.length);
  }

  let host: string;
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    host = "unknown";
  }

  /* Fetch a time-limited token from the (mock) auth API */
  const token = await fetchPlaybackToken(host);

  /* Append the token as a query parameter */
  const separator = targetUrl.includes("?") ? "&" : "?";
  const resolvedUrl = `${targetUrl}${separator}token=${token}`;

  console.log("[StreamResolver] Resolved →", resolvedUrl);
  return resolvedUrl;
};
