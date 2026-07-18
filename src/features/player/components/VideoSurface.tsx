import { forwardRef } from "react";
import type { ChannelWithStream } from "@/shared/types";
import PlayerLoadingView from "./PlayerLoadingView";
import PlayerErrorView from "./PlayerErrorView";

interface VideoSurfaceProps {
  isMobile: boolean;
  isLandscape: boolean;
  channel: ChannelWithStream;
  status: "loading" | "playing" | "error";
  resolving: boolean;
  retryCount: number;
  maxRetries: number;
  errorTitle: string;
  errorMsg: string;
  reportCopied: boolean;
  showDebug: boolean;
  debugLog: string[];
  onRetry: () => void;
  onReport: () => void;
  onClose: () => void;
  onPlaying: () => void;
  toggleDebug: () => void;
}

const VideoSurface = forwardRef<HTMLVideoElement, VideoSurfaceProps>(({
  isMobile,
  isLandscape,
  channel,
  status,
  resolving,
  retryCount,
  maxRetries,
  errorTitle,
  errorMsg,
  reportCopied,
  showDebug,
  debugLog,
  onRetry,
  onReport,
  onClose,
  onPlaying,
  toggleDebug,
}, ref) => {
  return (
    <div
      className={
        isMobile
          ? isLandscape
            ? "absolute inset-0 bg-black flex flex-col items-center justify-center overflow-hidden"
            : "relative w-full aspect-video max-h-[40vh] bg-black flex flex-col items-center justify-center overflow-hidden"
          : "absolute inset-0 flex flex-col items-center justify-center overflow-hidden" // Desktop video area takes full parent via absolute
      }
    >
      {resolving && (
        <PlayerLoadingView
          tone="purple"
          desktop={!isMobile}
          message="Resolving secure stream…"
          detail={!isMobile ? channel.streamUrl : undefined}
        />
      )}

      {!resolving && status === "loading" && (
        <PlayerLoadingView
          tone="cyan"
          desktop={!isMobile}
          message={retryCount > 0 ? (isMobile ? `Retrying… (${retryCount + 1})` : `Retrying connection… (attempt ${retryCount + 1})`) : (isMobile ? "Connecting…" : "Connecting to stream…")}
          detail={!isMobile ? channel.streamUrl : undefined}
        />
      )}

      {status === "error" && (
        <PlayerErrorView
          isMobile={isMobile}
          errorTitle={errorTitle}
          errorMsg={errorMsg}
          retryCount={retryCount}
          maxRetries={maxRetries}
          reportCopied={reportCopied}
          channel={channel}
          onRetry={onRetry}
          onReport={onReport}
          onClose={onClose}
        />
      )}

      {/* Audio-only fallback artwork */}
      {isMobile && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center pointer-events-none select-none">
          {channel.logo ? (
            <img src={channel.logo} alt="" className="h-16 w-16 rounded-xl object-contain opacity-30" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-white/15">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
          <p className="mt-2 text-[10px] text-white/20 tracking-wide uppercase">Audio Stream</p>
        </div>
      )}

      <video
        ref={ref}
        className={isMobile ? "absolute inset-0 z-[2] w-full h-full object-contain bg-transparent" : "w-full h-full object-contain bg-black"}
        style={{ objectFit: "contain" }}
        controls={true}
        autoPlay
        playsInline
        onPlaying={onPlaying}
      />

      {/* ── Debug overlay ── */}
      {import.meta.env.DEV && (
        <>
          <button
            onClick={toggleDebug}
            className={`absolute z-[20] ${isMobile ? "bottom-2 right-2 bg-black/70 px-2 py-1 rounded border border-yellow-500/30" : "bottom-3 right-3 bg-black/70 hover:text-yellow-400 px-2 py-1 rounded border border-yellow-500/20 transition-colors"} text-[9px] ${isMobile ? "text-yellow-400" : "text-yellow-400/60"}`}
          >
            {showDebug ? "Hide Log" : "🐛" + (isMobile ? " Debug" : "")}
          </button>
          {showDebug && (
            <div className={`absolute inset-x-0 bottom-8 z-[20] overflow-y-auto bg-black/90 border-t border-yellow-500/30 p-2 ${isMobile ? "max-h-[40%]" : "max-h-[35%] rounded-b-xl"}`}>
              {debugLog.length === 0 ? (
                <p className="text-[9px] text-white/30">No log entries yet…</p>
              ) : debugLog.map((line, i) => (
                <p key={i} className="text-[9px] text-green-400/80 font-mono leading-relaxed">{line}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default VideoSurface;
