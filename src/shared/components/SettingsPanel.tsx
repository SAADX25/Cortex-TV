import { useState, useEffect, useCallback, useRef } from "react";

export type GlobeFps = "auto" | 30 | 60;

export interface GlobeSettings {
  rotationSpeed: number;       // 0 – 2.0  (default 0.4)
  atmosphereIntensity: number; // 0.05 – 0.5 (default 0.25)
  globeFps: GlobeFps;          // "auto" | 30 | 60 (default "auto")
  devMonitorVisible?: boolean; // Show Dev Monitor overlay
  autoRotate: boolean;         // Enable/disable globe auto-rotation
  highQualityGraphics: boolean;// Use native resolution
  customProxyUrl?: string;     // Custom CORS proxy URL for web
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
        <span className="text-sm font-semibold text-blue-50/85">{label}</span>
        <span className="text-sm font-mono font-bold text-sky-200 bg-blue-500/20 border border-blue-400/25 px-2.5 py-0.5 rounded-lg">
          {value.toFixed(2)}
          {unit ?? ""}
        </span>
      </div>
      <div className="relative h-10 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-blue-950/80 border border-blue-400/15" />
        <div
          className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-400"
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
        <p className="text-sm font-semibold text-white/90 group-active:text-white transition-colors">
          {label}
        </p>
        {description && (
          <p className="text-xs text-blue-200/55 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div
        className={`relative shrink-0 h-8 w-[52px] rounded-full transition-colors duration-300 ${
          checked
            ? "bg-gradient-to-r from-blue-600 to-sky-500 shadow-[0_0_14px_rgba(37,99,235,0.45)]"
            : "bg-blue-950/90 border border-blue-400/20"
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

  type AuthMode = "m3u" | "xtream";
  const [authMode, setAuthMode] = useState<AuthMode>("m3u");
  const [xtServer, setXtServer] = useState("");
  const [xtPort, setXtPort] = useState("");
  const [xtUser, setXtUser] = useState("");
  const [xtPass, setXtPass] = useState("");
  const [xtShowPass, setXtShowPass] = useState(false);

  useEffect(() => {
    setGlowEnabled(settings.atmosphereIntensity > 0.08);
  }, [settings.atmosphereIntensity]);

  useEffect(() => {
    setUrlDraft(playlist.url);
  }, [playlist.url]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={handleClose} />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 bottom-0 mobile-safe-panel-nav-clearance md:bottom-0 left-0 w-full md:w-[390px] max-w-full md:max-w-[85vw] flex flex-col bg-gradient-to-b from-[#0b1f44]/98 to-[#050f24]/98 md:backdrop-blur-2xl border-r border-blue-400/25 shadow-[20px_0_70px_rgba(2,8,24,0.75)] ${animClass}`}
      >
        <div className="flex items-center justify-between px-5 pt-4 md:pt-5 pb-4 border-b border-blue-400/20 bg-[#0d2248]/60">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/75">Control Center</p>
            <h2 className="text-lg font-extrabold text-white tracking-tight">Settings</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-950/60 text-blue-100 hover:border-sky-400/45 hover:bg-blue-600/30 hover:text-white transition-all"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-5 pt-5 pb-6 md:pb-5 space-y-6">
          {/* ══ Globe Controls Card ══ */}
          <section>
            <h3 className="text-[11px] font-bold text-sky-300/80 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Globe Controls
            </h3>
            <div className="bg-[#0c1f42]/85 border border-blue-400/20 rounded-2xl p-4 space-y-1 shadow-[inset_0_1px_0_rgba(191,219,254,0.06)]">
              <ToggleRow
                label="Auto Rotation"
                description="Make the globe spin automatically"
                checked={!!settings.autoRotate}
                onChange={(on) => update({ autoRotate: on })}
              />

              {settings.autoRotate && (
                <>
                  <div className="w-full border-t border-blue-400/10 my-1" />
                  <SliderRow
                    label="Rotation Speed"
                    value={settings.rotationSpeed}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(v) => update({ rotationSpeed: v })}
                  />
                </>
              )}

              <div className="w-full border-t border-blue-400/10 my-1" />

              <ToggleRow
                label="High Quality Graphics"
                description="Use native resolution for sharper globe (may consume more battery)"
                checked={!!settings.highQualityGraphics}
                onChange={(on) => update({ highQualityGraphics: on })}
              />

              <div className="w-full border-t border-blue-400/10 my-1" />

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
                  <div className="w-full border-t border-blue-400/10 my-1" />
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

              {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_MONITOR === "true") && (
                <>
                  <div className="w-full border-t border-blue-400/10 my-1" />
                  <ToggleRow
                    label="Developer Monitor"
                    description="Show performance overlay (FPS, Memory, WebGL stats)"
                    checked={!!settings.devMonitorVisible}
                    onChange={(on) => update({ devMonitorVisible: on })}
                  />
                </>
              )}

