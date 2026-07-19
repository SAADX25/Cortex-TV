import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import path from "node:path";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const isCustomDomain = process.env.CUSTOM_DOMAIN === "true";

export default defineConfig({
  base: isCustomDomain ? "/" : isGitHubPages ? "/Cortex-TV/" : "/",
  server: {
    middlewareMode: false,
    hmr: {
      host: "localhost",
      port: 5173,
    },
    proxy: {
      /* ── Rotana / LBC (hibridcdn) proxy ── */
      "/proxy/rotana": {
        target: "https://rotana.hibridcdn.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/rotana/, ""),
        headers: {
          Origin: "https://rotana.net",
          Referer: "https://rotana.net/",
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            proxyReq.setHeader("Origin", "https://rotana.net");
            proxyReq.setHeader("Referer", "https://rotana.net/");
          });
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["access-control-allow-origin"] = "*";
            proxyRes.headers["access-control-allow-methods"] = "*";
            proxyRes.headers["access-control-allow-headers"] = "*";
            delete proxyRes.headers["x-frame-options"];
          });
        },
      },
      /* ── MBC / Shahid proxy ── */
      "/proxy/mbc": {
        target: "https://mbc.dbrsp.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/mbc/, ""),
        headers: {
          Origin: "https://shahid.mbc.net",
          Referer: "https://shahid.mbc.net/",
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            proxyReq.setHeader("Origin", "https://shahid.mbc.net");
            proxyReq.setHeader("Referer", "https://shahid.mbc.net/");
          });
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["access-control-allow-origin"] = "*";
            proxyRes.headers["access-control-allow-methods"] = "*";
            proxyRes.headers["access-control-allow-headers"] = "*";
            delete proxyRes.headers["x-frame-options"];
          });
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        // ── Main process ──
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  assetsInclude: ["**/*.glb", "**/*.gltf"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
