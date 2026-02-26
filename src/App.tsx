/* ────────────────────────────────────────────
   App.tsx – Root application shell for Cortex TV
   Full-screen 3D globe with transparent HUD overlay,
   IPTV channel sidebar, and video player.
   ──────────────────────────────────────────── */

import { useState, useCallback, useEffect } from "react";
import Scene from "./components/Scene";
import ChannelList from "./components/ChannelList";
import Player from "./components/Player";
import LeftSidebar from "./components/LeftSidebar";
import SearchModal from "./components/SearchModal";
import SettingsPanel from "./components/SettingsPanel";
import type { GlobeSettings, PlaylistConfig } from "./components/SettingsPanel";
import type { GlobeClickInfo, CountryInfo } from "./components/Globe";
import { useIPTV, type ChannelWithStream } from "./hooks/useIPTV";
import { fetchAndParseM3U } from "./utils/m3uParser";

const FAVORITES_KEY = "cortex_favorites";
const SETTINGS_KEY = "cortex_settings";
const PLAYLIST_KEY = "cortex_playlist";

const DEFAULT_SETTINGS: GlobeSettings = {
  rotationSpeed: 0.4,
  atmosphereIntensity: 0.25,
};

const DEFAULT_PLAYLIST: PlaylistConfig = {
  url: "",
  enabled: false,
};

