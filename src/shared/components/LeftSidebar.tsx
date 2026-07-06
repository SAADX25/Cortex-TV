import type { ReactNode } from "react";
import type { GlobeFps } from "@/stores/useUIStore";
import { SidebarSection } from "./SidebarSection";
import { SettingCard } from "./SettingCard";
import { SegmentedControl, type SegmentedOption } from "./SegmentedControl";
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
  onClick,
}: {
  label: string;
  detail?: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985]",
        active
          ? "border-cyan-300/30 bg-cyan-300/[0.12] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.10),inset_0_1px_0_rgba(34,211,238,0.08)]"
          : "border-white/[0.05] bg-white/[0.03] text-white/65 hover:border-cyan-300/20 hover:bg-cyan-300/[0.065] hover:text-white",
      ].join(" ")}
    >
      {/* Icon shell */}
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
          active
            ? "bg-cyan-300/[0.18] text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.18)]"
            : "bg-white/[0.05] text-white/55 group-hover:bg-cyan-300/[0.10] group-hover:text-cyan-200/80",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-none">{label}</span>
        {detail && (
          <span className="mt-0.5 block truncate text-[11px] font-medium leading-none text-white/32 group-hover:text-white/45 transition-colors">
            {detail}
          </span>
        )}
      </span>
      {active && (
        <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
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
      {/* â”€â”€ Collapse toggle button â”€â”€ */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className={`absolute top-5 z-[70] hidden h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/16 bg-[#07101f]/85 text-cyan-100/80 shadow-[0_0_24px_rgba(34,211,238,0.14)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-200/34 hover:bg-cyan-300/10 hover:text-cyan-100 md:flex ${collapsed ? "left-4" : "left-[14.5rem]"}`}
        aria-label={collapsed ? "Open navigation" : "Close navigation"}
        title={collapsed ? "Open navigation" : "Close navigation"}
      >
        <PanelToggleIcon open={!collapsed} />
      </button>

      {/* â”€â”€ Sidebar panel â”€â”€ */}
      <aside
        className={`cortex-hud-panel absolute bottom-0 left-0 top-0 z-50 hidden w-56 flex-col overflow-hidden rounded-r-2xl transition-transform duration-300 ease-out md:flex ${
          collapsed ? "-translate-x-[14rem]" : "translate-x-0"
        }`}
      >
        {/* Logo / brand */}
        <div className="shrink-0 px-3 pt-4 pb-3">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.10] text-base font-black text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.14)]">
              C
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black uppercase tracking-[0.16em] text-white">Cortex TV</p>
              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-300/40">Global IPTV</p>
            </div>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-cyan-300/12 to-transparent" />
        </div>

        {/* START section */}
        <SidebarSection title="Start">
          <div className="space-y-1">
            <NavItem label="Search Channels" detail="Find any public stream" icon={<SearchIcon />} onClick={onOpenSearch} />
            <NavItem label="Favorites" detail="Saved channels" icon={<StarIcon filled={showFavorites} />} active={showFavorites} onClick={onToggleFavorites} />
            <NavItem label="Quick News" detail="Live news index" icon={<NewsIcon />} active={showNews} onClick={onToggleNews} />
          </div>
        </SidebarSection>

        {/* MODE section */}
        <SidebarSection title="Mode">
          <SettingCard>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                className="h-9 rounded-lg bg-cyan-300 text-[12px] font-black text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.24)] transition-all"
              >
                TV
              </button>
              <button
                type="button"
                disabled
                className="h-9 cursor-not-allowed rounded-lg text-[12px] font-bold text-white/28 transition-all"
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
            <p className="mb-1.5 px-1 pt-0.5 text-[11px] font-semibold text-white/60">Globe FPS</p>
            <p className="mb-2 px-1 text-[10px] font-medium text-white/30">
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* UTILITY section */}
        <div className="shrink-0 px-3 pb-4">
          <div className="mb-1.5 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
          <div className="space-y-1 pt-2">
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
