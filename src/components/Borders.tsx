/* ──────────────────────────────────────────────
   Borders.tsx – Neon GeoJSON country borders
   Glowing cyan lines rendered just above the
   globe surface using LineSegments.
   ────────────────────────────────────────────── */

import { useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { geoJsonToLineSegments } from "../utils/geoJsonToLines";

const BORDER_COLOR = new THREE.Color("#00ffff");

interface BordersProps {
  geoJsonUrl?: string;
  radius?: number;
  opacity?: number;
}

export default function Borders({
  geoJsonUrl = `${import.meta.env.BASE_URL}geo/countries.geojson`,
  radius = 1.002,
  opacity = 0.65,
}: BordersProps) {
  const [positions, setPositions] = useState<Float32Array | null>(null);

  useEffect(() => {
    fetch(geoJsonUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${geoJsonUrl}`);
        return res.json();
      })
      .then((json: GeoJSON.FeatureCollection) => {
        setPositions(geoJsonToLineSegments(json, radius));
      })
      .catch((err) => console.error("[Borders]", err));
  }, [geoJsonUrl, radius]);

  const geometry = useMemo(() => {
    if (!positions) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        color={BORDER_COLOR}
        transparent
        opacity={opacity}
        linewidth={1}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
