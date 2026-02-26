/* ─────────────────────────────────────────────────
   electron/main.ts – Electron main process
   Creates the BrowserWindow, loads the Vite dev
   server in dev or the built index.html in prod.
   ───────────────────────────────────────────────── */

import { app, BrowserWindow, screen } from "electron";
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

// ── App lifecycle ──
app.whenReady().then(createWindow);

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
