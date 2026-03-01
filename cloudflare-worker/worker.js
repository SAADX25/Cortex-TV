/* ──────────────────────────────────────────────────────────────
   Cortex TV – CORS & Header-Spoofing Proxy  (Cloudflare Worker)
   ──────────────────────────────────────────────────────────────
   Accepts:  GET  https://<worker>.workers.dev/?url=<encoded-target-url>
   Returns:  The upstream response with CORS headers added and
             Origin / Referer / User-Agent spoofed to match the
             target CDN's expectations.

   Deploy:   See DEPLOY instructions in the project README.
   Free tier: 100 000 requests / day  —  plenty for personal use.
   ────────────────────────────────────────────────────────────── */

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/*
 * Per-domain header overrides.
 * Key = hostname substring to match.  Value = { Origin, Referer }.
 * Add more CDN domains here as you discover them.
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

/** Look up spoofed Origin/Referer for a given hostname. */
function headersFor(hostname) {
  for (const [fragment, hdrs] of Object.entries(HEADER_MAP)) {
    if (hostname.includes(fragment)) return hdrs;
  }
  // Fallback: use the target's own origin as Referer (works for most CDNs)
  const origin = `https://${hostname}`;
  return { Origin: origin, Referer: origin + '/' };
}

export default {
  async fetch(request) {
    /* ── Handle CORS preflight ── */
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    /* ── Extract target URL ── */
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing ?url= parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid target URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
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
        method: 'GET',
        headers: upstreamHeaders,
        redirect: 'follow',
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    /* ── Stream the response back with CORS headers ── */
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.delete('X-Frame-Options');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
