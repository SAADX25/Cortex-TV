# Cortex TV Security

Cortex TV is designed for legal, user-provided playlists and properly documented stream providers. The app must not include token bypass logic, entitlement bypass logic, DRM circumvention, or source-specific spoofing intended to access unauthorized streams.

## Electron Security

Electron code should keep the renderer isolated from privileged Node APIs.

Recommended boundaries:

- Keep privileged filesystem, network interception, and OS integration in Electron main/preload code.
- Do not expose broad Node primitives to React components.
- Prefer narrow, typed IPC methods for any renderer-to-main communication.
- Keep `contextIsolation` enabled and avoid enabling remote module access.
- Treat external URLs and playlist metadata as untrusted input.

## Stream Source Boundaries

Cortex TV supports legal IPTV use cases such as:

- Publicly available streams from documented providers.
- User-owned or user-authorized M3U playlists.
- Provider APIs that explicitly permit playback in third-party clients.

Cortex TV must not add logic that:

- Bypasses provider authentication or subscription requirements.
- Circumvents DRM or access-control tokens.
- Scrapes private source URLs from unauthorized pages.
- Spoofs protected origins to defeat provider restrictions.
- Ships hard-coded credentials, secrets, or private stream URLs.

## Safe Provider Handling

Provider integrations should be documented, narrow, and auditable.

- Keep provider-specific behavior in services rather than UI components.
- Prefer official APIs and documented playlist formats.
- Validate and normalize playlist data before storing or displaying it.
- Avoid logging secrets, signed URLs, or private tokens.
- Respect provider regional, legal, and technical restrictions.

## Playlist Handling

Playlist files and remote playlist URLs are untrusted input. Parser and worker logic should tolerate malformed data, missing fields, duplicate channels, and failed stream URLs without crashing the app.

Broken or unavailable streams should be reported as unavailable to the user. The app should not attempt unauthorized fallbacks.
