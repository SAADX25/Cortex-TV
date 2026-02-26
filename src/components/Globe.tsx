/* ──────────────────────────────────────────────
   Globe.tsx – Interactive 3D Globe using react-globe.gl
   Neon-styled country polygons with CDN textures.
   ────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback } from "react";
import GlobeGL from "react-globe.gl";

/* ── CDN asset URLs ── */
const GLOBE_DAY_URL =
  "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const GLOBE_NIGHT_URL =
  "//unpkg.com/three-globe/example/img/earth-night.jpg";
const BUMP_IMAGE_URL =
  "//unpkg.com/three-globe/example/img/earth-topology.png";
const NIGHT_SKY_URL =
  "//unpkg.com/three-globe/example/img/night-sky.png";
const GEOJSON_URL =
  "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

/* ── Public types ── */
export interface CountryInfo {
  name: string;
  iso: string;
}

export interface GlobeClickInfo {
  country: CountryInfo | null;
}

interface GlobeProps {
  onCountryClick?: (info: GlobeClickInfo) => void;
  isNightMode?: boolean;
}

export default function Globe({ onCountryClick, isNightMode = false }: GlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [hovered, setHovered] = useState<any | null>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [loading, setLoading] = useState(true);

  /* ── Responsive resize ── */
  useEffect(() => {
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Fetch country polygons ── */
  useEffect(() => {
    console.log("[Globe] Fetching country GeoJSON from CDN…");
    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log(
          `[Globe] GeoJSON loaded: ${data.features.length} countries`
        );
        setCountries(data.features);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Globe] GeoJSON load error:", err);
        setLoading(false);
      });
  }, []);

  /* ── Globe scene tweaks (auto-rotate, etc.) ── */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enablePan = false;
    controls.minDistance = 150;
    controls.maxDistance = 500;

    // Slight initial tilt for a nicer default view
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
  }, []);

  /* ── Country click handler ── */
  const handlePolygonClick = useCallback(
    (polygon: any) => {
      if (!polygon) return;
      const props = polygon.properties ?? {};
      const name = props.ADMIN || props.NAME || "Unknown";
      const iso = props.ISO_A2 || props.ISO_A3 || "";

      console.log(
        `%c[Cortex TV] ${name} (${iso})`,
        "color: #00ffff; font-weight: bold; font-size: 14px;"
      );

      onCountryClick?.({ country: { name, iso } });
    },
    [onCountryClick]
  );

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      {/* ── Loading overlay ── */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            background: "black",
          }}
        >
          <span
            style={{
              color: "#00ffff",
              fontSize: 24,
              fontWeight: "bold",
              textShadow: "0 0 12px rgba(0,255,255,0.8)",
            }}
          >
            Loading Globe…
          </span>
        </div>
      )}

      <GlobeGL
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        /* ── Textures ── */
        globeImageUrl={isNightMode ? GLOBE_NIGHT_URL : GLOBE_DAY_URL}
        bumpImageUrl={BUMP_IMAGE_URL}
        /* ── Scene ── */
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={isNightMode ? NIGHT_SKY_URL : undefined}
        atmosphereColor={isNightMode ? "#0066cc" : "#00bfff"}
        atmosphereAltitude={0.25}
        animateIn={true}
        /* ── Country polygons ── */
        polygonsData={countries}
        polygonCapColor={(d: any) =>
          d === hovered
            ? "rgba(0, 255, 255, 0.15)"
            : "rgba(0, 255, 255, 0.02)"
        }
        polygonSideColor={() => "rgba(0, 255, 255, 0.05)"}
        polygonStrokeColor={() => "#00ffff"}
        polygonAltitude={(d: any) => (d === hovered ? 0.02 : 0.005)}
        polygonLabel={(d: any) => {
          const name =
            d?.properties?.ADMIN || d?.properties?.NAME || "";
          return `<div style="
            color: #00ffff;
            text-shadow: 0 0 6px rgba(0,255,255,0.8);
            font-family: Inter, system-ui, sans-serif;
            font-size: 14px;
            font-weight: bold;
            padding: 4px 8px;
            background: rgba(0,0,0,0.6);
            border: 1px solid rgba(0,255,255,0.3);
            border-radius: 4px;
          ">${name}</div>`;
        }}
        /* ── Interaction ── */
        onPolygonHover={(polygon: any) => setHovered(polygon)}
        onPolygonClick={handlePolygonClick}
        /* ── Performance ── */
        polygonsTransitionDuration={300}
      />
    </div>
  );
}
