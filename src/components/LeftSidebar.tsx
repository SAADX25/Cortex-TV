/* ──────────────────────────────────────────────
   LeftSidebar.tsx – Floating vertical toolbar
   Glassmorphic pill with placeholder tool buttons.
   ────────────────────────────────────────────── */

/* ── Inline SVG icons (Lucide-style) ── */
function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* ── Toolbar item ── */
interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function ToolButton({ icon, label, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center justify-center h-10 w-10 rounded-xl text-white/50 hover:text-cyan-400 hover:scale-110 hover:shadow-[0_0_14px_rgba(0,255,255,0.25)] cursor-pointer transition-all duration-300"
      title={label}
    >
      {icon}
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-xs font-medium text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm border border-white/10">
        {label}
      </span>
    </button>
  );
}

/* ── Sidebar ── */
interface LeftSidebarProps {
  isNightMode: boolean;
  onToggleNightMode: () => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export default function LeftSidebar({
  isNightMode,
  onToggleNightMode,
  showFavorites,
  onToggleFavorites,
  onOpenSearch,
  onOpenSettings,
}: LeftSidebarProps) {
  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 p-3 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      {/* Day / Night toggle */}
      <ToolButton
        icon={
          isNightMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )
        }
        label={isNightMode ? "Switch to Day" : "Switch to Night"}
        onClick={onToggleNightMode}
      />

      {/* Divider */}
      <div className="w-5 border-t border-white/10" />

      <ToolButton icon={<SearchIcon />} label="Search" onClick={onOpenSearch} />
      <ToolButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
            fill={showFavorites ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={showFavorites ? "text-cyan-400" : ""}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        }
        label="Favorites"
        onClick={onToggleFavorites}
      />
      <ToolButton icon={<WrenchIcon />} label="Tools" />

      {/* Divider */}
      <div className="w-5 border-t border-white/10" />

      <ToolButton icon={<SettingsIcon />} label="Settings" onClick={onOpenSettings} />
    </div>
  );
}
