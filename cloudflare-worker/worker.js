/* ──────────────────────────────────────────────────────────────────────
   Cortex TV – M3U8 Manifest CORS Proxy  (Cloudflare Worker)
   ──────────────────────────────────────────────────────────────────────
   Accepts:  GET  https://<worker>.workers.dev/?url=<encoded-m3u8-url>

   Strategy (bandwidth-safe):
     • ONLY proxies .m3u8 manifest files — never .ts / .mp4 / .m4s chunks.
     • Rewrites every segment URI inside the manifest to an absolute URL
       pointing directly at the origin CDN, so hls.js fetches video data
       without touching Cloudflare at all.
     • Rewrites sub-playlist (.m3u8) URIs to loop back through this Worker
       so each level of the HLS hierarchy also gets CORS headers.
     • Rewrites EXT-X-KEY / EXT-X-MAP URIs through the Worker (tiny — just
       AES-128 key files and initialisation segments).
     • Returns 403 for any .ts / .mp4 / .m4s / .aac request so bandwidth
       abuse is impossible even if a client mis-calls the endpoint.

   Free tier: 100 000 req/day — manifests are fetched once per quality
   level, so personal use stays well within limits.
   Deploy:   wrangler deploy   (see wrangler.toml)
   ────────────────────────────────────────────────────────────────────── */

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/*
 * Per-domain header overrides – spoofs Origin/Referer so CDNs that
 * refuse requests from unknown origins return 200 instead of 403.
 * Key = hostname substring to match.  Value = { Origin, Referer }.
 */
const HEADER_MAP = {
  'hibridcdn.net': {
    Origin:  'https://rotana.net',
    Referer: 'https://rotana.net/',
  },
  'dbrsp.net': {
    Origin:  'https://shahid.mbc.net',
    Referer: 'https://shahid.mbc.net/',
  },
  /* MBC / Shahid streams served via CloudFront */
  'cloudfront.net': {
    Origin:  'https://shahid.mbc.net',
    Referer: 'https://shahid.mbc.net/',
  },
};

/*
 * Video segment extensions that must NEVER be proxied through Cloudflare.
 * Proxying these would transfer gigabytes of video data and trigger a
 * Terms-of-Service violation on the free tier.
 */
const SEGMENT_PATTERN = /\.(ts|aac|mp4|m4s|fmp4|cmfv|cmfa|vtt|webvtt)(\?.*)?$/i;
const MANIFEST_PATTERN = /\.m3u8(\?.*)?$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/** Look up spoofed Origin/Referer for a given CDN hostname. */
function headersFor(hostname) {
  for (const [fragment, hdrs] of Object.entries(HEADER_MAP)) {
    if (hostname.includes(fragment)) return hdrs;
  }
  const origin = `https://${hostname}`;
  return { Origin: origin, Referer: origin + '/' };
}

/**
 * Derive the base URL of a manifest so relative paths can be resolved.
 * e.g. "https://cdn.example.com/live/hls/stream.m3u8"
 *   →  "https://cdn.example.com/live/hls/"
 */
function getBaseUrl(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/');
  parts[parts.length - 1] = '';          // remove filename, keep trailing /
  u.pathname = parts.join('/');
  u.search = '';
  u.hash   = '';
  return u.toString();
}

