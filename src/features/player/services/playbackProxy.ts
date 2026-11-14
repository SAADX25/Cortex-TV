import Hls from "hls.js";
import type { HlsConfig, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";
import { isElectronPlatform, isNativePlatform } from "@/shared/lib/platformAdapter";

export const IS_ELECTRON = isElectronPlatform();
export const IS_NATIVE = isNativePlatform();
export const PROXY_ENDPOINTS = [
  "https://cortextv-proxy.cortextv-sr.workers.dev/?url=",
  "https://cortex-proxy-2.cortextv-sr.workers.dev/?url=",
];
const failedUntil = new Map<string, number>();
const RULES = [
  { host: "rotana.hibridcdn.net", prefix: "/proxy/rotana" },
  { host: "mbc.dbrsp.net", prefix: "/proxy/mbc" },
];

function endpoint(custom?: string) {
  if (custom && /^https?:\/\//i.test(custom)) return custom;
  return PROXY_ENDPOINTS.find((url) => (failedUntil.get(url) ?? 0) < Date.now()) ?? PROXY_ENDPOINTS[0];
}

export function proxyRewrite(source: string, custom?: string): string {
  if (IS_ELECTRON) return source;
  try {
    const url = new URL(source);
    if (!/^https?:$/.test(url.protocol)) return source;
    if ([...PROXY_ENDPOINTS, custom].some((prefix) => prefix && source.startsWith(prefix))) return source;
    const localDev = !IS_NATIVE && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    const rule = RULES.find((item) => item.host === url.hostname);
    if (localDev && rule && !custom) return window.location.origin + rule.prefix + url.pathname + url.search;
    const mixedContent = window.location.protocol === "https:" && url.protocol === "http:";
    const needsProxy = /(^|\.)(hibridcdn\.net|dbrsp\.net|cloudfront\.net)$/.test(url.hostname);
    if (custom || mixedContent || needsProxy) return endpoint(custom) + encodeURIComponent(source);
  } catch { /* The playback engine reports malformed sources. */ }
  return source;
}

/** Rewrite every playlist, key and segment; preserve the CDN base for relative URIs. */
export function createPlaybackLoader(custom?: string): HlsConfig["loader"] {
  const BaseLoader = Hls.DefaultConfig.loader;
  return class PlaybackLoader extends BaseLoader {
    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      let original = context.url;
      for (const prefix of [...PROXY_ENDPOINTS, custom]) {
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
          const proxy = PROXY_ENDPOINTS.find((prefix) => requested.startsWith(prefix));
          if (proxy) failedUntil.set(proxy, Date.now() + 30000);
          callbacks.onError(error, ctx, details, stats);
        },
      });
    }
  };
}
