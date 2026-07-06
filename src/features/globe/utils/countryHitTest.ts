/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   countryHitTest.ts
   Given a 3D click point on the globe, determine
   which country was clicked using a spherical
   point-in-polygon (winding number) test.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

import * as THREE from "three";
import {
  vec3ToLatLon,
  type CountryPolygon,
} from "./geoJsonToLines";

/**
 * Spherical point-in-polygon via angle-sum / winding-number.
 * Projects to a local tangent plane around the test point
 * and runs a standard ray-casting 2D PIP test.
 */
function pointInRing(
  testLon: number,
  testLat: number,
  ring: THREE.Vector3[]
): boolean {
  // Convert ring to lon/lat
  const coords = ring.map((v) => vec3ToLatLon(v));

  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lon,
      yi = coords[i].lat;
    const xj = coords[j].lon,
      yj = coords[j].lat;

    const intersect =
      yi > testLat !== yj > testLat &&
      testLon < ((xj - xi) * (testLat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Find the country that contains the 3D `point` on the globe.
 * Returns the matching CountryPolygon or `null`.
 */
export function findCountryAtPoint(
  point: THREE.Vector3,
  countries: CountryPolygon[]
): CountryPolygon | null {
  const { lat, lon } = vec3ToLatLon(point);

  for (const country of countries) {
    for (const ring of country.rings) {
      if (ring.length < 3) continue;
      if (pointInRing(lon, lat, ring)) {
        return country;
      }
    }
  }

  return null;
}
