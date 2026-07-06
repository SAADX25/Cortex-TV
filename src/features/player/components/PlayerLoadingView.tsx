interface PlayerLoadingViewProps {
  tone?: "cyan" | "purple";
  message: string;
  detail?: string | null;
  desktop?: boolean;
}

export default function PlayerLoadingView({
  tone = "cyan",
  message,
  detail,
  desktop = false,
}: PlayerLoadingViewProps) {
  const color = tone === "purple" ? "purple" : "cyan";

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 ${desktop ? "animate-modal-in rounded-xl" : ""}`}>
      <div className="relative">
        <div className={`rounded-full border-2 border-${color}-400/20 border-t-${color}-400 animate-spin ${desktop ? "h-12 w-12" : "h-9 w-9"}`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`rounded-full bg-${color}-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] ${desktop ? "h-2 w-2" : "h-1.5 w-1.5"}`} />
        </div>
      </div>
      <p className={`${desktop ? "mt-5 text-sm" : "mt-2.5 text-[11px] px-6 text-center"} text-white/50`}>{message}</p>
      {detail && <p className="mt-1 max-w-xs truncate text-[10px] font-mono text-white/20">{detail}</p>}
    </div>
  );
}
