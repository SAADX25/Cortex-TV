import Hls from "hls.js";
import { isElectronPlatform, isNativePlatform } from "@/shared/lib/platformAdapter";

export const IS_ELECTRON = isElectronPlatform();
export const IS_NATIVE = isNativePlatform();
export const IS_PROD_BROWSER =
  !IS_ELECTRON &&
  !IS_NATIVE &&
  typeof window !== "undefined" &&
  !/localhost|127\.0\.0\.1/.test(window.location.hostname);

export const PROXY_RULES: Array<{ match: RegExp; prefix: string; strip: string }> = [
  { match: /https?:\/\/rotana\.hibridcdn\.net/i, prefix: "/proxy/rotana", strip: "rotana.hibridcdn.net" },
  { match: /https?:\/\/mbc\.dbrsp\.net/i, prefix: "/proxy/mbc", strip: "mbc.dbrsp.net" },
];

export const PROXY_ENDPOINTS = [
  "https://cortextv-proxy.cortextv-sr.workers.dev/?url=",
  "https://cortex-proxy-2.cortextv-sr.workers.dev/?url=",
];

let customProxyUrl: string | null = null;
const proxyCooldowns: Record<string, number> = {};
const COOLDOWN_MS = 30000;

export function setCustomProxyUrl(url: string | null) {
  customProxyUrl = url;
}

export function getActiveProxyUrl(): string {
  if (customProxyUrl) return customProxyUrl;
  const now = Date.now();
  for (const endpoint of PROXY_ENDPOINTS) {
    if (!proxyCooldowns[endpoint] || now > proxyCooldowns[endpoint]) {
      return endpoint;
    }
  }
  return PROXY_ENDPOINTS[0];
}

export function markProxyFailed(url: string) {
  proxyCooldowns[url] = Date.now() + COOLDOWN_MS;
  console.warn(`[Proxy] Marked ${url} as failed. Cooldown for ${COOLDOWN_MS}ms.`);
}

const PROXY_CDN_FRAGMENTS = [
  "hibridcdn.net",
  "dbrsp.net",
  "cloudfront.net",
];

export function needsCloudProxy(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (url.includes("cortextv-proxy") && url.includes("workers.dev")) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PROXY_CDN_FRAGMENTS.some((fragment) => hostname.includes(fragment));
  } catch {
    return false;
  }
}

export function matchesProxyRule(url: string): boolean {
  return PROXY_RULES.some((rule) => rule.match.test(url));
}

export function isSegmentUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.(ts|aac|mp4|m4s|fmp4|cmfv|cmfa|vtt|webvtt)(\?.*)?$/i.test(path);
  } catch {
    return false;
  }
}

export function proxyRewrite(url: string): string {
  if (IS_ELECTRON) return url;

  if (IS_NATIVE || IS_PROD_BROWSER) {
    if (needsCloudProxy(url)) {
      const proxied = getActiveProxyUrl() + encodeURIComponent(url);
      console.log(`[Player] Cloud proxy: ${url} -> ${proxied}`);
      return proxied;
    }
    return url;
  }

  for (const rule of PROXY_RULES) {
    if (rule.match.test(url)) {
      const absolute = window.location.origin + rule.prefix;
      const rewritten = url.replace(new RegExp(`https?://${rule.strip}`, "i"), absolute);
      console.log(`[Player] Vite proxy: ${url} -> ${rewritten}`);
      return rewritten;
    }
  }

  return url;
}

export function createNativeProxyLoader(debugFn?: (msg: string) => void) {
  const DefaultLoader = Hls.DefaultConfig.loader;

  return class NativeProxyLoader extends DefaultLoader {
    load(context: any, config: any, callbacks: any) {
      let cdnUrl: string = context.url;

      let unwrapped = false;
      if (customProxyUrl && cdnUrl.startsWith(customProxyUrl)) {
        try {
          cdnUrl = decodeURIComponent(cdnUrl.slice(customProxyUrl.length));
          unwrapped = true;
        } catch {}
      } else {
        for (const endpoint of PROXY_ENDPOINTS) {
          if (cdnUrl.startsWith(endpoint)) {
            try {
              cdnUrl = decodeURIComponent(cdnUrl.slice(endpoint.length));
              unwrapped = true;
            } catch {}
            break;
          }
        }
      }
      if (unwrapped) debugFn?.(`Unwrapped proxy -> ${cdnUrl.substring(0, 90)}`);

      const realCdnUrl = cdnUrl;

      if (needsCloudProxy(cdnUrl) && !isSegmentUrl(cdnUrl)) {
        context.url = getActiveProxyUrl() + encodeURIComponent(cdnUrl);
        debugFn?.(`Proxy load: ${cdnUrl.substring(0, 70)}`);
      }

      const originalOnSuccess = callbacks.onSuccess;
      callbacks.onSuccess = (
        response: any,
        stats: any,
        ctx: any,
        networkDetails: any,
      ) => {
        response.url = realCdnUrl;
        originalOnSuccess(response, stats, ctx, networkDetails);
      };

      super.load(context, config, callbacks);
    }
  };
}
