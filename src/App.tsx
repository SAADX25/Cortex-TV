/* ────────────────────────────────────────────
   App.tsx – Root application shell for Cortex TV
   Full-screen 3D globe with transparent HUD overlay,
   IPTV channel sidebar, and video player.
   ──────────────────────────────────────────── */

import { useState, useEffect, useRef } from "react";
import Scene from "./components/Scene";
import ChannelList from "./components/ChannelList";
import Player from "./components/Player";
import LeftSidebar from "./components/LeftSidebar";
import SearchModal from "./components/SearchModal";
import SettingsPanel from "./components/SettingsPanel";
import type { PlaylistConfig } from "./components/SettingsPanel";
import type { GlobeClickInfo } from "./components/Globe";
import { useIPTV, type ChannelWithStream } from "./hooks/useIPTV";
import { fetchNewsChannels } from "./hooks/useIPTV";
import { fetchAndParseM3U } from "./utils/m3uParser";
import { useUIStore } from "./stores/useUIStore";
import { usePlayerStore } from "./stores/usePlayerStore";
import { useFavoritesStore } from "./stores/useFavoritesStore";

const PLAYLIST_KEY = "cortex_playlist";

const DEFAULT_PLAYLIST: PlaylistConfig = {
  url: "",
  enabled: false,
};

