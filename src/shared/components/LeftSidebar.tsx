import type { ReactNode } from "react";
import type { GlobeFps } from "@/stores/useUIStore";
import { SidebarSection } from "./SidebarSection";
import { SettingCard } from "./SettingCard";
import { SegmentedControl } from "./SegmentedControl";

interface LeftSidebarProps {
  isNightMode: boolean;
  onToggleNightMode: () => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  showNews: boolean;
  onToggleNews: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  globeFps: GlobeFps;
  onSetGlobeFps: (fps: GlobeFps) => void;
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PanelToggleIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="m15 18-6-6 6-6" />
          <path d="M20 12H9" />
        </>
      ) : (
        <>
          <path d="m9 18 6-6-6-6" />
          <path d="M4 12h11" />
        </>
      )}
    </svg>
  );
}

function MoonIcon({ night }: { night: boolean }) {
  if (night) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" /><path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function NavItem({
  label,
  detail,
  icon,
  active,
  liveBadge,
  onClick,
}: {
  label: string;
  detail?: string;
  icon: ReactNode;
  active?: boolean;
  liveBadge?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985]",
        active
          ? "border-sky-400/45 bg-gradient-to-r from-blue-600/35 via-blue-700/25 to-sky-500/15 text-white shadow-[0_6px_20px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(191,219,254,0.16)]"
          : "border-blue-400/15 bg-gradient-to-r from-[#0d2148]/70 to-[#081530]/75 text-blue-100/85 hover:border-sky-400/35 hover:from-blue-600/20 hover:to-sky-500/10 hover:text-white",
      ].join(" ")}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.85)]" />
      )}
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all",
          active
            ? "border-sky-300/40 bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-[0_2px_12px_rgba(37,99,235,0.45)]"
            : "border-blue-400/20 bg-blue-500/10 text-sky-300/85 group-hover:border-sky-400/35 group-hover:bg-blue-500/25 group-hover:text-white",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-tight text-white">{label}</span>
        {detail && (
          <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-blue-200/60 group-hover:text-blue-100/80 transition-colors">
            {detail}
          </span>
        )}
      </span>
      {liveBadge && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-400/35 bg-red-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-red-200">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
          LIVE
        </span>
      )}
      {active && !liveBadge && (
        <span className="shrink-0 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
      )}
    </button>
  );
}

export default function LeftSidebar({
  isNightMode,
  onToggleNightMode,
  showFavorites,
  onToggleFavorites,
  showNews,
  onToggleNews,
  onOpenSearch,
  onOpenSettings,
  collapsed,
  onToggleCollapsed,
  globeFps,
  onSetGlobeFps,
}: LeftSidebarProps) {
  return (
    <>
      {/* ── Fixed Logo & Collapse toggle bar ── */}
      <div className="absolute top-0 left-0 z-[70] hidden md:flex w-64 items-center justify-between border-b border-blue-400/20 border-r border-r-blue-400/15 bg-gradient-to-r from-[#0a1d42]/95 via-[#081736]/95 to-[#061129]/95 px-4 py-3 shadow-[0_8px_30px_rgba(2,8,24,0.55)] backdrop-blur-2xl rounded-br-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/35 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-lg font-black text-white shadow-[0_4px_18px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.28)]">
            C
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-black uppercase tracking-[0.16em] text-white leading-tight">Cortex TV</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-[0.22em] text-sky-300/80 leading-tight">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
              Global IPTV
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-400/25 bg-blue-500/15 text-blue-100 transition-all hover:border-sky-300/45 hover:bg-blue-500/30 hover:text-white active:scale-95"
          aria-label={collapsed ? "Open navigation" : "Close navigation"}
          title={collapsed ? "Open navigation" : "Close navigation"}
        >
          <PanelToggleIcon open={!collapsed} />
        </button>
      </div>

      {/* ── Sidebar panel ── */}
      <aside
        style={{ paddingTop: "68px" }}
        className={`cortex-hud-panel absolute bottom-0 left-0 top-0 z-50 hidden w-64 flex-col overflow-hidden rounded-r-2xl transition-transform duration-300 ease-out md:flex ${
          collapsed ? "-translate-x-[16rem]" : "translate-x-0"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pb-3">
          {/* START section */}
          <SidebarSection title="Broadcast Desk">
            <div className="space-y-1.5">
              <NavItem label="Search Channels" detail="Find any public stream" icon={<SearchIcon />} onClick={onOpenSearch} />
              <NavItem label="Favorites" detail="Saved channels" icon={<StarIcon filled={showFavorites} />} active={showFavorites} onClick={onToggleFavorites} />
              <NavItem label="Quick News" detail="Live news & channel flip" icon={<NewsIcon />} active={showNews} liveBadge onClick={onToggleNews} />
            </div>
          </SidebarSection>

          {/* MODE section */}
          <SidebarSection title="Mode">
            <SettingCard>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className="h-9 rounded-lg border border-sky-300/35 bg-gradient-to-r from-blue-600 to-sky-500 text-[12px] font-black text-white shadow-[0_4px_16px_rgba(37,99,235,0.42),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all"
                >
                  TV
                </button>
                <button
                  type="button"
                  disabled
                  className="h-9 cursor-not-allowed rounded-lg border border-blue-400/10 bg-[#061126]/60 text-[12px] font-bold text-blue-200/30 transition-all"
                  title="Radio coming soon"
                >
                  Radio
                </button>
              </div>
            </SettingCard>
          </SidebarSection>

          {/* PERFORMANCE section */}
          <SidebarSection title="Performance">
            <SettingCard>
              <div className="flex items-center justify-between px-1 pt-0.5 mb-1">
                <p className="text-[11px] font-bold text-blue-100/85">Globe FPS</p>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                  {globeFps === "auto" ? "Smart" : `${globeFps} Hz`}
                </span>
              </div>
              <p className="mb-2 px-1 text-[10px] font-medium text-blue-200/55">
                {globeFps === 60 ? "⚠ Higher GPU usage" : "Auto recommended"}
              </p>

              <SegmentedControl
                value={globeFps}
                onChange={onSetGlobeFps}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: 30, label: "30" },
                  { value: 60, label: "60", tooltip: "Smoother, higher GPU usage" },
                ]}
              />
            </SettingCard>
          </SidebarSection>
        </div>

        {/* UTILITY section — pinned neatly with padding */}
        <div className="shrink-0 border-t border-blue-400/15 bg-[#050f24]/90 px-3.5 py-3">
          <div className="space-y-1.5">
            <NavItem
              label={isNightMode ? "Day Theme" : "Night Theme"}
              detail="Globe lighting"
              icon={<MoonIcon night={isNightMode} />}
              onClick={onToggleNightMode}
            />
            <NavItem label="Settings" detail="Globe and playlist" icon={<SettingsIcon />} onClick={onOpenSettings} />
          </div>
        </div>
      </aside>
    </>
  );
}
