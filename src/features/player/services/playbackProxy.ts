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

export const CLOUD_PROXY = "https://cortextv-proxy.cortextv-sr.workers.dev/?url=";

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

function isSegmentUrl(url: string): boolean {
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
      const proxied = CLOUD_PROXY + encodeURIComponent(url);
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

      if (cdnUrl.startsWith(CLOUD_PROXY)) {
        try {
          cdnUrl = decodeURIComponent(cdnUrl.slice(CLOUD_PROXY.length));
          debugFn?.(`Unwrapped proxy -> ${cdnUrl.substring(0, 90)}`);
        } catch {
          /* keep original */
        }
      }

      const realCdnUrl = cdnUrl;

      if (needsCloudProxy(cdnUrl) && !isSegmentUrl(cdnUrl)) {
        context.url = CLOUD_PROXY + encodeURIComponent(cdnUrl);
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