export default function App() {
  /* ── Store state (granular selectors → minimal re-renders) ── */
  const activeTab = useUIStore((s) => s.activeTab);
  const selectedCountry = useUIStore((s) => s.selectedCountry);
  const focusCountryIso = useUIStore((s) => s.focusCountryIso);
  const isNightMode = useUIStore((s) => s.isNightMode);
  const globeSettings = useUIStore((s) => s.globeSettings);
  const splashVisible = useUIStore((s) => s.splashVisible);
  const splashFading = useUIStore((s) => s.splashFading);
  const playingChannel = usePlayerStore((s) => s.playingChannel);
  const favorites = useFavoritesStore((s) => s.favorites);

  /* ── Store actions (stable refs — never trigger re-renders) ── */
  const {
    setActiveTab, selectCountry, setFocusCountryIso,
    toggleNightMode, setGlobeSettings,
    setSplashFading, setSplashVisible, navigateTo,
  } = useUIStore.getState();
  const { play: playChannel, close: closePlayer } = usePlayerStore.getState();
  const { toggle: toggleFavorite } = useFavoritesStore.getState();

  /* ── Splash fade-out ── */
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    splashTimerRef.current = setTimeout(() => {
      setSplashFading(true);
      setTimeout(() => setSplashVisible(false), 700);
    }, 1800);
    return () => { if (splashTimerRef.current) clearTimeout(splashTimerRef.current); };
  }, []);

  /* ── Local playlist state (not worth globalising) ── */
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
  const handleLoadPlaylist = async (url: string) => {
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
      selectCountry(null);
      closePlayer();
      console.log(`[M3U] Loaded ${channels.length} channels from ${url}`);
    } catch (err: any) {
      console.error("[M3U] Load failed:", err);
      setPlaylistError(err.message ?? "Failed to load playlist");
      setPlaylistChannels([]);
    } finally {
      setPlaylistLoading(false);
    }
  };

  /* ── Clear playlist ── */
  const handleClearPlaylist = () => {
    setPlaylistChannels([]);
    setPlaylistError(null);
    setPlaylistConfig({ url: "", enabled: false });
  };

  /* ── Browse loaded playlist (navigate away from settings) ── */
  const handleBrowsePlaylist = () => {
    setPlaylistConfig((prev) => ({ ...prev, enabled: true }));
    selectCountry(null);
    closePlayer();
    setActiveTab("globe");
  };

  /* ── IPTV data ── */
  const { channels, loading, error } = useIPTV(
    selectedCountry?.iso ?? null
  );

  /* ── Globe click → open sidebar ── */
  const handleCountryClick = (info: GlobeClickInfo) => {
    if (info.country) {
      selectCountry(info.country);
      closePlayer();
    }
  };

  /* ── News channels state ── */
  const [newsChannels, setNewsChannels] = useState<ChannelWithStream[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  /* ── Toggle favorites panel ── */
  const handleToggleFavorites = () => {
    navigateTo(activeTab === "favorites" ? "globe" : "favorites");
  };

  /* ── Toggle news panel ── */
  const handleToggleNews = () => {
    navigateTo(activeTab === "news" ? "globe" : "news");
  };

  /* ── Load news channels when news tab activates ── */
  useEffect(() => {
    if (activeTab !== "news") return;
    let cancelled = false;
    setNewsLoading(true);
    fetchNewsChannels(300, playlistChannels).then((chs) => {
      if (!cancelled) {
        setNewsChannels(chs);
        setNewsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeTab, playlistChannels]);

  /* ── Search modal channel selection ── */
  const handleSearchSelect = (channel: ChannelWithStream) => {
    setActiveTab("globe");
    selectCountry({
      name: channel.country || "Unknown",
      iso: channel.country || "",
    });
    setFocusCountryIso(channel.country || null);
    setTimeout(() => {
      playChannel(channel);
    }, 400);
  };

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      /* Ctrl+K → open search */
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setActiveTab("search");
      }
      /* N → toggle night (only when no input is focused) */
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        toggleNightMode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ── Derive mode label ── */
  const isPlaylistMode = playlistConfig.enabled && playlistChannels.length > 0;
  const mode = playingChannel
    ? "Now Playing"
    : activeTab === "favorites"
      ? "Favorites"
      : activeTab === "news"
        ? "Quick News"
        : isPlaylistMode
          ? "Custom Playlist"
          : selectedCountry
            ? "Channel Browser"
            : "Globe Mode";

  /* ── Is any "right sidebar" content showing? ── */
  const hasRightContent =
    (selectedCountry && activeTab !== "favorites" && activeTab !== "news" && !isPlaylistMode) ||
    (isPlaylistMode && activeTab !== "favorites" && activeTab !== "news") ||
    activeTab === "favorites" ||
    activeTab === "news";

  /* ── Scene visibility (persistent mount, render loop paused when hidden) ── */
  const sceneVisible = activeTab === 'globe' && !isPlaylistMode && !playingChannel;

  /* ── Derive active channels for the Player sidebar (Famelack layout) ── */
  const sidebarChannels =
    activeTab === "favorites" ? favorites :
    activeTab === "news" ? newsChannels :
    isPlaylistMode ? playlistChannels :
    channels;

  const sidebarCountryName =
    activeTab === "favorites" ? "Favorite Channels" :
    activeTab === "news" ? "Quick News" :
    isPlaylistMode ? "Custom Playlist" :
    selectedCountry?.name ?? "Channels";

  const sidebarLoading =
    activeTab === "news" ? newsLoading : loading;

  const sidebarError =
    activeTab === "news" ? null : error;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden overscroll-none">
      {/* ── Conditional fake status bar: shown on sub-screens only, hidden on the
           immersive Globe view. Matches app bg so it blends with overlay headers. ── */}
      {activeTab !== 'globe' && !playingChannel && (
        <div className="fixed top-0 left-0 right-0 h-12 bg-[#0f172a] z-[99999] md:hidden" />
      )}
      {/* ── 3D Canvas – always mounted, hidden via CSS when not active.
           The Three.js render loop is frozen when paused → 0% GPU. ── */}
      <div
        className="absolute inset-0 z-0"
        style={{
          visibility: sceneVisible ? 'visible' : 'hidden',
          pointerEvents: sceneVisible ? 'auto' : 'none',
        }}
      >
        <Scene
          onCountryClick={handleCountryClick}
          isNightMode={isNightMode}
          rotationSpeed={globeSettings.rotationSpeed}
          atmosphereIntensity={globeSettings.atmosphereIntensity}
          focusCountryIso={focusCountryIso}
          paused={!sceneVisible}
        />
      </div>

      {/* ── Left Toolbar (desktop only) ── */}
      {!playingChannel && (
        <LeftSidebar
          isNightMode={isNightMode}
          onToggleNightMode={toggleNightMode}
          showFavorites={activeTab === "favorites"}
          onToggleFavorites={handleToggleFavorites}
          showNews={activeTab === "news"}
          onToggleNews={handleToggleNews}
          onOpenSearch={() => setActiveTab("search")}
          onOpenSettings={() => setActiveTab("settings")}
        />
      )}

      {/* ── Floating Dark-Mode Toggle (mobile only) ── */}
      {!playingChannel && (
        <button
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleNightMode(); }}
          className="absolute top-[4.5rem] right-4 z-50 md:hidden flex items-center justify-center h-10 w-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/60 hover:text-cyan-400 active:scale-90 transition-all shadow-lg"
          aria-label={isNightMode ? "Switch to Day" : "Switch to Night"}
        >
          {isNightMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
      )}

      {/* ── HUD Overlay ── */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6 select-none z-20">
        {/* Top bar (logo removed for minimal look) */}
        <div className="pt-14 md:pt-0" />

        {/* Bottom bar */}
        <div className="flex items-end justify-between pb-14 md:pb-0">
          {isPlaylistMode && !playingChannel ? (
            <div className="rounded-lg border border-purple-500/20 bg-black/40 px-4 md:px-5 py-2.5 md:py-3 backdrop-blur-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-purple-400/70">
                Custom Playlist
              </p>
              <p className="mt-0.5 text-base md:text-lg font-semibold text-white">
                {playlistChannels.length} Channels
              </p>
            </div>
          ) : selectedCountry && !playingChannel ? (
            <div className="rounded-lg border border-cyan-500/20 bg-black/40 px-4 md:px-5 py-2.5 md:py-3 backdrop-blur-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/70">
                Selected Region
              </p>
              <p className="mt-0.5 text-base md:text-lg font-semibold text-white">
                {selectedCountry.name}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Mobile Bottom Navigation Bar (hidden on md+) ── */}
      {!playingChannel && (
        <nav className="fixed bottom-0 left-0 right-0 z-[9000] md:hidden bg-[#0A192F] pb-[env(safe-area-inset-bottom)]">
          {/* Glass bar */}
          <div className="flex items-stretch h-14 bg-[#0A192F]/95 backdrop-blur-xl border-t border-white/[0.06]">
            {/* Globe / Home */}
            <button
              onClick={() => navigateTo("globe")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                activeTab === "globe"
                  ? "text-cyan-400"
                  : "text-white/40"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              <span className="text-[9px] font-medium tracking-wide">Globe</span>
            </button>

            {/* Search */}
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                activeTab === "search" ? "text-cyan-400" : "text-white/40"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="text-[9px] font-medium tracking-wide">Search</span>
            </button>

            {/* Favorites */}
            <button
              onClick={() => setActiveTab("favorites")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                activeTab === "favorites" ? "text-cyan-400" : "text-white/40"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                fill={activeTab === "favorites" ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-[9px] font-medium tracking-wide">Favorites</span>
            </button>

            {/* News */}
            <button
              onClick={() => setActiveTab("news")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                activeTab === "news" ? "text-cyan-400" : "text-white/40"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" />
                <path d="M15 18h-5" />
                <path d="M10 6h8v4h-8V6Z" />
              </svg>
              <span className={`text-[9px] font-medium tracking-wide ${activeTab === "news" ? "font-bold" : ""}`}>News</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                activeTab === "settings" ? "text-cyan-400" : "text-white/40"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="text-[9px] font-medium tracking-wide">Settings</span>
            </button>
          </div>
        </nav>
      )}

      {/* ── Custom Playlist Sidebar ── */}
      {isPlaylistMode && activeTab === "globe" && !playingChannel && (
        <ChannelList
          countryName="Custom Playlist"
          channels={playlistChannels}
          loading={playlistLoading}
          error={playlistError}
          onPlayChannel={playChannel}
          onClose={() => {
            setPlaylistConfig((p) => ({ ...p, enabled: false }));
            closePlayer();
          }}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          isPlaying={false}
          playingChannelId={null}
        />
      )}

      {/* ── Channel Sidebar (Globe mode) ── */}
      {selectedCountry && activeTab === "globe" && !isPlaylistMode && !playingChannel && (
        <ChannelList
          countryName={selectedCountry.name}
          channels={channels}
          loading={loading}
          error={error}
          onPlayChannel={playChannel}
          onClose={() => {
            selectCountry(null);
            closePlayer();
          }}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          isPlaying={false}
          playingChannelId={null}
        />
      )}

      {/* ── Favorites Sidebar ── */}
      {activeTab === "favorites" && !playingChannel && (
        <ChannelList
          countryName="Favorite Channels"
          channels={favorites}
          loading={false}
          error={null}
          onPlayChannel={playChannel}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          isPlaying={false}
          playingChannelId={null}
        />
      )}

      {/* ── Quick Access News Sidebar ── */}
      {activeTab === "news" && !playingChannel && (
        <ChannelList
          countryName="Quick Access News"
          channels={newsChannels}
          loading={newsLoading}
          error={null}
          onPlayChannel={playChannel}
          onClose={() => setActiveTab("globe")}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          isPlaying={false}
          playingChannelId={null}
        />
      )}

      {/* ── Video Player ── */}
      {playingChannel && (
        <Player
          channel={playingChannel}
          onClose={closePlayer}
          sidebarChannels={sidebarChannels}
          sidebarCountryName={sidebarCountryName}
          sidebarLoading={sidebarLoading}
          sidebarError={sidebarError}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onPlayChannel={playChannel}
          onBack={closePlayer}
        />
      )}

      {/* ── Global Search Modal ── */}
      <SearchModal
        open={activeTab === "search"}
        onClose={() => setActiveTab("globe")}
        onSelectChannel={handleSearchSelect}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      {/* ── Settings Panel ── */}
      <SettingsPanel
        open={activeTab === "settings"}
        onClose={() => setActiveTab("globe")}
        settings={globeSettings}
        onSettingsChange={setGlobeSettings}
        playlist={playlistConfig}
        onPlaylistChange={setPlaylistConfig}
        onLoadPlaylist={handleLoadPlaylist}
        onClearPlaylist={handleClearPlaylist}
        playlistLoading={playlistLoading}
        playlistError={playlistError}
        playlistCount={playlistChannels.length}
        onBrowsePlaylist={playlistChannels.length > 0 ? handleBrowsePlaylist : undefined}
      />

      {/* ── Launch Splash Overlay (fades out after mount) ── */}
      {splashVisible && (
        <div
          className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#0A192F] transition-opacity duration-700 ${
            splashFading ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Logo mark */}
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 -m-6 rounded-full bg-cyan-400/5 blur-2xl animate-pulse" />

            {/* Globe circle */}
            <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-[#1B4F8A] via-[#0E3460] to-[#091E3A] border border-cyan-400/10 shadow-[0_0_40px_rgba(0,255,255,0.08)] flex items-center justify-center overflow-hidden">
              {/* Grid lines inside globe */}
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 112 112">
                <ellipse cx="56" cy="40" rx="50" ry="14" fill="none" stroke="#00FFFF" strokeWidth="0.5" opacity="0.4"/>
                <ellipse cx="56" cy="56" rx="54" ry="16" fill="none" stroke="#00FFFF" strokeWidth="0.6" opacity="0.5"/>
                <ellipse cx="56" cy="72" rx="48" ry="13" fill="none" stroke="#00FFFF" strokeWidth="0.5" opacity="0.3"/>
                <ellipse cx="56" cy="56" rx="16" ry="54" fill="none" stroke="#00FFFF" strokeWidth="0.5" opacity="0.3"/>
                <ellipse cx="56" cy="56" rx="34" ry="54" fill="none" stroke="#00FFFF" strokeWidth="0.5" opacity="0.35"/>
              </svg>

              {/* Metallic C */}
              <span className="relative z-10 text-5xl font-bold bg-gradient-to-br from-white via-[#B0D4F1] to-[#7CB8DE] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(0,255,255,0.3)] select-none"
                style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
                C
              </span>
            </div>
          </div>

          {/* App name */}
          <h1 className="mt-6 text-xl font-bold tracking-[0.3em] text-white/90 uppercase select-none">
            Cortex TV
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[0.4em] text-cyan-400/40 uppercase select-none">
            Global IPTV Explorer
          </p>

          {/* Loading pulse */}
          <div className="mt-8 flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-cyan-400/60 animate-pulse" style={{ animationDelay: "0ms" }} />
            <div className="h-1 w-1 rounded-full bg-cyan-400/60 animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="h-1 w-1 rounded-full bg-cyan-400/60 animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
        </div>
      )}
    </div>
  );
}
