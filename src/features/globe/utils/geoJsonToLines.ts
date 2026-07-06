/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   geoJsonToLines.ts
   Convert GeoJSON country-border polygons â†’ Float32Array
   of line-segment vertex pairs on a sphere of given radius.

   Also exports per-country polygon arrays for raycasting.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

import * as THREE from "three";

/** Degrees â†’ radians */
const DEG2RAD = Math.PI / 180;

/**
 * Convert [longitude, latitude] â†’ THREE.Vector3 on a unit sphere.
 */
export function latLonToVec3(
  lon: number,
  lat: number,
  radius: number = 1
): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Convert 3D point on the unit sphere back to [lon, lat].
 */
export function vec3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const r = v.length();
  const lat = 90 - Math.acos(v.y / r) / DEG2RAD;
  const lon = -(Math.atan2(v.z, -v.x) / DEG2RAD) - 180;
  return {
    lat,
    lon: lon < -180 ? lon + 360 : lon > 180 ? lon - 360 : lon,
  };
}

/* â”€â”€ Aggregated line-segment geometry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function geoJsonToLineSegments(
  geoJson: GeoJSON.FeatureCollection,
  radius: number = 1.002
): Float32Array {
  const verts: number[] = [];

  const pushRing = (coords: number[][]) => {
    for (let i = 0; i < coords.length - 1; i++) {
      const a = latLonToVec3(coords[i][0], coords[i][1], radius);
      const b = latLonToVec3(coords[i + 1][0], coords[i + 1][1], radius);
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };

  for (const feature of geoJson.features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      for (const ring of (geom as GeoJSON.Polygon).coordinates) {
        pushRing(ring);
      }
    } else if (geom.type === "MultiPolygon") {
      for (const polygon of (geom as GeoJSON.MultiPolygon).coordinates) {
        for (const ring of polygon) {
          pushRing(ring);
        }
      }
    }
  }

  return new Float32Array(verts);
}

/* â”€â”€ Per-country data for raycasting / hit-testing â”€â”€â”€â”€â”€â”€â”€ */

export interface CountryPolygon {
  /** Country name from properties (NAME, ADMIN, or name) */
  name: string;
  /** ISO-A3 code if available */
  iso: string;
  /** Flat rings: array of Vector3 arrays */
  rings: THREE.Vector3[][];
}

/**
 * Build per-country polygon rings so we can point-in-polygon
 * test a clicked 3D point to resolve which country was hit.
 */
export function buildCountryPolygons(
  geoJson: GeoJSON.FeatureCollection,
  radius: number = 1
): CountryPolygon[] {
  const countries: CountryPolygon[] = [];

  for (const feature of geoJson.features) {
    const props = feature.properties as Record<string, string>;
    const name = props.ADMIN || props.NAME || props.name || "Unknown";
    const iso = props.ISO_A3 || props.iso_a3 || props.ISO || "";
    const geom = feature.geometry;

    const rings: THREE.Vector3[][] = [];

    const addRings = (coordRings: number[][][]) => {
      for (const ring of coordRings) {
        rings.push(ring.map((c) => latLonToVec3(c[0], c[1], radius)));
      }
    };

    if (geom.type === "Polygon") {
      addRings((geom as GeoJSON.Polygon).coordinates);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of (geom as GeoJSON.MultiPolygon).coordinates) {
        addRings(poly);
      }
    }

    if (rings.length > 0) {
      countries.push({ name, iso, rings });
    }
  }

  return countries;
}
