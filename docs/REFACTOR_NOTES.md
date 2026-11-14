# Original Cortex TV design restored

23 October 2026 — the previous OTT redesign was removed at the user's request.

The app starts on the original full-screen interactive globe again, with its original cyan/navy colors, floating country browser, collapsible navigation, mobile bottom navigation, settings, favorites, and news panels. The replacement discovery page, red theme, and multi-column OTT navigation are removed.

Focused improvements retained:

- Fixed the global CSS reset overriding Tailwind padding/margins, which caused cramped search panels and controls.
- Search has readable horizontal category tabs, an internal close button, bounded scrolling, stale-result cancellation, and keyboard selection that scrolls into view.
- Channel lists retain debounced search, filters, safe image fallbacks, and virtualization for thousands of channels.
- The player uses the original video-plus-right-channel-list arrangement, with cyan controls; mobile puts the video above the list.
- Custom playback controls and keyboard shortcuts remain, alongside retry/next-channel/report actions.
- Stable HLS recovery, the 12-second watchdog, safe source cleanup, and platform networking fixes remain.
- Escape closes the navigation/country panels; search and settings retain their own Escape behavior.

Relevant files: `src/app/AppLayout.tsx`, `src/features/channels/components/HomeExperience.tsx`, `SearchModal.tsx`, `ChannelList.tsx`, `src/features/player/components/Player.tsx`, `src/index.css`, `src/classic-controls.css`, `src/main.tsx`, and `src/stores/useUIStore.ts`. The original sidebar, settings, shared theme, manifest, and HTML styling were restored. `src/ott.css` and the obsolete OTT screenshots were removed.

Verification:

- `npm test`: 12 passing recovery and asset tests.
- `npm run build:mobile`: TypeScript, frontend/Electron build, and Capacitor sync.
- Browser smoke: original globe, desktop/mobile search spacing and close action, virtualized guide, one video, remote switching, recovery UI.
- Real HLS smoke: 1280×720 decoded frames, quality selection, pause/resume, fullscreen, and cleanup.
- Screenshots: `docs/screenshots/classic/`.
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

Browser scripts: run `npm run dev:web -- --host 127.0.0.1 --port 5177 --strictPort`, then `npm run test:ui` or `npm run test:hls`. Set `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using the bundled Playwright runtime and installed Chrome. `CORTEX_TEST_URL` defaults to port 5177.

Physical Android, Safari, and packaged Electron playback require device testing. Provider availability still depends on the external stream. The build reports size warnings for deferred player and globe dependencies; there are no TypeScript or bundler errors.
