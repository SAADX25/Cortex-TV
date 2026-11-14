import Hls from "hls.js";
import type { HlsConfig, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";
import { isElectronPlatform, isNativePlatform } from "@/shared/lib/platformAdapter";

export const IS_ELECTRON = isElectronPlatform();
export const IS_NATIVE = isNativePlatform();

export const PROXY_ENDPOINTS = [
  "https://cortextv-proxy.cortextv-sr.workers.dev/?url=",
  "https://cortex-proxy-2.cortextv-sr.workers.dev/?url=",
];

const ENV_PROXY = typeof import.meta !== "undefined"
  ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CORS_PROXY_URL
  : undefined;

const failedUntil = new Map<string, number>();
const corsFallbackHosts = new Set<string>();
const RULES = [
  { host: "rotana.hibridcdn.net", prefix: "/proxy/rotana" },
  { host: "mbc.dbrsp.net", prefix: "/proxy/mbc" },
];

/** Ensure user-entered proxy base URLs append the ?url= query parameter cleanly. */
export function normalizeProxyPrefix(raw?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return "";
  if (/[?&]url=$/i.test(trimmed) || trimmed.endsWith("?") || trimmed.endsWith("=")) {
    return trimmed;
  }
  if (trimmed.includes("?")) {
    return trimmed.endsWith("&") ? `${trimmed}url=` : `${trimmed}&url=`;
  }
  return `${trimmed.replace(/\/+$/, "")}/?url=`;
}

function getProxyCandidates(custom?: string): string[] {
  const list: string[] = [];
  const customPrefix = normalizeProxyPrefix(custom);
  const envPrefix = normalizeProxyPrefix(ENV_PROXY);
  if (customPrefix) list.push(customPrefix);
  if (envPrefix && !list.includes(envPrefix)) list.push(envPrefix);
  for (const url of PROXY_ENDPOINTS) {
    if (!list.includes(url)) list.push(url);
  }
  return list;
}

function endpoint(custom?: string): string | null {
  const candidates = getProxyCandidates(custom);
  const now = Date.now();
  const active = candidates.find((url) => (failedUntil.get(url) ?? 0) < now);
  if (active) return active;
  // If user explicitly provided a custom proxy, keep retrying it rather than dropping custom routing.
  return normalizeProxyPrefix(custom) || null;
}

export function resetProxyStateForTests(): void {
  failedUntil.clear();
  corsFallbackHosts.clear();
}

export function proxyRewrite(source: string, custom?: string): string {
  if (IS_ELECTRON) return source;
  try {
    const url = new URL(source);
    if (!/^https?:$/.test(url.protocol)) return source;
    const candidates = getProxyCandidates(custom);
    if (candidates.some((prefix) => source.startsWith(prefix))) return source;

    const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
    const localDev = !IS_NATIVE && typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    const rule = RULES.find((item) => item.host === url.hostname);
    if (localDev && rule && !normalizeProxyPrefix(custom)) {
      return window.location.origin + rule.prefix + url.pathname + url.search;
    }

    const mixedContent = isHttpsPage && url.protocol === "http:";
    const needsRefererProxy = /(^|\.)(hibridcdn\.net|dbrsp\.net|cloudfront\.net)$/.test(url.hostname);
    const corsRetryProxy = corsFallbackHosts.has(url.hostname);
    const hasCustom = !!normalizeProxyPrefix(custom);

    if (hasCustom || mixedContent || needsRefererProxy || corsRetryProxy) {
      const targetEndpoint = endpoint(custom);
      if (targetEndpoint) return targetEndpoint + encodeURIComponent(source);
    }
  } catch { /* The playback engine reports malformed sources. */ }
  return source;
}

/** Rewrite every playlist, key and segment; preserve the CDN base for relative URIs. */
export function createPlaybackLoader(custom?: string): HlsConfig["loader"] {
  const BaseLoader = Hls.DefaultConfig.loader;
  return class PlaybackLoader extends BaseLoader {
    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      let original = context.url;
      for (const prefix of getProxyCandidates(custom)) {
        if (prefix && original.startsWith(prefix)) {
          try { original = decodeURIComponent(original.slice(prefix.length)); } catch { /* retain URL */ }
          break;
        }
      }
      const requested = proxyRewrite(original, custom);
      context.url = requested;
      super.load(context, config, {
        ...callbacks,
        onSuccess: (response, stats, ctx, details) => {
          // Direct requests retain their final redirected URL. Proxy URLs are transport only.
          if (requested !== original) response.url = original;
          callbacks.onSuccess(response, stats, ctx, details);
        },
        onError: (error, ctx, details, stats) => {
          const matchedProxy = getProxyCandidates(custom).find((prefix) => requested.startsWith(prefix));
          if (matchedProxy) {
            const code = error?.code ?? 0;
            // Dead/deleted proxy workers (404/5xx/unreachable) cool down longer so next endpoint/direct takes over.
            const cooldownMs = code === 404 || code >= 500 || code === 0 ? 300_000 : 30_000;
            failedUntil.set(matchedProxy, Date.now() + cooldownMs);
          } else if (requested === original && (error?.code === 0 || error?.code === 403) && endpoint(custom)) {
            // Direct cross-origin request failed (likely CORS or hotlink block); route host via active proxy on retry.
            try {
              corsFallbackHosts.add(new URL(original).hostname);
            } catch { /* ignore invalid URL */ }
          }
          callbacks.onError(error, ctx, details, stats);
        },
      });
    }
  };
}
