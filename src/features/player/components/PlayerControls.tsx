import type { ChannelWithStream } from "@/shared/types";

interface FloatingControlsProps {
  isMobile: boolean;
  onClose: () => void;
  channel?: ChannelWithStream;
  isFav?: boolean;
  onToggleFavorite?: (ch: ChannelWithStream) => void;
}

export function FloatingControls({ isMobile, onClose, channel, isFav, onToggleFavorite }: FloatingControlsProps) {
  if (isMobile) {
    return (
      <button
        onClick={onClose}
        className="fixed bottom-[5.5rem] left-1/2 z-[10000] -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-cyan-400/20 bg-[#0A192F]/90 backdrop-blur-md text-cyan-50 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all hover:bg-[#0f2444] hover:text-white hover:border-cyan-400/40 active:scale-95"
        aria-label="Close player"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-[10] flex items-center gap-2">
      {onToggleFavorite && channel && (
        <button
          onClick={() => onToggleFavorite(channel)}
          className={`p-2.5 rounded-full backdrop-blur-md border transition-all cursor-pointer active:scale-90 ${
            isFav
              ? "bg-amber-400/20 border-amber-400/40 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
              : "bg-black/60 border-white/10 text-white/60 hover:text-amber-400 hover:border-amber-400/30 hover:bg-amber-400/10"
          }`}
          title={isFav ? "Remove from favourites" : "Add to favourites"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill={isFav ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}

      <button
        onClick={onClose}
        className="p-2.5 rounded-full bg-red-500/90 hover:bg-red-500 border border-red-400/40 text-white backdrop-blur-md transition-all cursor-pointer active:scale-90 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
        title="Close player"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

interface ErrorControlsProps {
  isMobile: boolean;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onReport: () => void;
  onClose: () => void;
}

export function ErrorControls({ isMobile, retryCount, maxRetries, onRetry, onReport, onClose }: ErrorControlsProps) {
  if (isMobile) {
    return (
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {retryCount < maxRetries && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-400 text-[11px] font-medium active:scale-95 transition-transform flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Retry
          </button>
        )}
        <button
          onClick={onReport}
          className="px-3 py-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-100/80 text-[11px] font-medium active:scale-95 transition-transform"
        >
          Report broken stream
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/50 text-[11px] font-medium active:scale-95 transition-transform"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
      {retryCount < maxRetries && (
        <button onClick={onRetry} className="px-5 py-2.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
          Retry Stream
        </button>
      )}
      <button onClick={onReport} className="px-5 py-2.5 rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-100/80 text-sm font-medium hover:bg-amber-300/15 transition-all cursor-pointer">
        Report broken stream
      </button>
      <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10 transition-all cursor-pointer">
        Back to channels
      </button>
    </div>
  );
}