/** Resolve a potentially-relative URI against the manifest's base URL. */
function toAbsolute(uri, baseUrl) {
  if (/^https?:\/\//i.test(uri)) return uri;    // already absolute
  if (uri.startsWith('//'))  return 'https:' + uri;
  if (uri.startsWith('/')) {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${uri}`;
  }
  return baseUrl + uri;                          // relative path
}

/**
 * Rewrite an HLS manifest so that:
 *   - .m3u8 sub-playlist lines  → proxied through this Worker (CORS + rewriting)
 *   - .ts / segment lines       → absolute origin URL (fetched directly by hls.js)
 *   - URI= attributes in tags   → AES keys / init maps go through proxy (tiny files)
 *
 * @param {string} text        Raw manifest text from the CDN
 * @param {string} targetUrl   Canonical URL the manifest was fetched from
 * @param {string} workerBase  e.g. "https://cortextv-proxy.workers.dev"
 */
function rewriteManifest(text, targetUrl, workerBase) {
  const baseUrl = getBaseUrl(targetUrl);

  return text.split('\n').map((rawLine) => {
    const line = rawLine.trimEnd();

    if (line === '') return line;

    // Tags that embed URI= values (encryption keys, byte-range maps, alternate media)
    if (line.startsWith('#') && line.includes('URI=')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const abs = toAbsolute(uri, baseUrl);
        // Key files are tiny, they need CORS — route through Worker
        return `URI="${workerBase}/?url=${encodeURIComponent(abs)}"`;
      });
    }

    // Plain comment / tag lines with no URI → pass through unchanged
    if (line.startsWith('#')) return line;

    // URI line (segment or sub-playlist)
    const abs = toAbsolute(line, baseUrl);
    const pathOnly = abs.split('?')[0];

    if (MANIFEST_PATTERN.test(pathOnly)) {
      // Sub-playlist: loop back through Worker so it receives CORS + rewriting
      return `${workerBase}/?url=${encodeURIComponent(abs)}`;
    }

    // Video segment: return the absolute CDN URL so hls.js fetches it DIRECTLY.
    // This is the critical bandwidth-saving step — Cloudflare never sees the video data.
    return abs;
  }).join('\n');
}

export default {
  async fetch(request) {
    /* ── Handle CORS preflight ── */
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
      });
    }

    const workerUrl  = new URL(request.url);
    const workerBase = `${workerUrl.protocol}//${workerUrl.host}`;
    const targetUrl  = workerUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing ?url= parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid target URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    /* ── Hard block: refuse to proxy video segments ── */
    if (SEGMENT_PATTERN.test(parsed.pathname)) {
      return new Response(
        JSON.stringify({
          error:  'Segment proxying is disabled.',
          reason: 'Only .m3u8 manifest files may be proxied. Video chunks are fetched directly from the origin CDN by the player.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    /* ── Build spoofed request headers ── */
    const spoofed = headersFor(parsed.hostname);
    const upstreamHeaders = new Headers({
      'User-Agent': DESKTOP_UA,
      'Origin':     spoofed.Origin,
      'Referer':    spoofed.Referer,
      'Accept':     '*/*',
    });

    /* ── Fetch from upstream CDN ── */
    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        method:   'GET',
        headers:  upstreamHeaders,
        redirect: 'follow',
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    if (!upstream.ok) {
      // Return upstream error status with CORS headers so the browser can read it
      const responseHeaders = new Headers(upstream.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));
      return new Response(upstream.body, {
        status:     upstream.status,
        statusText: upstream.statusText,
        headers:    responseHeaders,
      });
    }

    /* ── Determine if this is a manifest or a passthrough resource (e.g. AES key) ── */
    const contentType = upstream.headers.get('Content-Type') || '';
    const pathOnly    = parsed.pathname.split('?')[0];
    const isManifest  = MANIFEST_PATTERN.test(pathOnly)
                     || contentType.includes('mpegurl')
                     || contentType.includes('x-mpegURL');

    if (!isManifest) {
      // Passthrough (AES-128 key, init segment, etc.) — add CORS headers and stream back
      const responseHeaders = new Headers(upstream.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));
      responseHeaders.delete('X-Frame-Options');
      return new Response(upstream.body, {
        status:     upstream.status,
        statusText: upstream.statusText,
        headers:    responseHeaders,
      });
    }

    /* ── Manifest path: rewrite URIs and return ── */
    const text      = await upstream.text();
    const rewritten = rewriteManifest(text, targetUrl, workerBase);

    return new Response(rewritten, {
      status:  200,
      headers: {
        'Content-Type':  'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',    // manifests are live — do not cache
        ...CORS_HEADERS,
      },
    });
  },
};
