/* ────────────────────────────────────────────
   App.tsx – Root application shell for Cortex TV
   Full-screen 3D globe with transparent HUD overlay,
   IPTV channel sidebar, and video player.
   ──────────────────────────────────────────── */

import { useState, useCallback } from "react";
import Scene from "./components/Scene";
import ChannelList from "./components/ChannelList";
import Player from "./components/Player";
import LeftSidebar from "./components/LeftSidebar";
import type { GlobeClickInfo, CountryInfo } from "./components/Globe";
import { useIPTV, type ChannelWithStream } from "./hooks/useIPTV";

export default function App() {
  /* ── State ── */
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(
    null
  );
  const [playingChannel, setPlayingChannel] =
    useState<ChannelWithStream | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);

  /* ── IPTV data ── */
  const { channels, loading, error } = useIPTV(
    selectedCountry?.iso ?? null
  );

  /* ── Globe click → open sidebar ── */
  const handleCountryClick = useCallback((info: GlobeClickInfo) => {
    if (info.country) {
      setSelectedCountry(info.country);
      setPlayingChannel(null);
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

  /* ── Derive mode label ── */
  const mode = playingChannel
    ? "Now Playing"
    : selectedCountry
      ? "Channel Browser"
      : "Globe Mode";

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* ── 3D Canvas ── */}
      <Scene onCountryClick={handleCountryClick} isNightMode={isNightMode} />

      {/* ── Left Toolbar ── */}
      {!playingChannel && (
        <LeftSidebar
          isNightMode={isNightMode}
          onToggleNightMode={() => setIsNightMode((v) => !v)}
        />
      )}

      {/* ── HUD Overlay ── */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 select-none z-20">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo glow dot */}
            <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_2px_rgba(0,255,255,0.6)]" />
            <h1 className="text-xl font-bold tracking-[0.25em] text-white/90 uppercase">
              Cortex TV
            </h1>
          </div>

          {/* Status badge */}
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/50 backdrop-blur-sm">
            {mode}
          </div>
        </div>

        {/* Bottom bar – selected country indicator */}
        <div className="flex items-end justify-between">
          {selectedCountry && !playingChannel ? (
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

      {/* ── Channel Sidebar ── */}
      {selectedCountry && !playingChannel && (
        <ChannelList
          countryName={selectedCountry.name}
          channels={channels}
          loading={loading}
          error={error}
          onPlayChannel={handlePlayChannel}
          onClose={handleCloseSidebar}
        />
      )}

      {/* ── Video Player ── */}
      {playingChannel && (
        <Player channel={playingChannel} onClose={handleClosePlayer} />
      )}
    </div>
  );
}
