import { useEffect, useState } from "react";

export function usePlayerFullscreen() {
  const [isMobile] = useState(
    () => Math.min(window.screen.width, window.screen.height) < 768,
  );
  const [isLandscape, setIsLandscape] = useState(
    () => window.matchMedia("(orientation: landscape)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");
    const handler = (event: MediaQueryListEvent) => setIsLandscape(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return { isMobile, isLandscape };
}
