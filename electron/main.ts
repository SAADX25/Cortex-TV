/* ─────────────────────────────────────────────────
   electron/main.ts – Electron main process
   Creates the BrowserWindow, loads the Vite dev
   server in dev or the built index.html in prod.
   ───────────────────────────────────────────────── */

import { app, BrowserWindow, screen, session } from "electron";
import path from "node:path";

// ── Env vars set by vite-plugin-electron ──
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");

let mainWindow: BrowserWindow | null = null;

// The dev server URL is injected by vite-plugin-electron at build time
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const IS_DEV = !app.isPackaged;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 900,
    minHeight: 600,
    title: "Cortex TV",
    icon: path.join(process.env.VITE_PUBLIC!, "vite.svg"),
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webgl: true,
      webSecurity: false,           // Bypass CORS for .m3u8 / IPTV streams
      allowRunningInsecureContent: true,
    },
  });

  // ── Open DevTools in development ──
  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Graceful show
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ── Load content (with retry logic for dev server) ──
  const loadContent = async () => {
    try {
      if (VITE_DEV_SERVER_URL) {
        console.log(`[Electron] Loading from dev server: ${VITE_DEV_SERVER_URL}`);
        await mainWindow!.loadURL(VITE_DEV_SERVER_URL);
      } else if (IS_DEV) {
        // Fallback: dev mode but no env var → try localhost:5173 directly
        console.log("[Electron] No VITE_DEV_SERVER_URL, trying http://localhost:5173");
        await mainWindow!.loadURL("http://localhost:5173");
      } else {
        // Production: load from built files
        console.log("[Electron] Loading production build");
        await mainWindow!.loadFile(path.join(process.env.DIST!, "index.html"));
      }
    } catch (err) {
      console.error("[Electron] Failed to load content:", err);
    }
  };

  // Wait a short moment to ensure dev server is up, then load
  if (IS_DEV) {
    setTimeout(loadContent, 1000);
  } else {
    loadContent();
  }
}

// ── Network interceptor: ultimate CORS + 403 bypass ──
function setupWebRequestInterceptor() {
  const SMART_TV_UA =
    "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36";

  const CHROME_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  /*
   * ── Domain → spoofed Referer / Origin mapping ──
   * CDNs like hibridcdn.net check the Referer against a whitelist.
   * If we send the CDN's own origin (hibridcdn.net) it fails with 403.
   * We MUST send the *website* origin that the CDN expects.
   */
  const REFERER_MAP: Array<{ match: RegExp; origin: string }> = [
    // Rotana group (rotana.net CDN, hibridcdn used by Rotana & LBC)
    { match: /rotana/i,     origin: "https://rotana.net" },
    { match: /hibridcdn/i,  origin: "https://rotana.net" },
    { match: /lbc/i,        origin: "https://rotana.net" },
    // MBC group (shahid.mbc.net is the expected web origin)
    { match: /mbc/i,        origin: "https://shahid.mbc.net" },
    // Al Jazeera
    { match: /aljazeera/i,  origin: "https://www.aljazeera.net" },
    // Al Arabiya
    { match: /alarab/i,     origin: "https://www.alarabiya.net" },
    // BBC
    { match: /bbc/i,        origin: "https://www.bbc.co.uk" },
    // Sky
    { match: /sky\.com/i,   origin: "https://www.sky.com" },
    // ITV
    { match: /itv\.com/i,   origin: "https://www.itv.com" },
  ];

  /** Look up the correct spoofed origin for a URL, or null */
  const getSpoofedOrigin = (url: string): string | null => {
    for (const entry of REFERER_MAP) {
      if (entry.match.test(url)) return entry.origin;
    }
    return null;
  };

  /** Returns true if the URL is a media / stream resource */
  const isStreamUrl = (raw: string): boolean => {
    const url = raw.toLowerCase();
    return (
      // Playlist & segment extensions
      url.includes(".m3u8") ||
      url.includes(".m3u") ||
      url.includes(".ts") ||
      url.includes(".mpd") ||
      url.includes(".mp4") ||
      url.includes(".flv") ||
      url.includes(".aac") ||
      // Path keywords
      url.includes("/live/") ||
      url.includes("/iptv/") ||
      url.includes("/stream") ||
      url.includes("/hls/") ||
      url.includes("/dash/") ||
      url.includes("/play/") ||
      url.includes("/chunks") ||
      // Known CDN / provider domains
      url.includes("iptv") ||
      url.includes("hibridcdn") ||
      url.includes("cloudfront.net") ||
      url.includes("akamai") ||
      url.includes("cdn.") ||
      url.includes("edge.") ||
      // Broadcasters
      url.includes(".uk/") ||
      url.includes("bbc.co") ||
      url.includes("sky.com") ||
      url.includes("itv.com") ||
      url.includes("mbc") ||
      url.includes("lbc") ||
      url.includes("rotana") ||
      url.includes("alarab") ||
      url.includes("aljazeera")
    );
  };

  // ══════════ REQUEST interceptor ══════════
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      const url = details.url;

      if (isStreamUrl(url)) {
        headers["User-Agent"] = SMART_TV_UA;

        // Use domain-specific spoofed origin, fall back to self-origin
        const spoofed = getSpoofedOrigin(url);
        if (spoofed) {
          headers["Origin"]  = spoofed;
          headers["Referer"] = spoofed + "/";
        } else {
          try {
            const self = new URL(url).origin;
            headers["Origin"]  = self;
            headers["Referer"] = self + "/";
          } catch { /* skip */ }
        }
      } else {
        headers["User-Agent"] = CHROME_UA;
      }

      callback({ requestHeaders: headers });
    }
  );

  // ══════════ RESPONSE interceptor ══════════
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };

      // Force-allow everything (kills CORS & frame restrictions)
      headers["Access-Control-Allow-Origin"]      = ["*"];
      headers["Access-Control-Allow-Headers"]     = ["*"];
      headers["Access-Control-Allow-Methods"]     = ["*"];
      headers["Access-Control-Allow-Credentials"] = ["true"];
      headers["Access-Control-Expose-Headers"]    = ["*"];

      // Remove frame / embedding restrictions
      delete headers["X-Frame-Options"];
      delete headers["x-frame-options"];

      // Remove CSP that can block media / script loads
      delete headers["Content-Security-Policy"];
      delete headers["content-security-policy"];
      delete headers["Content-Security-Policy-Report-Only"];
      delete headers["content-security-policy-report-only"];

      callback({ responseHeaders: headers });
    }
  );

  console.log("[Electron] Ultimate CORS + 403 bypass interceptor installed");
}

// ── App lifecycle ──
app.whenReady().then(() => {
  setupWebRequestInterceptor();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    mainWindow = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
