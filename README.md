# Cortex TV

Cortex TV is a 3D interactive IPTV explorer built with React, Vite, Three.js, HLS playback, Electron, and Capacitor. It presents a globe-first browsing experience for legal public streams and user-provided playlists while preserving desktop, web, and Android build targets.

## Features

- Interactive 3D globe for country-based channel discovery.
- Channel browsing, filtering, search, favorites, and recent channel history.
- HLS playback with retry handling and stream status feedback.
- M3U playlist parsing for user-provided playlists.
- Web Worker backed IPTV search and metadata processing.
- Electron desktop packaging.
- Capacitor Android project support.
- Zustand stores for player, favorites, recent channels, and UI state.

## Tech Stack

- React 19
- Vite 7
- TypeScript
- Zustand
- Three.js and React Three Fiber
- HLS.js
- Web Workers
- Electron
- Capacitor Android
- Tailwind CSS

## Setup

Install dependencies:

```bash
npm ci
```

Start the Vite development server:

```bash
npm run dev
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

## Required Assets

The app expects its normal static assets to remain available under `public/`, `assets/`, and platform-specific icon/splash locations. Keep Electron and Capacitor icons in sync before release builds.

## Desktop Build

Build the web and Electron bundles:

```bash
npm run build
```

Package the Electron desktop app:

```bash
npm run electron:build
```

## Web Build

Build for custom-domain web deployment:

```bash
npm run build:web
```

GitHub Pages and custom web scripts are also available:

```bash
npm run build:web:pages
npm run build:web:custom
```

## Android Build

Build and sync the Capacitor Android project:

```bash
npm run build:mobile
```

Then open or build the Android project from `android/` with Android Studio or Capacitor tooling.

## Architecture Overview

The source tree is feature-based:

- `src/app/` contains app bootstrapping, layout, and provider composition.
- `src/features/globe/` contains globe scene components, hooks, utilities, and shaders.
- `src/features/iptv/` contains IPTV hooks, parser logic, services, workers, cache support, and worker message types.
- `src/features/channels/` contains channel list, search, browsing UI, and channel feature types.
- `src/features/player/` contains playback components, hooks, player services, and player types.
- `src/shared/` contains reusable UI, shared utilities, shared constants, and shared types.
- `src/stores/` contains global Zustand stores.

See `docs/ARCHITECTURE.md` for more detail.

## Legal and Source Disclaimer

Cortex TV is intended for legal public streams, user-owned playlists, and properly documented providers. Do not use the app to bypass authentication, subscription controls, DRM, provider tokens, regional restrictions, or other access controls.

See `docs/SECURITY.md` for provider and Electron security guidance.

## Screenshots

Screenshots will be added here.
