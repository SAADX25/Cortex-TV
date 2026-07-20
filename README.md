<div align="center">

# 🌐 Cortex TV

**Interactive 3D IPTV Explorer**

Built with React · Three.js · Electron · Capacitor

---

[![Version](https://img.shields.io/badge/version-1.0.0--beta.1-blueviolet?style=flat-square)](package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)

</div>

---

## 🌍 Overview

**Cortex TV** is a 3D interactive IPTV explorer that delivers a unique browsing experience centered around an interactive globe for discovering channels by country. The app supports live HLS streaming, custom M3U playlist parsing, and multi-platform deployment (web + desktop + Android).

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🌐 **Interactive 3D Globe** | Explore channels by clicking directly on a country on the globe |
| 📺 **HLS Streaming** | Smooth playback with automatic error handling and retry logic |
| 📋 **M3U Playlist Support** | Load and parse custom user-provided playlists |
| 🔍 **Advanced Search** | Filter channels by name, country, and category |
| ⭐ **Favorites & History** | Save favorite channels and track recent viewing history |
| ⚡ **Web Workers** | Process IPTV data in the background without freezing the UI |
| 🖥️ **Electron Desktop** | Full desktop application for Windows and macOS |
| 📱 **Capacitor Android** | Native Android build from the same codebase |
| 🎨 **Custom Shaders** | GLSL shaders for the atmosphere and Earth surface |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 19 + TypeScript 5.9 |
| **Build Tool** | Vite 7 |
| **3D Rendering** | Three.js · React Three Fiber · React Globe GL |
| **State Management** | Zustand 5 |
| **Video Playback** | HLS.js 1.6 · React Player |
| **Styling** | Tailwind CSS 4 |
| **Virtual Lists** | React Virtuoso |
| **Desktop** | Electron 40 + electron-builder |
| **Mobile** | Capacitor 8 (Android) |
| **Edge Worker** | Cloudflare Workers |

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
# Install dependencies
npm ci

# Start the development server
npm run dev

# TypeScript type check
npx tsc --noEmit
```

---

## 📦 Build Commands

### 🌐 Web Build

```bash
# Custom domain deployment
npm run build:web

# GitHub Pages
npm run build:web:pages
```

### 🖥️ Electron — Desktop

```bash
npm run electron:build
```

> Output is saved to the `release/` directory.

### 📱 Android — Capacitor

```bash
npm run build:mobile
```

> Then open the `android/` folder in Android Studio to complete the build.

---

## 🗂️ Full Project Tree

```
Cortex TV/
│
├── 📄 index.html                      # Main HTML entry point
├── 📄 package.json                    # Dependencies and scripts
├── 📄 vite.config.ts                  # Vite config (Electron + Web + Mobile)
├── 📄 tsconfig.json                   # Root TypeScript config
├── 📄 tsconfig.electron.json          # TypeScript config for Electron
├── 📄 capacitor.config.ts             # Capacitor mobile config
│
├── 📁 src/                            # Full source code
│   ├── 📄 main.tsx                    # React entry point
│   ├── 📄 index.css                   # Global styles + Tailwind
│   ├── 📄 types.d.ts                  # Global TypeScript declarations
│   │
│   ├── 📁 app/                        # App bootstrapping
│   │   ├── 📄 App.tsx                 # Root component
│   │   ├── 📄 AppLayout.tsx           # Main UI layout
│   │   └── 📄 AppProviders.tsx        # Context providers composition
│   │
│   ├── 📁 features/                   # Core features (Feature-based architecture)
│   │   │
│   │   ├── 📁 globe/                  # 3D interactive globe
│   │   │   ├── 📁 components/
│   │   │   │   ├── 📄 Globe.tsx       # Main globe component (Three.js + GLSL)
│   │   │   │   ├── 📄 Scene.tsx       # Three.js scene container
│   │   │   │   ├── 📄 Atmosphere.tsx  # Atmospheric glow layer
│   │   │   │   ├── 📄 Borders.tsx     # Country borders (GeoJSON)
│   │   │   │   ├── 📄 Stars.tsx       # Starfield background
│   │   │   │   ├── 📄 Crosshair.tsx   # Targeting crosshair
│   │   │   │   └── 📄 Loading.tsx     # Loading screen
│   │   │   ├── 📁 data/
│   │   │   │   ├── 📄 geoData.ts           # Country mappings & metadata
│   │   │   │   └── 📄 geoJsonCache.ts      # IndexedDB cache for GeoJSON
│   │   │   ├── 📁 shaders/
│   │   │   │   ├── 📄 earthShader.ts       # GLSL shader for Earth surface
│   │   │   │   └── 📄 atmosphereShader.ts  # GLSL shader for atmosphere
│   │   │   └── 📁 utils/
│   │   │       ├── 📄 countryHitTest.ts    # Country click detection
│   │   │       └── 📄 geoJsonToLines.ts    # GeoJSON to 3D line conversion
│   │   │
│   │   ├── 📁 channels/               # Channel browsing
│   │   │   ├── 📁 components/
│   │   │   │   ├── 📄 HomeExperience.tsx   # Main screen with globe
│   │   │   │   ├── 📄 ChannelList.tsx      # Virtualized channel list
│   │   │   │   └── 📄 SearchModal.tsx      # Advanced search modal
│   │   │   └── 📄 types.ts            # Channel data types
│   │   │
│   │   ├── 📁 player/                 # Video player
│   │   │   ├── 📁 components/
│   │   │   │   ├── 📄 Player.tsx            # Main player (HLS.js)
│   │   │   │   ├── 📄 PlayerControls.tsx    # Playback controls
│   │   │   │   ├── 📄 PlayerShell.tsx       # Player outer shell
│   │   │   │   ├── 📄 PlayerHeader.tsx      # Player header bar
│   │   │   │   ├── 📄 VideoSurface.tsx      # Video rendering surface
│   │   │   │   ├── 📄 PlayerLoadingView.tsx # Loading state view
│   │   │   │   └── 📄 PlayerErrorView.tsx   # Error state view
│   │   │   ├── 📁 hooks/
│   │   │   │   ├── 📄 useHlsPlayer.ts         # Core HLS.js logic
│   │   │   │   ├── 📄 usePlayerFullscreen.ts  # Fullscreen management
│   │   │   │   ├── 📄 usePlayerKeyboard.ts    # Keyboard shortcuts
│   │   │   │   └── 📄 usePlayerQuality.ts     # Stream quality control
│   │   │   ├── 📁 services/
│   │   │   │   ├── 📄 playbackProxy.ts    # Playback proxy and session management
│   │   │   │   ├── 📄 playbackErrors.ts   # Playback error classification
│   │   │   │   └── 📄 playerLogger.ts     # Player event logger
│   │   │   └── 📄 types.ts            # Player data types
│   │   │
│   │   └── 📁 iptv/                   # IPTV services
│   │       ├── 📁 hooks/
│   │       │   └── 📄 useIPTV.ts          # Main hook for fetching and managing IPTV
│   │       ├── 📁 parser/
│   │       │   └── 📄 m3uParser.ts        # M3U/M3U8 file parser
│   │       ├── 📁 services/
│   │       │   ├── 📄 StreamResolver.ts   # Stream URL resolver with retry logic
│   │       │   └── 📄 playlistService.ts  # Playlist fetching service
│   │       ├── 📁 workers/
│   │       │   ├── 📄 iptvWorker.ts       # Web Worker — background IPTV processing
│   │       │   ├── 📄 iptvWorkerClient.ts # Worker communication interface
│   │       │   └── 📄 idbCache.ts         # IndexedDB caching layer
│   │       └── 📄 types.ts            # Full IPTV type definitions
│   │
│   ├── 📁 shared/                     # Shared across all features
│   │   ├── 📁 components/
│   │   │   ├── 📄 LeftSidebar.tsx       # Left sidebar panel
│   │   │   ├── 📄 SettingsPanel.tsx     # Full settings panel
│   │   │   ├── 📄 DebugPanel.tsx        # Debug and diagnostics panel
│   │   │   ├── 📄 SegmentedControl.tsx  # Mode toggle control
│   │   │   ├── 📄 SettingCard.tsx       # Individual setting card
│   │   │   └── 📄 SidebarSection.tsx    # Sidebar section wrapper
│   │   ├── 📁 lib/
│   │   │   ├── 📄 channelUtils.ts     # Channel data utilities
│   │   │   └── 📄 platformAdapter.ts  # Cross-platform differences adapter
│   │   └── 📁 types/
│   │       ├── 📄 index.ts            # Shared type exports
│   │       └── 📄 media.ts            # Media data types
│   │
│   └── 📁 stores/                     # Global app state (Zustand)
│       ├── 📄 usePlayerStore.ts       # Current player state
│       ├── 📄 useFavoritesStore.ts    # Favorite channels state (LocalStorage)
│       ├── 📄 useRecentStore.ts       # Recent channels history state
│       └── 📄 useUIStore.ts           # UI state (panels + view mode)
│
├── 📁 electron/                       # Electron main process
│   ├── 📄 main.ts                     # Main Process — window management + IPC
│   └── 📄 preload.ts                  # Preload Script — secure bridge between Renderer and Main
│
├── 📁 android/                        # Capacitor Android project (Android Studio)
├── 📁 public/                         # Static public assets (icons, manifests)
├── 📁 assets/                         # App assets (images, GeoJSON maps)
├── 📁 icons/                          # App icons (Electron + Capacitor)
├── 📁 docs/                           # Technical documentation (ARCHITECTURE, SECURITY)
├── 📁 dist/                           # Web build output
├── 📁 dist-electron/                  # Electron build output
└── 📁 release/                        # Final release installers (.exe, .dmg)
```

---

## 🏗️ Architecture

The project follows a **Feature-based Architecture**:

```
src/
├── app/          ← App bootstrapping and Providers
├── features/     ← Each feature is self-contained (globe · channels · player · iptv)
├── shared/       ← Shared components and utilities
└── stores/       ← Global state via Zustand
```

### Data Flow

```
Cloudflare Worker (CORS Proxy)
         ↓
    useIPTV Hook
         ↓
   Web Worker (iptvWorker) — background processing
         ↓
   IndexedDB Cache (idbCache) — persistent cache
         ↓
   Zustand Stores — shared global state
         ↓
   React Components
   Globe → ChannelList → Player
```

## ⚠️ Legal Disclaimer

Cortex TV is designed exclusively for legal public streams and user-owned playlists.  
**Do not use this app** to bypass subscription controls, DRM protection, provider tokens, or regional restrictions.

---

<div align="center">

*Cortex TV — Find everything you want to watch, on a map of the world.*

</div>
