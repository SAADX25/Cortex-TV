import { useEffect, useState } from "react";
import { useUIStore, type GlobeFps } from "@/stores/useUIStore";

interface DebugStats {
  geometries: number;
  textures: number;
  fpsMode: GlobeFps;
  heapMb: number | null;
}

export function DebugPanel() {
  const isDevEnabled = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_MONITOR === "true";

  const { globeFps, devMonitorVisible } = useUIStore((s) => s.globeSettings);
  const setGlobeSettings = useUIStore((s) => s.setGlobeSettings);

  const [isExpanded, setIsExpanded] = useState(false);

  const [stats, setStats] = useState<DebugStats>({
    geometries: 0,
    textures: 0,
    fpsMode: globeFps,
    heapMb: null,
  });

  // Toggle visibility with Ctrl+Shift+D
  useEffect(() => {
    if (!isDevEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setGlobeSettings({
          ...useUIStore.getState().globeSettings,
          devMonitorVisible: !useUIStore.getState().globeSettings.devMonitorVisible,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDevEnabled, setGlobeSettings]);

  // Polling for stats
  useEffect(() => {
    if (!isDevEnabled || !devMonitorVisible) return;

    const interval = setInterval(() => {
      let geometries = 0;
      let textures = 0;
      let heapMb: number | null = null;

      if ((window as any).__cortexGlobeRendererInfo) {
        const info = (window as any).__cortexGlobeRendererInfo;
        geometries = info.geometries || 0;
        textures = info.textures || 0;
      }

      const perf = performance as any;
      if (perf.memory) {
        heapMb = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
      }

      setStats({ geometries, textures, fpsMode: globeFps, heapMb });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDevEnabled, devMonitorVisible, globeFps]);

  // Completely remove from DOM in normal prod or if toggled off
  if (!isDevEnabled || !devMonitorVisible) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 ${isExpanded ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {!isExpanded ? (
        <button 
          onClick={() => setIsExpanded(true)}
          className="pointer-events-auto flex h-6 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-950/40 px-2.5 text-[9px] font-black tracking-widest text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)] backdrop-blur-md transition-all hover:bg-cyan-900/60 hover:text-cyan-300"
        >
          PERF
        </button>
      ) : (
        <div 
          onClick={() => setIsExpanded(false)}
          className="pointer-events-auto cursor-pointer rounded-xl border border-white/[0.08] bg-slate-950/60 p-3.5 text-[10px] font-mono text-cyan-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all hover:bg-slate-900/70"
          title="Click to collapse"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-widest text-cyan-400 uppercase">Dev Monitor</span>
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] animate-pulse" />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5">
            <span className="text-white/40">FPS Mode:</span> <span className="text-right font-semibold text-white/90">{stats.fpsMode}</span>
            <span className="text-white/40">Geometries:</span> <span className="text-right font-semibold text-white/90">{stats.geometries}</span>
            <span className="text-white/40">Textures:</span> <span className="text-right font-semibold text-white/90">{stats.textures}</span>
            <span className="text-white/40">JS Heap:</span> <span className="text-right font-semibold text-white/90">{stats.heapMb !== null ? `${stats.heapMb} MB` : "N/A"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
