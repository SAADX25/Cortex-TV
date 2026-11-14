export type GlobeFps = "auto" | 30 | 60;

/**
 * Determine effective WebGL frame rate cap.
 * "auto" adapts: 60 fps during active drag/fly-to motion, 24 fps during passive auto-rotate,
 * and 20 fps during brief post-interaction settle before idle sleep.
 */
export function resolveTargetFps(
  globeFps: GlobeFps,
  isHighPriorityMotion: boolean,
  autoRotate: boolean
): number {
  if (globeFps === 30) return 30;
  if (globeFps === 60) return 60;
  if (isHighPriorityMotion) return 60;
  return autoRotate ? 24 : 20;
}

/**
 * Cap WebGL pixel ratio so standard/auto renders crisp 1x while HiDPI High-Quality caps at 2x
 * (avoiding 9x fragment shading load on 3x displays).
 */
export function resolvePixelRatio(
  devicePixelRatio: number,
  _globeFps: GlobeFps,
  highQualityGraphics: boolean
): number {
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return highQualityGraphics ? Math.min(safeDpr, 2) : Math.min(safeDpr, 1);
}

/**
 * Gate WebGL render calls to target FPS with a 1.5ms VSync jitter tolerance so 60Hz displays
 * do not alternate-drop down to 30fps.
 */
export function shouldRenderFrame(
  nowMs: number,
  lastRenderMs: number,
  targetFps: number,
  forceFrame: boolean
): boolean {
  if (forceFrame || lastRenderMs <= 0) return true;
  const minIntervalMs = 1000 / Math.max(1, targetFps) - 1.5;
  return nowMs - lastRenderMs >= minIntervalMs;
}

