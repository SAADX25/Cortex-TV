/* ------------------------------------------------------------------------------------------------------------------------------------------------------
   Scene.tsx --- Wraps the react-globe.gl Globe
   and forwards country-click events to the parent.
   ------------------------------------------------------------------------------------------------------------------------------------------------------ */

import { useCallback } from "react";
import Globe, { type GlobeClickInfo, type GlobeFps } from "./Globe";

interface SceneProps {
  onCountryClick?: (info: GlobeClickInfo) => void;
  isNightMode?: boolean;
  rotationSpeed?: number;
  atmosphereIntensity?: number;
  focusCountryIso?: string | null;
  selectedCountryIso?: string | null;
  globeFps?: GlobeFps;
  paused?: boolean;
  autoRotate?: boolean;
}

export default function Scene({
  onCountryClick,
  isNightMode,
  rotationSpeed,
  atmosphereIntensity,
  focusCountryIso,
  selectedCountryIso,
  globeFps,
  paused,
  autoRotate,
}: SceneProps) {
  const handleGlobeClick = useCallback(
    (info: GlobeClickInfo) => {
      if (info.country) {
        console.log(
          `%c[Cortex TV] ${info.country.name} (${info.country.iso})`,
          "color: #00ffff; font-weight: bold; font-size: 14px;"
        );
      }
      onCountryClick?.(info);
    },
    [onCountryClick]
  );

  return (
    <Globe
      onCountryClick={handleGlobeClick}
      isNightMode={isNightMode}
      rotationSpeed={rotationSpeed}
      atmosphereIntensity={atmosphereIntensity}
      focusCountryIso={focusCountryIso}
      selectedCountryIso={selectedCountryIso}
      globeFps={globeFps}
      paused={paused}
      autoRotate={autoRotate}
    />
  );
}
