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

// ── Network interceptor: inject User-Agent / Origin / Referer ──
function setupWebRequestInterceptor() {
  const SMART_TV_UA =
    "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.2 Chrome/63.0.3239.84 TV Safari/537.36";

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };

      // Inject a Smart TV User-Agent for stream requests
      const url = details.url.toLowerCase();
      const isStream =
        url.includes(".m3u8") ||
        url.includes(".ts") ||
        url.includes(".m3u") ||
        url.includes("iptv") ||
        url.includes("stream") ||
        url.includes(".mpd") ||
        url.includes(".uk/") ||          // UK-specific stream hosts
        url.includes("bbc.co") ||        // BBC streams
        url.includes("sky.com") ||       // Sky streams
        url.includes("itv.com");         // ITV streams

      if (isStream) {
        headers["User-Agent"] = SMART_TV_UA;
        headers["Origin"] = new URL(details.url).origin;
        headers["Referer"] = new URL(details.url).origin + "/";
      }

      callback({ requestHeaders: headers });
    }
  );

  // Also strip restrictive CORS headers from responses
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };

      // Allow all origins for stream resources
      headers["Access-Control-Allow-Origin"] = ["*"];
      headers["Access-Control-Allow-Headers"] = ["*"];
      headers["Access-Control-Allow-Methods"] = ["GET, HEAD, OPTIONS"];

      // Remove X-Frame-Options so embedded players work
      delete headers["X-Frame-Options"];
      delete headers["x-frame-options"];

      callback({ responseHeaders: headers });
    }
  );

  console.log("[Electron] Web request interceptor installed (CORS bypass + Smart TV UA)");
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
