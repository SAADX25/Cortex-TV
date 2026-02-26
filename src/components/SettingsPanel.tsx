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
}

/* ── Reusable slider row ── */
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
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/60">{label}</span>
        <span className="text-xs font-mono text-cyan-400/80">
          {value.toFixed(2)}
          {unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="settings-slider w-full"
      />
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
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div className="min-w-0">
        <p className="text-xs font-medium text-white/60 group-hover:text-white/80 transition-colors">
          {label}
        </p>
        {description && (
          <p className="text-[10px] text-white/30 mt-0.5">{description}</p>
        )}
      </div>
      <div
        className={`relative shrink-0 h-5 w-9 rounded-full transition-colors duration-300 ${
          checked
            ? "bg-cyan-500/60 shadow-[0_0_10px_rgba(0,255,255,0.3)]"
            : "bg-white/10"
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${
            checked ? "translate-x-4" : "translate-x-0.5"
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
}: SettingsPanelProps) {
  const [closing, setClosing] = useState(false);
  const [glowEnabled, setGlowEnabled] = useState(settings.atmosphereIntensity > 0.08);
  const [urlDraft, setUrlDraft] = useState(playlist.url);
  const urlInputRef = useRef<HTMLInputElement>(null);

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
      className={`fixed inset-0 z-[190] ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
      onClick={handleClose}
    >
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-y-0 left-0 w-[340px] max-w-[85vw] flex flex-col bg-black/70 backdrop-blur-2xl border-r border-white/10 shadow-[20px_0_60px_rgba(0,0,0,0.5)] ${animClass}`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/70">
              Settings
            </p>
            <h2 className="text-lg font-semibold text-white mt-0.5">
              Cortex TV
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
          {/* Globe Controls */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/50 mb-4">
              Globe Controls
            </h3>
            <div className="space-y-5">
              <SliderRow
                label="Rotation Speed"
                value={settings.rotationSpeed}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => update({ rotationSpeed: v })}
              />

              <div className="w-full border-t border-white/5" />

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
                <SliderRow
                  label="Glow Intensity"
                  value={settings.atmosphereIntensity}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  onChange={(v) => update({ atmosphereIntensity: v })}
                />
              )}
            </div>
          </section>

          {/* Divider */}
          <div className="w-full border-t border-white/5" />

          {/* ── Playlist Configuration ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/50 mb-4">
              Playlist Configuration
            </h3>
            <div className="space-y-4">
              {/* Mode toggle */}
              <ToggleRow
                label="Custom Playlist Mode"
                description="Switch from Globe to a custom M3U playlist"
                checked={playlist.enabled}
                onChange={(on) =>
                  onPlaylistChange({ ...playlist, enabled: on })
                }
              />

              {/* M3U URL input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/60">
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
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-colors font-mono"
                />
              </div>

              {/* Load / Clear buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => urlDraft.trim() && onLoadPlaylist(urlDraft.trim())}
                  disabled={!urlDraft.trim() || playlistLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {playlistLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Load
                    </>
                  )}
                </button>
                <button
                  onClick={onClearPlaylist}
                  disabled={!playlist.url && playlistCount === 0}
                  className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Clear
                </button>
              </div>

              {/* Status */}
              {playlistError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-400">
                  {playlistError}
                </div>
              )}
              {!playlistError && playlistCount > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-400 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  {playlistCount} channels loaded from playlist
                </div>
              )}
            </div>
          </section>

          {/* Divider */}
          <div className="w-full border-t border-white/5" />

          {/* Keyboard shortcuts */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/50 mb-4">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2.5">
              {[
                ["Ctrl + K", "Open Search"],
                ["Esc", "Close Panel / Modal"],
                ["N", "Toggle Day / Night"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{desc}</span>
                  <kbd className="text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5 bg-white/5 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="w-full border-t border-white/5" />

          {/* Technical Info */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/50 mb-4">
              Technical Info
            </h3>
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
              <InfoRow label="Developer" value="SAADX25" highlight />
              <InfoRow label="App Version" value="1.0.0" />
              <InfoRow label="Framework" value="Electron + React 19" />
              <InfoRow label="Globe Engine" value="react-globe.gl" />
              <InfoRow label="Player" value="hls.js (native)" />
              <InfoRow label="Data Source" value="iptv-org API" />
              <InfoRow label="UI" value="Tailwind CSS v4" />
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.5)]" />
            <span className="text-[10px] text-white/30">
              Cortex TV &middot; Built by{" "}
              <span className="text-cyan-400/60 font-medium">SAADX25</span>
            </span>
          </div>
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
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/30">{label}</span>
      <span
        className={`text-[11px] font-medium ${
          highlight
            ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(0,255,255,0.5)]"
            : "text-white/60"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
