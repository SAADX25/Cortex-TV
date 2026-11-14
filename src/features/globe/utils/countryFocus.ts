import { A3_TO_A2 } from "../data/geoData";

export interface CountryFocusTarget {
  iso: string;
  lat: number;
  lng: number;
  altitude: number;
  ringRadius: number;
}

interface RingMetrics {
  lat: number;
  lng: number;
  latSpan: number;
  lngSpan: number;
  surfaceScore: number;
}

const GLOBE_ISO_ALIASES: Record<string, string> = {
  UK: "GB",
  EL: "GR",
  FX: "FR",
};

/** Normalize IPTV / GeoJSON country codes so aliases like UK <-> GB match cleanly. */
export function normalizeGlobeIso(iso?: string | null): string {
  const cleaned = (iso ?? "").trim().toUpperCase();
  if (!cleaned || cleaned === "-99") return "";
  return GLOBE_ISO_ALIASES[cleaned] ?? cleaned;
}

/** True when two ISO country codes represent the same country/territory. */
export function isoMatches(a?: string | null, b?: string | null): boolean {
  const normA = normalizeGlobeIso(a);
  const normB = normalizeGlobeIso(b);
  return normA.length > 0 && normA === normB;
}

/** Find a GeoJSON country feature by ISO-A2, alias, or ISO-A3/ADM0_A3 fallback. */
export function findCountryFeature<T extends { __isoA2?: string; properties?: Record<string, any> }>(
  features: T[],
  targetIso?: string | null
): T | undefined {
  const target = normalizeGlobeIso(targetIso);
  if (!target || features.length === 0) return undefined;

  return features.find((feat) => {
    if (feat.__isoA2 && isoMatches(feat.__isoA2, target)) return true;
    const props = feat.properties ?? {};
    if (isoMatches(props.ISO_A2, target)) return true;
    const a3 = normalizeGlobeIso(props.ISO_A3);
    if (a3 && (a3 === target || normalizeGlobeIso(A3_TO_A2[a3]) === target)) return true;
    const adm = normalizeGlobeIso(props.ADM0_A3);
    if (adm && (adm === target || normalizeGlobeIso(A3_TO_A2[adm]) === target)) return true;
    return false;
  });
}

function wrapLng(lng: number): number {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function unwrapRing(ring: unknown): Array<[number, number]> {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const points: Array<[number, number]> = [];
  let prevLng: number | null = null;

  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const rawLng = Number(pt[0]);
    const rawLat = Number(pt[1]);
    if (!Number.isFinite(rawLng) || !Number.isFinite(rawLat)) continue;

    if (prevLng === null) {
      prevLng = rawLng;
      points.push([rawLng, rawLat]);
      continue;
    }

    // Unwrap sequentially so polygons crossing +/-180 deg remain contiguous.
    const anchor: number = prevLng;
    const delta = ((((rawLng - anchor + 180) % 360) + 360) % 360) - 180;
    const unwrappedLng: number = anchor + delta;
    prevLng = unwrappedLng;
    points.push([unwrappedLng, rawLat]);
  }

  return points;
}

function computeRingMetrics(ring: unknown): RingMetrics | null {
  const pts = unwrapRing(ring);
  if (pts.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of pts) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const bboxLng = (minLng + maxLng) / 2;
  const bboxLat = (minLat + maxLat) / 2;
  const lngSpan = Math.max(0.2, maxLng - minLng);
  const latSpan = Math.max(0.2, maxLat - minLat);

  // Use shoelace area-weighted centroid so dense jagged coastlines do not skew center.
  let twiceArea = 0;
  let cxSum = 0;
  let cySum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cxSum += (x0 + x1) * cross;
    cySum += (y0 + y1) * cross;
  }

  const absArea = Math.abs(twiceArea) / 2;
  let centerLng = bboxLng;
  let centerLat = bboxLat;
  if (absArea > 1e-4) {
    const shoeLng = cxSum / (3 * twiceArea);
    const shoeLat = cySum / (3 * twiceArea);
    if (shoeLng >= minLng && shoeLng <= maxLng && shoeLat >= minLat && shoeLat <= maxLat) {
      centerLng = shoeLng;
      centerLat = shoeLat;
    }
  }

  const midLat = clampLat(centerLat);
  const latWeight = Math.max(0.08, Math.cos((midLat * Math.PI) / 180));
  const surfaceScore = Math.max(absArea, lngSpan * latSpan * 0.25) * latWeight;

  return {
    lat: midLat,
    lng: wrapLng(centerLng),
    latSpan,
    lngSpan,
    surfaceScore,
  };
}

/**
 * Compute camera focus coordinates, adaptive altitude, and ring size for a country feature.
 * Picks the primary mainland polygon so distant overseas territories or antimeridian wraps
 * (e.g. FR, US, RU) frame the mainland cleanly instead of averaging into an ocean.
 */
export function computeCountryFocusTarget(
  feature: { __isoA2?: string; properties?: Record<string, any>; geometry?: { type?: string; coordinates?: any } },
  requestedIso?: string | null
): CountryFocusTarget | null {
  const geom = feature?.geometry;
  if (!geom?.coordinates) return null;

  const outerRings: unknown[] =
    geom.type === "Polygon"
      ? [geom.coordinates[0]]
      : geom.type === "MultiPolygon"
        ? geom.coordinates.map((poly: any) => poly?.[0])
        : [];

  let best: RingMetrics | null = null;
  for (const ring of outerRings) {
    const metrics = computeRingMetrics(ring);
    if (metrics && (!best || metrics.surfaceScore > best.surfaceScore)) {
      best = metrics;
    }
  }

  if (!best) return null;

  const latCos = Math.max(0.25, Math.cos((best.lat * Math.PI) / 180));
  const effectiveSpan = Math.max(best.latSpan, best.lngSpan * latCos);
  const altitude = Math.max(1.12, Math.min(2.2, 0.94 + 0.21 * Math.log2(1 + effectiveSpan)));
  const ringRadius = Math.max(3.8, Math.min(11, 2.8 + effectiveSpan * 0.14));

  return {
    iso: normalizeGlobeIso(requestedIso || feature.__isoA2 || feature.properties?.ISO_A2),
    lat: best.lat,
    lng: best.lng,
    altitude: Number(altitude.toFixed(3)),
    ringRadius: Number(ringRadius.toFixed(2)),
  };
}

/** Compute smooth globe rotation duration scaled by great-circle angular travel distance. */
export function computeFlightDurationMs(
  fromLat: number | undefined,
  fromLng: number | undefined,
  toLat: number,
  toLng: number,
  reducedMotion = false
): number {
  if (reducedMotion) return 0;
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) return 1150;

  const toRad = Math.PI / 180;
  const phi1 = (fromLat as number) * toRad;
  const phi2 = toLat * toRad;
  const dLambda = (toLng - (fromLng as number)) * toRad;
  const cosAngle = Math.max(
    -1,
    Math.min(1, Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLambda))
  );
  const angleDeg = Math.acos(cosAngle) * (180 / Math.PI);

  if (angleDeg < 2) return 450;
  return Math.round(700 + (angleDeg / 180) * 850);
}
