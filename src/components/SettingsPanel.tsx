/* ──────────────────────────────────────────────────
   SettingsPanel.tsx – Slide-in settings drawer
   Glassmorphic panel with globe controls and
   developer information.
   ────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from "react";

export interface GlobeSettings {
  rotationSpeed: number;       // 0 – 2.0  (default 0.4)
  atmosphereIntensity: number; // 0.05 – 0.5 (default 0.25)
}

export interface PlaylistConfig {
  url: string;
  enabled: boolean;            // true = Custom Playlist Mode
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: GlobeSettings;
  onSettingsChange: (s: GlobeSettings) => void;
  playlist: PlaylistConfig;
  onPlaylistChange: (p: PlaylistConfig) => void;
  onLoadPlaylist: (url: string) => void;
  onClearPlaylist: () => void;
  playlistLoading: boolean;
  playlistError: string | null;
  playlistCount: number;
  onBrowsePlaylist?: () => void;
}

/* ── Reusable slider row (touch-friendly) ── */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">{label}</span>
        <span className="text-sm font-mono text-cyan-400 bg-cyan-400/10 px-2.5 py-0.5 rounded-lg">
          {value.toFixed(2)}
          {unit ?? ""}
        </span>
      </div>
      <div className="relative h-10 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/[0.06]" />
        <div
          className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="settings-slider relative w-full h-10 appearance-none bg-transparent cursor-pointer z-[1]"
        />
      </div>
    </div>
  );
}

