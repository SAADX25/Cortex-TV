import type { ChannelWithStream } from "@/shared/types";
import { ErrorControls } from "./PlayerControls";

export function BrokenTvIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="15" x2="18" y2="15" />
      <line x1="11" y1="18" x2="16" y2="18" />
      <line x1="4" y1="4" x2="20" y2="20" className="text-red-400" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

interface PlayerErrorViewProps {
  isMobile: boolean;
  errorTitle: string;
  errorMsg: string;
  retryCount: number;
  maxRetries: number;
  reportCopied: boolean;
  channel: ChannelWithStream;
  onRetry: () => void;
  onReport: () => void;
  onClose: () => void;
}

export default function PlayerErrorView({
  isMobile,
  errorTitle,
  errorMsg,
  retryCount,
  maxRetries,
  reportCopied,
  channel,
  onRetry,
  onReport,
  onClose,
}: PlayerErrorViewProps) {
  if (isMobile) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black px-5">
        <div className="relative p-2.5 rounded-xl bg-white/[0.03] border border-white/5 mb-2.5">
          <BrokenTvIcon className="text-red-400/70 !w-8 !h-8" />
        </div>
        <p className="text-xs font-semibold text-white/70 text-center">
          {errorTitle || "Stream unavailable"}
        </p>
        <p className="text-[10px] text-white/30 text-center mt-1 leading-snug max-w-[260px]">
          {errorMsg || "Stream unavailable. Try another channel."}
        </p>
        <ErrorControls
          isMobile={true}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={onRetry}
          onReport={onReport}
          onClose={onClose}
        />
        {reportCopied && <p className="mt-2 text-[10px] font-semibold text-amber-100/70">Report details copied.</p>}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black via-black/95 to-black animate-modal-in rounded-xl">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: "150px 150px",
      }} />
      <div className="relative flex flex-col items-center text-center px-8 max-w-lg">
        <div className="relative mb-6">
          <div className="absolute inset-0 -m-4 rounded-full bg-red-500/5 blur-xl animate-pulse" />
          <div className="relative p-5 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            <BrokenTvIcon className="text-red-400/70" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white/80 tracking-wide">
          {errorTitle || "Stream unavailable"}
        </h2>
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent mt-3 mb-4" />
        <p className="text-sm text-white/35 leading-relaxed">
          {errorMsg || "Stream unavailable. Try another channel."}
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/5 px-4 py-2">
          {channel.logo && <img src={channel.logo} alt="" className="h-5 w-5 rounded object-contain" />}
          <span className="text-xs text-white/40 truncate max-w-[200px]">{channel.name}</span>
          {channel.country && <span className="text-[10px] text-white/20 uppercase">{channel.country}</span>}
        </div>
        <ErrorControls
          isMobile={false}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={onRetry}
          onReport={onReport}
          onClose={onClose}
        />
        {reportCopied && <p className="mt-3 text-[10px] font-semibold text-amber-100/70">Report details copied.</p>}
        {retryCount >= maxRetries && (
          <p className="mt-4 text-[10px] text-white/15">Max retries reached. Try a different channel.</p>
        )}
      </div>
    </div>
  );
}