export default function App() {
  /* ── State ── */
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(
    null
  );
  const [playingChannel, setPlayingChannel] =
    useState<ChannelWithStream | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusCountryIso, setFocusCountryIso] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ChannelWithStream[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [globeSettings, setGlobeSettings] = useState<GlobeSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  /* ── Custom playlist state ── */
  const [playlistConfig, setPlaylistConfig] = useState<PlaylistConfig>(() => {
    try {
      return { ...DEFAULT_PLAYLIST, ...JSON.parse(localStorage.getItem(PLAYLIST_KEY) || "{}") };
    } catch {
      return DEFAULT_PLAYLIST;
    }
  });
  const [playlistChannels, setPlaylistChannels] = useState<ChannelWithStream[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);

  /* ── Persist favorites ── */
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  /* ── Persist settings ── */
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(globeSettings));
  }, [globeSettings]);

  /* ── Persist playlist config ── */
  useEffect(() => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlistConfig));
  }, [playlistConfig]);

  /* ── Auto-load saved playlist URL on startup ── */
  useEffect(() => {
    if (playlistConfig.url && playlistConfig.enabled && playlistChannels.length === 0) {
      handleLoadPlaylist(playlistConfig.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load M3U playlist ── */
  const handleLoadPlaylist = useCallback(async (url: string) => {
    setPlaylistLoading(true);
    setPlaylistError(null);
    try {
      const channels = await fetchAndParseM3U(url);
      if (channels.length === 0) {
        setPlaylistError("Playlist parsed but contained no valid channels.");
      }
      setPlaylistChannels(channels);
      setPlaylistConfig((prev) => ({ ...prev, url, enabled: true }));
      /* Close any open country sidebar when switching to playlist mode */
      setSelectedCountry(null);
      setPlayingChannel(null);
      console.log(`[M3U] Loaded ${channels.length} channels from ${url}`);
    } catch (err: any) {
      console.error("[M3U] Load failed:", err);
      setPlaylistError(err.message ?? "Failed to load playlist");
      setPlaylistChannels([]);
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  /* ── Clear playlist ── */
  const handleClearPlaylist = useCallback(() => {
    setPlaylistChannels([]);
    setPlaylistError(null);
    setPlaylistConfig({ url: "", enabled: false });
  }, []);

  /* ── IPTV data ── */
  const { channels, loading, error } = useIPTV(
    selectedCountry?.iso ?? null
  );

  /* ── Globe click → open sidebar ── */
  const handleCountryClick = useCallback((info: GlobeClickInfo) => {
    if (info.country) {
      setSelectedCountry(info.country);
      setPlayingChannel(null);
      setShowFavorites(false);
    }
  }, []);

  /* ── Close sidebar → back to globe ── */
  const handleCloseSidebar = useCallback(() => {
    setSelectedCountry(null);
    setPlayingChannel(null);
  }, []);

  /* ── Play a channel ── */
  const handlePlayChannel = useCallback((channel: ChannelWithStream) => {
    setPlayingChannel(channel);
  }, []);

  /* ── Close player → back to sidebar ── */
  const handleClosePlayer = useCallback(() => {
    setPlayingChannel(null);
  }, []);

  /* ── Toggle a channel in favorites ── */
  const toggleFavorite = useCallback((channel: ChannelWithStream) => {
    setFavorites((prev) => {
      const exists = prev.some((c) => c.id === channel.id);
      return exists
        ? prev.filter((c) => c.id !== channel.id)
        : [...prev, channel];
    });
  }, []);

  /* ── Toggle favorites panel ── */
  const handleToggleFavorites = useCallback(() => {
    setShowFavorites((v) => {
      const next = !v;
      if (next) {
        setSelectedCountry(null);
        setPlayingChannel(null);
      }
      return next;
    });
  }, []);

  /* ── Search modal channel selection ── */
  const handleSearchSelect = useCallback((channel: ChannelWithStream) => {
    /* Close sidebars, fly globe to channel's country, then play */
    setShowFavorites(false);
    setSelectedCountry({
      name: channel.country || "Unknown",
      iso: channel.country || "",
    });
    setFocusCountryIso(channel.country || null);
    /* Small delay to let the globe fly, then auto-play */
    setTimeout(() => {
      setPlayingChannel(channel);
    }, 400);
  }, []);

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      /* Ctrl+K → open search */
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      /* N → toggle night (only when no input is focused) */
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        setIsNightMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ── Derive mode label ── */
  const isPlaylistMode = playlistConfig.enabled && playlistChannels.length > 0;
  const mode = playingChannel
    ? "Now Playing"
    : showFavorites
      ? "Favorites"
      : isPlaylistMode
        ? "Custom Playlist"
        : selectedCountry
          ? "Channel Browser"
          : "Globe Mode";

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* ── 3D Canvas (hidden when in playlist mode) ── */}
      {!isPlaylistMode && (
        <Scene
          onCountryClick={handleCountryClick}
          isNightMode={isNightMode}
          rotationSpeed={globeSettings.rotationSpeed}
          atmosphereIntensity={globeSettings.atmosphereIntensity}
          focusCountryIso={focusCountryIso}
        />
      )}

      {/* ── Left Toolbar ── */}
      {!playingChannel && (
        <LeftSidebar
          isNightMode={isNightMode}
          onToggleNightMode={() => setIsNightMode((v) => !v)}
          showFavorites={showFavorites}
          onToggleFavorites={handleToggleFavorites}
          onOpenSearch={() => setShowSearch(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* ── HUD Overlay ── */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 select-none z-20">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_2px_rgba(0,255,255,0.6)]" />
            <h1 className="text-xl font-bold tracking-[0.25em] text-white/90 uppercase">
              Cortex TV
            </h1>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/50 backdrop-blur-sm">
            {mode}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-end justify-between">
          {isPlaylistMode && !playingChannel ? (
            <div className="rounded-lg border border-purple-500/20 bg-black/40 px-5 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-purple-400/70">
                Custom Playlist
              </p>
              <p className="mt-0.5 text-lg font-semibold text-white">
                {playlistChannels.length} Channels
              </p>
            </div>
          ) : selectedCountry && !playingChannel ? (
            <div className="rounded-lg border border-cyan-500/20 bg-black/40 px-5 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/70">
                Selected Region
              </p>
              <p className="mt-0.5 text-lg font-semibold text-white">
                {selectedCountry.name}
              </p>
            </div>
          ) : !playingChannel ? (
            <div className="text-xs text-white/30">
              Click a country to explore IPTV channels
            </div>
          ) : null}

          {!playingChannel && (
            <div className="text-[10px] text-white/20">
              v1.0.0 &middot; Electron + React + react-globe.gl
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Playlist Sidebar ── */}
      {isPlaylistMode && !playingChannel && !showFavorites && (
        <ChannelList
          countryName="Custom Playlist"
          channels={playlistChannels}
          loading={playlistLoading}
          error={playlistError}
          onPlayChannel={handlePlayChannel}
          onClose={() => setPlaylistConfig((p) => ({ ...p, enabled: false }))}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {/* ── Channel Sidebar (Globe mode) ── */}
      {selectedCountry && !playingChannel && !showFavorites && !isPlaylistMode && (
        <ChannelList
          countryName={selectedCountry.name}
          channels={channels}
          loading={loading}
          error={error}
          onPlayChannel={handlePlayChannel}
          onClose={handleCloseSidebar}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {/* ── Favorites Sidebar ── */}
      {showFavorites && !playingChannel && (
        <ChannelList
          countryName="Favorite Channels"
          channels={favorites}
          loading={false}
          error={null}
          onPlayChannel={handlePlayChannel}
          onClose={() => setShowFavorites(false)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {/* ── Video Player ── */}
      {playingChannel && (
        <Player channel={playingChannel} onClose={handleClosePlayer} />
      )}

      {/* ── Global Search Modal ── */}
      <SearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectChannel={handleSearchSelect}
      />

      {/* ── Settings Panel ── */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={globeSettings}
        onSettingsChange={setGlobeSettings}
        playlist={playlistConfig}
        onPlaylistChange={setPlaylistConfig}
        onLoadPlaylist={handleLoadPlaylist}
        onClearPlaylist={handleClearPlaylist}
        playlistLoading={playlistLoading}
        playlistError={playlistError}
        playlistCount={playlistChannels.length}
      />
    </div>
  );
}
