import { useMemo } from "react";
import type Hls from "hls.js";

export function usePlayerQuality(hls: Hls | null) {
  return useMemo(() => {
    const levels = hls?.levels ?? [];
    return levels.map((level, index) => ({
      index,
      height: level.height,
      bitrate: level.bitrate,
    }));
  }, [hls]);
}
