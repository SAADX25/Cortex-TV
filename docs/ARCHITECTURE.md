# Cortex TV Architecture

Cortex TV is organized around feature ownership. App bootstrapping lives in `src/app`, domain features live in `src/features`, cross-cutting UI and utilities live in `src/shared`, and global Zustand state remains in `src/stores`.

## Top-Level Structure

- `src/app/` contains the React application shell, layout composition, and provider boundary.
- `src/features/globe/` contains the Three.js globe scene, globe components, shader modules, and geo utilities.
- `src/features/iptv/` contains playlist loading, parsing, worker orchestration, cache support, stream resolution, and the shared worker message protocol.
- `src/features/channels/` contains channel browsing, filtering, search, and channel-list presentation.
- `src/features/player/` contains playback UI, player support hooks, playback error helpers, logging, and proxy-related playback services.
- `src/shared/` contains reusable components, shared utility functions, shared constants, and common public types.
- `src/stores/` contains global Zustand stores. Stores are intentionally kept outside feature folders because they coordinate state across multiple features.

## App Layer

`src/app/App.tsx` is the root component exported to React. It composes:

- `AppProviders.tsx` for provider boundaries.
- `AppLayout.tsx` for the existing visible application layout and workflow orchestration.

The refactor keeps route behavior, visible UI layout, playback behavior, and store usage intact.

## Shared Types

Common media types are centralized in `src/shared/types`:

- `Channel`
- `ChannelWithStream`
- `Stream`
- `PlaybackState`
- `Platform`

Feature modules re-export these types where helpful, but the canonical definitions remain shared to avoid duplicate structural contracts.

## IPTV Worker Protocol

Worker message contracts live in `src/features/iptv/types.ts`. The main thread client and worker import the same request/response types so worker communication stays explicit and synchronized.

The worker remains responsible for expensive IPTV data preparation, filtering, search, metadata generation, and fallback channel processing.

## Platform Boundaries

Platform detection and native-system UI setup are wrapped by `src/shared/lib/platformAdapter.ts`. React entry points and features use this adapter instead of calling Capacitor APIs directly.

Electron-specific behavior remains in Electron-side code and Vite configuration. React components should not add Electron-only APIs directly; they should receive data or use shared adapters where a renderer concern is unavoidable.

## Import Direction

The intended dependency flow is:

`app -> features -> shared`

Stores may be consumed by the app layer and feature components. Shared modules should not import from features or stores. This keeps circular imports unlikely and makes each feature easier to move, test, or replace.
