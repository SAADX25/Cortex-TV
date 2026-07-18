import { idbGet, idbSet } from "@/features/iptv/workers/idbCache";

export function geoJsonFingerprint(features: any[]): string {
  if (!features || features.length === 0) return "0::";
  const first = features[0]?.properties?.ISO_A2 ?? features[0]?.properties?.NAME ?? features[0]?.properties?.name ?? "";
  const last = features[features.length - 1]?.properties?.ISO_A2 ?? features[features.length - 1]?.properties?.NAME ?? features[features.length - 1]?.properties?.name ?? "";
  return `${features.length}:${first}:${last}`;
}

export async function getCachedGeoJson(url: string): Promise<any | null> {
  const entry = await idbGet(url);
  if (entry && entry.data) {
    return entry.data; // this is the full GeoJSON object
  }
  return null;
}

export async function setCachedGeoJson(url: string, geoJson: any): Promise<void> {
  const features = geoJson.features || geoJson;
  const hash = geoJsonFingerprint(features);
  // idbSet's type signature expects any[], but the underlying IndexedDB will store the object fine.
  await idbSet(url, geoJson as any[], hash);
}