/* ── Toggle row ── */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white/80 group-active:text-white transition-colors">
          {label}
        </p>
        {description && (
          <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div
        className={`relative shrink-0 h-8 w-[52px] rounded-full transition-colors duration-300 ${
          checked
            ? "bg-cyan-500 shadow-[0_0_14px_rgba(0,255,255,0.35)]"
            : "bg-white/10"
        }`}
      >
        <div
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
            checked ? "translate-x-[22px]" : "translate-x-1"
          }`}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
      </div>
    </label>
  );
}

export default function SettingsPanel({
  open,
  onClose,
  settings,
  onSettingsChange,
  playlist,
  onPlaylistChange,
  onLoadPlaylist,
  onClearPlaylist,
  playlistLoading,
  playlistError,
  playlistCount,
  onBrowsePlaylist,
}: SettingsPanelProps) {
  const [closing, setClosing] = useState(false);
  const [glowEnabled, setGlowEnabled] = useState(settings.atmosphereIntensity > 0.08);
  const [urlDraft, setUrlDraft] = useState(playlist.url);
  const urlInputRef = useRef<HTMLInputElement>(null);

  /* Xtream Codes auth state */
  type AuthMode = "m3u" | "xtream";
  const [authMode, setAuthMode] = useState<AuthMode>("m3u");
  const [xtServer, setXtServer] = useState("");
  const [xtPort, setXtPort] = useState("");
  const [xtUser, setXtUser] = useState("");
  const [xtPass, setXtPass] = useState("");
  const [xtShowPass, setXtShowPass] = useState(false);

  /* Sync glow toggle with intensity */
  useEffect(() => {
    setGlowEnabled(settings.atmosphereIntensity > 0.08);
  }, [settings.atmosphereIntensity]);

  /* Keep URL draft in sync when playlist config changes externally */
  useEffect(() => {
    setUrlDraft(playlist.url);
  }, [playlist.url]);

  /* Animated close */
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const animClass = closing
    ? "animate-settings-out"
    : "animate-settings-in";

  const update = (patch: Partial<GlobeSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  return (
    <div
      className={`fixed top-0 mobile-safe-panel-top md:top-0 bottom-0 left-0 right-0 z-[190] ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
    >
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 bottom-0 mobile-safe-panel-nav-clearance md:bottom-0 left-0 w-full md:w-[380px] max-w-full md:max-w-[85vw] flex flex-col bg-[#0f172a] md:bg-black/70 md:backdrop-blur-2xl border-r border-white/[0.06] shadow-[20px_0_60px_rgba(0,0,0,0.5)] ${animClass}`}
      >
        {/* ── Native-style Header ── */}
        <div className="flex items-center justify-center px-6 pt-4 md:pt-6 pb-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Settings
          </h2>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-5 pt-5 pb-6 md:pb-5 space-y-6">

          {/* ══ Globe Controls Card ══ */}
          <section>
            <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 ml-2">
              Globe Controls
            </h3>
            <div className="bg-[#112240] rounded-2xl p-4 space-y-1">
              <SliderRow
                label="Rotation Speed"
                value={settings.rotationSpeed}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => update({ rotationSpeed: v })}
              />

              <div className="w-full border-t border-white/[0.04] my-1" />

              <ToggleRow
                label="Atmospheric Glow"
                description="Enable outer atmosphere glow effect"
                checked={glowEnabled}
                onChange={(on) => {
                  setGlowEnabled(on);
                  update({ atmosphereIntensity: on ? 0.25 : 0 });
                }}
              />

              {glowEnabled && (
                <>
                  <div className="w-full border-t border-white/[0.04] my-1" />
                  <SliderRow
                    label="Glow Intensity"
                    value={settings.atmosphereIntensity}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    onChange={(v) => update({ atmosphereIntensity: v })}
                  />
                </>
              )}
            </div>
          </section>

          {/* ══ Playlist Configuration Card ══ */}
          <section>
            <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 ml-2">
              Playlist Configuration
            </h3>
            <div className="bg-[#112240] rounded-2xl p-4 space-y-1">
              {/* Mode toggle */}
              <ToggleRow
                label="Custom Playlist Mode"
                description="Switch from Globe to a custom M3U playlist"
                checked={playlist.enabled}
                onChange={(on) =>
                  onPlaylistChange({ ...playlist, enabled: on })
                }
              />

              <div className="w-full border-t border-white/[0.04] my-1" />

              {/* ── Auth method segmented control ── */}
              <div className="py-3">
                <div className="flex items-center h-11 rounded-xl bg-white/[0.04] p-1 gap-0.5">
                  <button
                    onClick={() => setAuthMode("m3u")}
                    className={`flex-1 h-full rounded-lg text-[13px] font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      authMode === "m3u"
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                        : "text-gray-400 active:text-white/60 active:bg-white/[0.04]"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    M3U Link
                  </button>
                  <button
                    onClick={() => setAuthMode("xtream")}
                    className={`flex-1 h-full rounded-lg text-[13px] font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      authMode === "xtream"
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                        : "text-gray-400 active:text-white/60 active:bg-white/[0.04]"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Xtream Login
                  </button>
                </div>
              </div>

              {/* ── Direct M3U input ── */}
              {authMode === "m3u" && (
                <>
                  <div className="py-2 space-y-2.5">
                    <label className="text-sm font-medium text-white/60">
                      M3U Playlist URL
                    </label>
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="https://example.com/playlist.m3u"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && urlDraft.trim()) {
                          onLoadPlaylist(urlDraft.trim());
                        }
                      }}
                      className="w-full h-14 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                    />
                  </div>

                  {/* Load / Clear buttons */}
                  <div className="flex gap-3 py-1">
                    <button
                      onClick={() => urlDraft.trim() && onLoadPlaylist(urlDraft.trim())}
                      disabled={!urlDraft.trim() || playlistLoading}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl h-12 border border-cyan-500/30 bg-cyan-500/10 text-sm font-semibold text-cyan-400 active:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {playlistLoading ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Load Playlist
                        </>
                      )}
                    </button>
                    <button
                      onClick={onClearPlaylist}
                      disabled={!playlist.url && playlistCount === 0}
                      className="shrink-0 flex items-center justify-center gap-2 rounded-xl h-12 px-5 border border-white/10 bg-white/5 text-sm font-medium text-white/50 active:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Clear
                    </button>
                  </div>
                </>
              )}

              {/* ── Xtream Codes login form ── */}
              {authMode === "xtream" && (
                <div className="py-2 space-y-3">
                  {/* Server */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/40 uppercase tracking-wider ml-1">Server</label>
                    <input
                      type="text"
                      placeholder="http://live.example.tv"
                      value={xtServer}
                      onChange={(e) => setXtServer(e.target.value)}
                      className="w-full h-14 bg-white/[0.05] border border-white/10 rounded-xl px-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                  {/* Port */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/40 uppercase tracking-wider ml-1">Port</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="8080"
                      value={xtPort}
                      onChange={(e) => setXtPort(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full h-14 bg-white/[0.05] border border-white/10 rounded-xl px-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                    />
                  </div>
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/40 uppercase tracking-wider ml-1">Username</label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="Your username"
                      value={xtUser}
                      onChange={(e) => setXtUser(e.target.value)}
                      className="w-full h-14 bg-white/[0.05] border border-white/10 rounded-xl px-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/40 uppercase tracking-wider ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={xtShowPass ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={xtPass}
                        onChange={(e) => setXtPass(e.target.value)}
                        className="w-full h-14 bg-white/[0.05] border border-white/10 rounded-xl px-4 pr-12 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setXtShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 active:text-white/60 transition-colors cursor-pointer p-1"
                        aria-label={xtShowPass ? "Hide password" : "Show password"}
                      >
                        {xtShowPass ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Login & Load button */}
                  <button
                    onClick={() => {
                      /* Sanitize server: ensure protocol + strip trailing slash */
                      let srv = xtServer.trim();
                      if (srv && !/^https?:\/\//i.test(srv)) srv = "http://" + srv;
                      srv = srv.replace(/\/+$/, "");
                      const port = xtPort.trim();
                      const user = xtUser.trim();
                      const pass = xtPass.trim();
                      if (!srv || !port || !user || !pass) return;
                      const xtreamUrl = `${srv}:${port}/get.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&type=m3u_plus&output=ts`;
                      setUrlDraft(xtreamUrl);
                      onLoadPlaylist(xtreamUrl);
                    }}
                    disabled={!xtServer.trim() || !xtPort.trim() || !xtUser.trim() || !xtPass.trim() || playlistLoading}
                    className="w-full flex items-center justify-center gap-2.5 h-14 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-sm font-bold tracking-wide shadow-lg shadow-cyan-600/25 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer mt-1"
                  >
                    {playlistLoading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Authenticating…
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        Login &amp; Load Channels
                      </>
                    )}
                  </button>

                  {/* Clear button */}
                  <button
                    onClick={() => {
                      setXtServer(""); setXtPort(""); setXtUser(""); setXtPass("");
                      onClearPlaylist();
                    }}
                    disabled={!xtServer && !xtPort && !xtUser && !xtPass && !playlist.url && playlistCount === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-xl h-11 border border-white/10 bg-white/[0.03] text-sm font-medium text-white/40 active:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Clear All
                  </button>
                </div>
              )}

              {/* Status */}
              {playlistError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] p-4 text-xs text-red-400 mt-2">
                  {playlistError}
                </div>
              )}
              {!playlistError && playlistCount > 0 && (
                <>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4 text-xs text-emerald-400 flex items-center gap-2 mt-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    {playlistCount} channels loaded from playlist
                  </div>
                  {onBrowsePlaylist && (
                    <button
                      onClick={onBrowsePlaylist}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl mt-4 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,255,255,0.15)] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      Browse Custom Playlist
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ══ Keyboard Shortcuts Card (desktop only) ══ */}
          <section className="hidden md:block">
            <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 ml-2">
              Keyboard Shortcuts
            </h3>
            <div className="bg-[#112240] rounded-2xl p-4 space-y-3.5">
              {[
                ["Ctrl + K", "Open Search"],
                ["Esc", "Close Panel / Modal"],
                ["N", "Toggle Day / Night"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-0.5">
                  <span className="text-sm text-white/50">{desc}</span>
                  <kbd className="text-xs text-white/50 border border-white/10 rounded-lg px-2.5 py-1 bg-white/[0.04] font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* ══ Legal & Disclaimer Card ══ */}
          <section>
            <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 ml-2">
              Legal &amp; Disclaimer
            </h3>
            <div className="bg-[#112240] rounded-2xl p-4 space-y-3 text-xs text-white/40 leading-relaxed">
              <p>
                Cortex TV is a <span className="text-white/60 font-medium">free, open-source</span> channel browser.
                It does <strong className="text-white/60">not</strong> host, store, or redistribute any media content.
              </p>
              <p>
                All channel metadata is sourced from the{" "}
                <span className="text-cyan-400/60">iptv-org/iptv</span> public database.
                Stream URLs are publicly available and community-maintained.
              </p>
              <p>
                Some streams may be geo-restricted in your country. Use of this
                app is at your own discretion and subject to the laws of your
                region. Only free, publicly accessible channels are shown.
              </p>
              <p>
                This project is not affiliated with any broadcaster or
                streaming platform.
              </p>
            </div>
          </section>

          {/* ══ Technical Info Card ══ */}
          <section>
            <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 ml-2">
              About
            </h3>
            <div className="bg-[#112240] rounded-2xl p-4 space-y-0">
              <InfoRow label="Developer" value="SAADX25" highlight />
              <InfoRow label="App Version" value="1.0.0-beta.1" />
              <InfoRow label="Framework" value="Electron + React 19" />
              <InfoRow label="Globe Engine" value="react-globe.gl" />
              <InfoRow label="Player" value="hls.js (native)" />
              <InfoRow label="Data Source" value="iptv-org API" />
              <InfoRow label="UI" value="Tailwind CSS v4" />
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

/* ── Info row helper ── */
function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-white/40">{label}</span>
      <span
        className={`text-sm font-medium ${
          highlight
            ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(0,255,255,0.5)]"
            : "text-white/70"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
