/**
 * Cortex TV — Streaming HLS & Media CORS Proxy (Cloudflare Worker)
 *
 * Bridges HTTPS web deployments (e.g. GitHub Pages) to IPTV streams that:
 * 1. Serve over plain HTTP (preventing browser Mixed Content blocks),
 * 2. Omit `Access-Control-Allow-Origin` headers (CORS), or
 * 3. Require specific `Origin` / `Referer` headers (e.g. Rotana / MBC CDNs).
 */

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CDN_HEADER_RULES = [
  {
    match: "hibridcdn.net",
    origin: "https://rotana.net",
    referer: "https://rotana.net/",
  },
  {
    match: "dbrsp.net",
    origin: "https://shahid.mbc.net",
    referer: "https://shahid.mbc.net/",
  },
  {
    match: "cloudfront.net",
    origin: "https://shahid.mbc.net",
    referer: "https://shahid.mbc.net/",
  },
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin, Referer",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

function withCorsHeaders(extra = {}) {
  return { ...CORS_HEADERS, ...extra };
}

function isBlockedHost(rawHostname) {
  const host = rawHostname.toLowerCase().replace(/\.+$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }

  // Block bare IPv6 loopback / unique-local / link-local / IPv4-mapped forms.
  const bareV6 = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (bareV6.includes(":")) {
    const normalized = bareV6.toLowerCase();
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("::ffff:")
    ) {
      return true;
    }
    return false;
  }

  // Block private / loopback / link-local IPv4 ranges and non-decimal shorthand IPs.
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return true;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [, a, b] = ipv4Match.map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function buildUpstreamHeaders(targetUrl, request) {
  const headers = new Headers();
  headers.set("User-Agent", CHROME_UA);
  headers.set("Accept", request.headers.get("Accept") || "*/*");

  const range = request.headers.get("Range");
  if (range) {
    headers.set("Range", range);
  }

  const host = targetUrl.hostname.toLowerCase();
  const matchedRule = CDN_HEADER_RULES.find((rule) => host.includes(rule.match));
  if (matchedRule) {
    headers.set("Origin", matchedRule.origin);
    headers.set("Referer", matchedRule.referer);
  }

  return headers;
}

function isHlsPlaylist(contentType, finalUrl) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("mpegurl") || ct.includes("vnd.apple.mpegurl")) {
    return true;
  }
  try {
    return new URL(finalUrl).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return /\.m3u8(\?|#|$)/i.test(finalUrl);
  }
}

function rewritePlaylist(text, baseUrl, workerPrefix) {
  const wrapUri = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith(workerPrefix)) return trimmed;
    try {
      const resolved = new URL(trimmed, baseUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
        return trimmed;
      }
      return `${workerPrefix}${encodeURIComponent(resolved.toString())}`;
    } catch {
      return trimmed;
    }
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${wrapUri(uri)}"`);
      }
      return wrapUri(trimmed);
    })
    .join("\n");
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCorsHeaders() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: withCorsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      });
    }

    const reqUrl = new URL(request.url);
    const rawTarget = reqUrl.searchParams.get("url");
    if (!rawTarget) {
      return new Response("Missing ?url= query parameter", {
        status: 400,
        headers: withCorsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      });
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawTarget);
    } catch {
      return new Response("Invalid target URL", {
        status: 400,
        headers: withCorsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      });
    }

    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      return new Response("Only http and https URLs are supported", {
        status: 400,
        headers: withCorsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      });
    }

    if (isBlockedHost(targetUrl.hostname)) {
      return new Response("Blocked target host", {
        status: 403,
        headers: withCorsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      });
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: buildUpstreamHeaders(targetUrl, request),
        redirect: "follow",
      });

      const finalUrl = upstream.url || targetUrl.toString();
      const contentType = upstream.headers.get("Content-Type") || "";

      if (request.method === "GET" && upstream.ok && isHlsPlaylist(contentType, finalUrl)) {
        const playlistText = await upstream.text();
        if (playlistText.trimStart().startsWith("#EXTM3U")) {
          const cleanPath = reqUrl.pathname.replace(/\/+$/, "");
          const workerPrefix = `${reqUrl.origin}${cleanPath}/?url=`;
          const rewritten = rewritePlaylist(playlistText, finalUrl, workerPrefix);
          return new Response(rewritten, {
            status: upstream.status,
            headers: withCorsHeaders({
              "Content-Type": contentType || "application/vnd.apple.mpegurl; charset=utf-8",
              "Cache-Control": "no-store",
            }),
          });
        }

        return new Response(playlistText, {
          status: upstream.status,
          headers: withCorsHeaders({
            "Content-Type": contentType || "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          }),
        });
      }

      const passthroughHeaders = new Headers(withCorsHeaders());
      for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Cache-Control"]) {
        const val = upstream.headers.get(name);
        if (val) passthroughHeaders.set(name, val);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: passthroughHeaders,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upstream fetch failed";
      return new Response(`Proxy error: ${message}`, {
        status: 502,
        headers: withCorsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      });
    }
  },
};
