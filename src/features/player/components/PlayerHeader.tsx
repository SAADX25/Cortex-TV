interface PlayerHeaderProps {
  isLandscape: boolean;
  channelName: string;
  channelCategories: string[];
  channelLogo?: string | null;
  status: "loading" | "playing" | "error";
  onClose: () => void;
}

export default function PlayerHeader({
  isLandscape,
  channelName,
  channelCategories,
  channelLogo,
  status,
  onClose,
}: PlayerHeaderProps) {
  return (
    <div
      className={
        isLandscape
          ? "absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-4 py-3 pt-[max(var(--cortex-safe-top),3rem)] bg-gradient-to-b from-black/80 to-transparent"
          : "relative z-[3] flex items-center gap-3 px-3 py-2 pt-[max(var(--cortex-safe-top),0.5rem)] bg-black/90 backdrop-blur-md border-b border-white/5 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      }
    >
      {channelLogo && (
        <img
          src={channelLogo}
          alt=""
          className="h-7 w-7 shrink-0 rounded bg-white/5 object-contain"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">{channelName}</p>
        {channelCategories.length > 0 && (
          <p className="text-[9px] text-cyan-400/50 uppercase tracking-wider truncate">
            {channelCategories.slice(0, 2).join(" · ")}
          </p>
        )}
      </div>
      <div
        className={`shrink-0 h-1.5 w-1.5 rounded-full ${
          status === "playing"
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
            : status === "loading"
            ? "bg-yellow-400 animate-pulse"
            : "bg-red-400"
        }`}
      />
      <button
        onClick={onClose}
        className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white active:scale-95 transition-all"
        title="Stop & close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