              <div className="w-full border-t border-blue-400/10 my-1" />

              <div className="flex flex-col gap-2 py-2 px-1">
                <div className="flex flex-col">
                  <span className="text-white text-base sm:text-sm font-semibold">Custom CORS Proxy</span>
                  <span className="text-blue-200/55 text-xs sm:text-[11px] leading-relaxed mt-1">
                    Enter a proxy URL (e.g., https://corsproxy.io/?) if streams fail to load.
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="https://corsproxy.io/?"
                  value={settings.customProxyUrl || ""}
                  onChange={(e) => update({ customProxyUrl: e.target.value })}
                  className="w-full bg-[#081633] border border-blue-400/25 rounded-xl px-3 py-2.5 text-sm text-white placeholder-blue-200/35 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25 transition-all"
                />
              </div>
            </div>
          </section>

          {/* ══ Playlist Configuration Card ══ */}
          <section>
            <h3 className="text-[11px] font-bold text-sky-300/80 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Playlist Configuration
            </h3>
            <div className="bg-[#0c1f42]/85 border border-blue-400/20 rounded-2xl p-4 space-y-1 shadow-[inset_0_1px_0_rgba(191,219,254,0.06)]">
              <ToggleRow
                label="Custom Playlist Mode"
                description="Switch from Globe to a custom M3U playlist"
                checked={playlist.enabled}
                onChange={(on) =>
                  onPlaylistChange({ ...playlist, enabled: on })
                }
              />

              <div className="w-full border-t border-blue-400/10 my-1" />

              <div className="py-3">
                <div className="flex items-center h-11 rounded-xl bg-[#07152e] border border-blue-400/15 p-1 gap-1">
                  <button
                    onClick={() => setAuthMode("m3u")}
                    className={`flex-1 h-full rounded-lg text-[13px] font-bold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      authMode === "m3u"
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-600/35"
                        : "text-blue-200/60 hover:text-white"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                    M3U Link
                  </button>
                  <button
                    onClick={() => setAuthMode("xtream")}
                    className={`flex-1 h-full rounded-lg text-[13px] font-bold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      authMode === "xtream"
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-600/35"
                        : "text-blue-200/60 hover:text-white"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    Xtream Login
                  </button>
                </div>
              </div>

              {authMode === "m3u" && (
                <>
                  <div className="py-2 space-y-2.5">
                    <label className="text-sm font-medium text-blue-100/75">
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
                      className="w-full h-12 rounded-xl border border-blue-400/25 bg-[#081633] px-4 text-sm text-white placeholder-blue-200/30 outline-none focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25 transition-all font-mono"
                    />
                  </div>

                  <div className="flex gap-3 py-1">
                    <button
                      onClick={() => urlDraft.trim() && onLoadPlaylist(urlDraft.trim())}
                      disabled={!urlDraft.trim() || playlistLoading}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 border border-sky-400/35 bg-gradient-to-r from-blue-600/80 to-sky-500/80 text-sm font-bold text-white hover:from-blue-500 hover:to-sky-400 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {playlistLoading ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          Load Playlist
                        </>
                      )}
                    </button>
                    <button
                      onClick={onClearPlaylist}
                      disabled={!playlist.url && playlistCount === 0}
                      className="shrink-0 flex items-center justify-center gap-2 rounded-xl h-11 px-4 border border-blue-400/20 bg-blue-950/60 text-sm font-semibold text-blue-100/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Clear
                    </button>
                  </div>
                </>
              )}

              {authMode === "xtream" && (
                <div className="py-2 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-200/60 uppercase tracking-wider ml-1">Server</label>
                    <input
                      type="text"
                      placeholder="http://live.example.tv"
                      value={xtServer}
                      onChange={(e) => setXtServer(e.target.value)}
                      className="w-full h-12 bg-[#081633] border border-blue-400/25 rounded-xl px-4 text-sm text-white placeholder-blue-200/30 outline-none focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-200/60 uppercase tracking-wider ml-1">Port</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="8080"
                      value={xtPort}
                      onChange={(e) => setXtPort(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full h-12 bg-[#081633] border border-blue-400/25 rounded-xl px-4 text-sm text-white placeholder-blue-200/30 outline-none focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-200/60 uppercase tracking-wider ml-1">Username</label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="Your username"
                      value={xtUser}
                      onChange={(e) => setXtUser(e.target.value)}
                      className="w-full h-12 bg-[#081633] border border-blue-400/25 rounded-xl px-4 text-sm text-white placeholder-blue-200/30 outline-none focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-200/60 uppercase tracking-wider ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={xtShowPass ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={xtPass}
                        onChange={(e) => setXtPass(e.target.value)}
                        className="w-full h-12 bg-[#081633] border border-blue-400/25 rounded-xl px-4 pr-12 text-sm text-white placeholder-blue-200/30 outline-none focus:border-sky-400 focus:ring-2 focus:ring-blue-500/25 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setXtShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/50 hover:text-white transition-colors cursor-pointer p-1"
                        aria-label={xtShowPass ? "Hide password" : "Show password"}
                      >
                        {xtShowPass ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
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
                    className="w-full flex items-center justify-center gap-2.5 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-sm font-bold tracking-wide shadow-lg shadow-blue-600/30 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer mt-1"
                  >
                    {playlistLoading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Authenticating…
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                        Login &amp; Load Channels
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setXtServer(""); setXtPort(""); setXtUser(""); setXtPass("");
                      onClearPlaylist();
                    }}
                    disabled={!xtServer && !xtPort && !xtUser && !xtPass && !playlist.url && playlistCount === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-xl h-11 border border-blue-400/20 bg-blue-950/40 text-sm font-medium text-blue-200/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    Clear All
                  </button>
                </div>
              )}

              {playlistError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 mt-2">
                  {playlistError}
                </div>
              )}
              {!playlistError && playlistCount > 0 && (
                <>
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center gap-2 mt-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    {playlistCount} channels loaded from playlist
                  </div>
                  {onBrowsePlaylist && (
                    <button
                      onClick={onBrowsePlaylist}
                      className="w-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold py-3 rounded-xl mt-3 transition-all active:scale-[0.98] shadow-[0_4px_18px_rgba(37,99,235,0.35)] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                      Browse Custom Playlist
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ══ Keyboard Shortcuts Card (desktop only) ══ */}
          <section className="hidden md:block">
            <h3 className="text-[11px] font-bold text-sky-300/80 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Keyboard Shortcuts
            </h3>
            <div className="bg-[#0c1f42]/85 border border-blue-400/20 rounded-2xl p-4 space-y-3">
              {[
                ["Ctrl + K", "Open Search"],
                ["↑ / ↓", "Flip Channels in Player"],
                ["Esc", "Close Panel / Modal"],
                ["N", "Toggle Day / Night"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-0.5">
                  <span className="text-sm text-blue-100/75">{desc}</span>
                  <kbd className="text-xs text-sky-200 border border-blue-400/25 rounded-lg px-2.5 py-1 bg-blue-950/70 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-sky-300/80 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Legal
            </h3>
            <div className="bg-[#0c1f42]/85 border border-blue-400/20 rounded-2xl p-4 space-y-3 text-xs text-blue-100/60 leading-relaxed">
              <p>Cortex TV does not host video content. It indexes and plays public external streams.</p>
              <p>
                Channel metadata and public stream references are attributed to{" "}
                <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">iptv-org</a>{" "}
                where used. Stream availability is controlled by the original providers.
              </p>
              <p>Some streams may be unavailable, provider-restricted, or region-restricted. Use Cortex TV at your own discretion and in accordance with local laws.</p>
              <p>Cortex TV is not affiliated with any broadcaster, streaming platform, or channel owner.</p>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-sky-300/80 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Privacy
            </h3>
            <div className="bg-[#0c1f42]/85 border border-blue-400/20 rounded-2xl p-4 space-y-3 text-xs text-blue-100/60 leading-relaxed">
              <p>Cortex TV stores preferences such as favorites, recent channels, and custom playlist settings locally on this device.</p>
              <p>The app does not require an account to browse public streams. External stream providers and source APIs may receive standard network requests when content is loaded.</p>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-sky-300/80 uppercase tracking-[0.2em] mb-2.5 ml-1">
              About
            </h3>
            <div className="bg-[#0c1f42]/85 border border-blue-400/20 rounded-2xl p-4 space-y-0">
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
    <div className="flex items-center justify-between py-2.5 border-b border-blue-400/10 last:border-0">
      <span className="text-sm text-blue-100/60">{label}</span>
      <span
        className={`text-sm font-semibold ${
          highlight
            ? "text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]"
            : "text-white/85"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
