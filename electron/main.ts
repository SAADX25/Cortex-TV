import { app, BrowserWindow, Menu, screen, session } from "electron";
import path from "node:path";

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let mainWindow: BrowserWindow | null = null;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const IS_DEV = !app.isPackaged;
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1500, width), height: Math.min(940, height), minWidth: 900, minHeight: 600,
    title: "Cortex TV", icon: path.join(process.env.VITE_PUBLIC!, "favicon.svg"),
    backgroundColor: "#08080a", show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, webgl: true,
      webSecurity: true,
      allowRunningInsecureContent: true,
    },
  });
  if (IS_DEV && process.env.VITE_OPEN_DEVTOOLS === "true") mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.once("ready-to-show", () => { mainWindow?.show(); mainWindow?.focus(); });
  // Keep live decoding active while minimized; throttling video can produce false stalls.
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault();
  });
  const load = async () => {
    try {
      if (VITE_DEV_SERVER_URL) await mainWindow!.loadURL(VITE_DEV_SERVER_URL);
      else if (IS_DEV) await mainWindow!.loadURL("http://localhost:5173");
      else await mainWindow!.loadFile(path.join(process.env.DIST!, "index.html"));
    } catch (error) { console.error("[Electron] Failed to load app:", error); }
  };
  void load();
}

function setupWebRequestInterceptor() {
  const referers = [
    { host: /(^|\.)hibridcdn\.net$/, origin: "https://rotana.net" },
    { host: /(^|\.)dbrsp\.net$/, origin: "https://shahid.mbc.net" },
  ];
  const isPlaybackRequest = (details: { url: string; resourceType: string; webContentsId?: number }) => {
    if (details.webContentsId !== mainWindow?.webContents.id) return false;
    try {
      const url = new URL(details.url);
      if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return false;
      if (url.hostname === "iptv-org.github.io") return false;
      // XHR includes extensionless playlists, encryption keys and redirected segments.
      return details.resourceType === "media" || details.resourceType === "xhr";
    } catch { return false; }
  };
  const removeHeaders = (headers: Record<string, unknown>, names: string[]) => {
    for (const key of Object.keys(headers)) if (names.includes(key.toLowerCase())) delete headers[key];
  };
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["http://*/*", "https://*/*"] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    if (isPlaybackRequest(details)) {
      removeHeaders(headers, ["origin", "referer", "user-agent"]);
      headers["User-Agent"] = CHROME_UA;
      // Preserve the two provider-specific integrations; other servers receive no browser origin.
      const rule = referers.find((item) => item.host.test(new URL(details.url).hostname));
      if (rule) { headers.Origin = rule.origin; headers.Referer = `${rule.origin}/`; }
    }
    callback({ requestHeaders: headers });
  });
  session.defaultSession.webRequest.onHeadersReceived({ urls: ["http://*/*", "https://*/*"] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    if (isPlaybackRequest(details)) {
      removeHeaders(headers, ["access-control-allow-origin", "access-control-allow-headers", "access-control-allow-methods", "access-control-allow-credentials", "access-control-expose-headers"]);
      headers["Access-Control-Allow-Origin"] = ["*"];
      headers["Access-Control-Allow-Headers"] = ["*"];
      headers["Access-Control-Allow-Methods"] = ["GET, HEAD, OPTIONS"];
      headers["Access-Control-Expose-Headers"] = ["*"];
    }
    callback({ responseHeaders: headers });
  });
}

app.whenReady().then(() => { Menu.setApplicationMenu(null); setupWebRequestInterceptor(); createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") { app.quit(); mainWindow = null; } });
app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
