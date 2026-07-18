/* ------------------------------------------------------------------------------------------------------------------------------------------
   Globe.tsx --- Interactive 3D Globe using react-globe.gl
   Neon-styled country polygons with CDN textures.
   ------------------------------------------------------------------------------------------------------------------------------------------ */

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import GlobeGL from "react-globe.gl";
import * as THREE from "three";
import Crosshair from "./Crosshair";
import { flagUrl } from "@/shared/lib/channelUtils";
import { COUNTRY_TZ, COUNTRY_CAPITAL, A3_TO_A2, ADMIN_TO_A2 } from "../data/geoData";
import { getCachedGeoJson, setCachedGeoJson } from "../data/geoJsonCache";

/* ------ GeoJSON point-in-polygon (ray-casting) ------ */
function pointInRing2D(
  testLng: number,
  testLat: number,
  ring: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; // [lng, lat]
    const [xj, yj] = ring[j];
    const intersect =
      yi > testLat !== yj > testLat &&
      testLng < ((xj - xi) * (testLat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check whether a single polygon (outer ring + optional holes) contains a point. */
function polygonContainsPoint(rings: number[][][], lng: number, lat: number): boolean {
  // Must be inside the outer ring
  if (!pointInRing2D(lng, lat, rings[0])) return false;
  // Must NOT be inside any hole (rings[1], rings[2], ---)
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing2D(lng, lat, rings[i])) return false;
  }
  return true;
}

/** Check whether a GeoJSON feature (Polygon / MultiPolygon) contains a point. */
function geoContainsPoint(
  feature: any,
  lng: number,
  lat: number
): boolean {
  const geom = feature?.geometry;
  if (!geom) return false;
  if (geom.type === "Polygon") {
    return polygonContainsPoint(geom.coordinates, lng, lat);
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((poly: number[][][]) =>
      polygonContainsPoint(poly, lng, lat)
    );
  }
  return false;
}


/**
 * Resolve any code/name from GeoJSON properties to a valid ISO-A2 code.
 * Tries: direct 2-letter, A3---A2 lookup, ADM0_A3---A2 lookup, ADMIN name lookup.
 * Returns empty string if nothing matches.
 */
function resolveIsoA2(props: Record<string, any>): string {
  const clean = (v: any): string => {
    const s = String(v ?? '').trim();
    return s === '-99' || s === '-1' || s === '' ? '' : s;
  };
  // 1) Direct ISO_A2
  const a2 = clean(props.ISO_A2);
  if (a2.length === 2) return a2.toUpperCase();
  // 2) ISO_A3 --- lookup
  const a3 = clean(props.ISO_A3);
  if (a3 && A3_TO_A2[a3.toUpperCase()]) return A3_TO_A2[a3.toUpperCase()];
  // 3) ADM0_A3 --- lookup (different field, sometimes different value)
  const adm = clean(props.ADM0_A3);
  if (adm && A3_TO_A2[adm.toUpperCase()]) return A3_TO_A2[adm.toUpperCase()];
  // 4) WB_A2 / FIPS_10_ (some NE versions)
  const wb = clean(props.WB_A2);
  if (wb.length === 2) return wb.toUpperCase();
  // 5) ADMIN name --- lookup
  const admin = (props.ADMIN || props.NAME || '').toLowerCase().trim();
  if (admin && ADMIN_TO_A2[admin]) return ADMIN_TO_A2[admin];
  return '';
}

/** Return formatted local time for a country ISO-A2 code, or null. */
function getCountryTime(iso: string): string | null {
  const tz = COUNTRY_TZ[iso.toUpperCase()];
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return null;
  }
}

/** Translate an ISO-A2 region code to a localised country name via Intl.DisplayNames. */
function getTranslatedCountryName(
  countryCode: string,
  lang: "en" | "ar"
): string {
  try {
    return (
      new Intl.DisplayNames([lang], { type: "region" }).of(
        countryCode.toUpperCase()
      ) || countryCode
    );
  } catch {
    return countryCode;
  }
}

/** Convert ISO-A2 code to flag emoji (regional indicator symbols). */
function isoToFlag(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return '\u{1F30D}';
  return String.fromCodePoint(
    ...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}


/** Detect if the primary input is touch (mobile/tablet). */
const IS_TOUCH_DEVICE = typeof window !== 'undefined'
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  && window.matchMedia('(pointer: coarse)').matches;

/* ------ CDN asset URLs ------ */
const GLOBE_DAY_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const GLOBE_NIGHT_URL =
  "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const BUMP_IMAGE_URL =
  "https://unpkg.com/three-globe/example/img/earth-topology.png";
const GLOBE_BACKGROUND_URL =
  "https://unpkg.com/three-globe/example/img/night-sky.png";
const NIGHT_SKY_URL =
  "https://unpkg.com/three-globe/example/img/night-sky.png";
const GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson";
// Auto-mode FPS target (matches previous GLOBE_TARGET_FPS of 20)
const AUTO_GLOBE_TARGET_FPS = 20;
const MAX_GLOBE_PIXEL_RATIO = 1;
const MOBILE_TARGET_INTERVAL_MS = 250;
const GLOBE_RENDERER_CONFIG = {
  antialias: false,
  alpha: true,
  powerPreference: "low-power" as WebGLPowerPreference,
};

/* Detect prefers-reduced-motion */
const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------ Public types ------ */
export interface CountryInfo {
  name: string;
  iso: string;
}

export interface GlobeClickInfo {
  country: CountryInfo | null;
}

export type GlobeFps = "auto" | 30 | 60;

interface GlobeProps {
  onCountryClick?: (info: GlobeClickInfo) => void;
  isNightMode?: boolean;
  rotationSpeed?: number;
  atmosphereIntensity?: number;
  focusCountryIso?: string | null;
  /** ISO-A2 code of the currently selected country - highlighted in red */
  selectedCountryIso?: string | null;
  /** Globe FPS cap: "auto" uses quality-based logic, 30 or 60 caps render loop */
  globeFps?: GlobeFps;
  /** Pause auto-rotation and heavy renders (search open, video playing) */
  paused?: boolean;
  /** Enable/disable auto-rotation */
  autoRotate?: boolean;
  /** Use native pixel ratio for sharp rendering */
  highQualityGraphics?: boolean;
}

function GlobeInner({
  onCountryClick,
  isNightMode = false,
  rotationSpeed = 0.4,
  atmosphereIntensity = 0.25,
  globeFps = "auto",
  focusCountryIso,
  selectedCountryIso,
  paused = false,
  autoRotate = false,
  highQualityGraphics = false,
}: GlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [loading, setLoading] = useState(true);

  /* ------ Sniper-mode state ------ */
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [targetedCountry, setTargetedCountry] = useState<{
    name: string;
    iso: string;
  } | null>(null);
  const [localTime, setLocalTime] = useState<string | null>(null);

  /* ------ Language toggle state ------ */
  const [uiLang, setUiLang] = useState<"en" | "ar">("en");

  const renderRequestedRef = useRef(false);
  const animationEndTimeRef = useRef(performance.now() + 2000);

  /* ------ Three.js Raycaster (reused across frames) ------ */
  const raycasterRef = useRef(new THREE.Raycaster());
  const centerNDC = useRef(new THREE.Vector2(0, 0));
  const rafIdRef = useRef(0);

  /* ------ Responsive resize ------ */
  useEffect(() => {
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ------ Fetch country polygons ------ */
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        console.log("[Globe] Fetching country GeoJSON from CDN or cache…");
        const cached = await getCachedGeoJson(GEOJSON_URL);
        if (cached && active) {
          const features = cached.features || cached;
          console.log(`[Globe] GeoJSON loaded from cache: ${features.length} countries`);
          setCountries(features);
          setLoading(false);
          return;
        }

        const res = await fetch(GEOJSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (active) {
          const features = data.features || data;
          console.log(`[Globe] GeoJSON loaded from network: ${features.length} countries`);
          setCountries(features);
          setLoading(false);
          await setCachedGeoJson(GEOJSON_URL, data);
        }
      } catch (err) {
        console.error("[Globe] GeoJSON load error:", err);
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => { active = false; };
  }, []);

  /* ------ Globe scene tweaks (auto-rotate, etc.) ------ */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    controls.enablePan = false;
    controls.minDistance = 150;
    controls.maxDistance = 500;

    // Pixel ratio is set in the paused effect
    globe.renderer?.()?.setPixelRatio(1);

    // Slight initial tilt for a nicer default view
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
  }, []);

  useEffect(() => {
    return () => {
      const globe = globeRef.current;
      if (!globe) return;
      const renderer = globe.renderer?.();
      const scene = globe.scene?.();
      
      if (renderer) {
        renderer.setAnimationLoop?.(null);
      }
      
      if (scene) {
        scene.traverse((object: any) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((m: any) => m.dispose());
            } else {
              object.material.dispose();
            }
          }
          if (object.material?.map) object.material.map.dispose();
          if (object.material?.lightMap) object.material.lightMap.dispose();
          if (object.material?.bumpMap) object.material.bumpMap.dispose();
          if (object.material?.normalMap) object.material.normalMap.dispose();
          if (object.material?.specularMap) object.material.specularMap.dispose();
          if (object.material?.envMap) object.material.envMap.dispose();
        });
      }

      if (renderer) {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
      }
      
      if (typeof globe._destructor === 'function') {
        try { globe._destructor(); } catch (e) {}
      }
      
      if (import.meta.env.DEV) {
        (window as any).__cortexGlobeRendererInfo = { geometries: 0, textures: 0 };
      }
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = autoRotate && !paused;
    controls.autoRotateSpeed = (paused || !autoRotate) ? 0 : rotationSpeed;
  }, [rotationSpeed, autoRotate, paused]);

  /* ------ Freeze / resume the Three.js render loop (battery saver) ------
     When paused, setAnimationLoop(null) cancels the internal rAF.
     No frames rendered, no shaders execute --- 0% GPU while hidden.
     On resume the existing WebGL context + textures are reused instantly. */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const renderer = globe.renderer?.();
    if (!renderer) return;
    
    // Auto mode tweaks for performance
    const isAuto = globeFps === "auto";
    const targetPixelRatio = highQualityGraphics
      ? Math.min(window.devicePixelRatio || 1, 3) // Up to 3x for sharp rendering on retina displays
      : isAuto 
        ? Math.min(window.devicePixelRatio || 1, 0.75) // Lower resolution for Auto to save GPU
        : Math.min(window.devicePixelRatio || 1, MAX_GLOBE_PIXEL_RATIO);
    renderer.setPixelRatio(targetPixelRatio);
    
    // Export renderer stats for DebugPanel
    if (import.meta.env.DEV) {
      (window as any).__cortexGlobeRendererInfo = renderer.info.memory;
    }
    
    let lastFrame = 0;

    /* Compute the frame interval (ms) from globeFps prop */
    const computeFrameMs = () => {
      if (globeFps === 30) return 1000 / 30;
      if (globeFps === 60) return 1000 / 60;
      // "auto" mode: use quality-based FPS. Respect prefers-reduced-motion.
      const autoFps = PREFERS_REDUCED_MOTION
        ? Math.min(AUTO_GLOBE_TARGET_FPS, 15)
        : AUTO_GLOBE_TARGET_FPS;
      return 1000 / autoFps;
    };
    const frameMs = computeFrameMs();

    const ctrl = globe.controls?.();
    const requestRender = () => { renderRequestedRef.current = true; };
    if (ctrl) {
      ctrl.addEventListener("change", requestRender);
    }

    if (paused) {
      renderer.setAnimationLoop(null);
    } else {
      renderer.setAnimationLoop((time: number = performance.now()) => {
        if (time - lastFrame < frameMs) return;

        if (ctrl) ctrl.update();

        const isAutoRotating = autoRotate && !paused && rotationSpeed > 0;
        const isAnimating = time < animationEndTimeRef.current;
        const shouldRender = renderRequestedRef.current || isAnimating || isAutoRotating;

        if (shouldRender) {
          lastFrame = time;
          renderRequestedRef.current = false;
          renderer.render(globe.scene(), globe.camera());
        }
      });
    }

    /* Cleanup: ensure the loop is stopped if the component unmounts while running */
    return () => {
      if (ctrl) ctrl.removeEventListener("change", requestRender);
      renderer.setAnimationLoop(null);
    };
  }, [paused, highQualityGraphics, globeFps, autoRotate, rotationSpeed]);

  /* ------ Fly to country when focusCountryIso changes ------ */
  useEffect(() => {
    if (!focusCountryIso || !globeRef.current || countries.length === 0) return;
    const iso = focusCountryIso.toUpperCase();
    const feature = countries.find((f: any) => {
      const p = f.properties ?? {};
      return (
        (p.ISO_A2 ?? "").toUpperCase() === iso ||
        (p.ISO_A3 ?? "").toUpperCase() === iso ||
        (p.ADM0_A3 ?? "").toUpperCase() === iso
      );
    });
    if (!feature) return;

    /* Compute centroid from the geometry coordinates */
    const coords = feature.geometry?.coordinates;
    if (!coords) return;
    let lats = 0, lngs = 0, count = 0;
    const flatten = (arr: any) => {
      if (typeof arr[0] === "number") {
        lngs += arr[0];
        lats += arr[1];
        count++;
      } else {
        for (const sub of arr) flatten(sub);
      }
    };
    flatten(coords);
    if (count === 0) return;

    globeRef.current.pointOfView(
      { lat: lats / count, lng: lngs / count, altitude: 1.8 },
      1200
    );
    animationEndTimeRef.current = performance.now() + 1250;
  }, [focusCountryIso, countries]);

  /* ------ Render Triggers for transitions ------ */
  useEffect(() => {
    animationEndTimeRef.current = performance.now() + 1000;
  }, [countries]);

  useEffect(() => {
    animationEndTimeRef.current = performance.now() + 350;
  }, [selectedCountryIso]);

  /* ------ Helper: extract name + iso from a GeoJSON feature ------ */
  const extractCountryInfo = useCallback((feature: any) => {
    if (!feature) return null;
    const props = feature.properties ?? {};
    const adminName = props.ADMIN || props.NAME || 'Unknown';
    const iso = resolveIsoA2(props);
    // Always produce a human-readable name, never a raw code
    const name = iso
      ? getTranslatedCountryName(iso, 'en')
      : adminName;
    return { name, iso };
  }, []);

  /* ------ Bounding-box spatial index for fast geo rejection ------ */
  const countryBBoxes = useMemo(() => {
    return countries.map((f: any) => {
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
      const walk = (arr: any) => {
        if (typeof arr[0] === "number") {
          if (arr[0] < minLng) minLng = arr[0];
          if (arr[0] > maxLng) maxLng = arr[0];
          if (arr[1] < minLat) minLat = arr[1];
          if (arr[1] > maxLat) maxLat = arr[1];
        } else {
          for (const sub of arr) walk(sub);
        }
      };
      if (f.geometry?.coordinates) walk(f.geometry.coordinates);
      // If bbox spans > 180-- in longitude it likely crosses the antimeridian;
      // expand to full range so the pre-filter never rejects it incorrectly.
      const wrapLng = maxLng - minLng > 180;
      return {
        feature: f,
        minLng: wrapLng ? -180 : minLng,
        maxLng: wrapLng ?  180 : maxLng,
        minLat,
        maxLat,
      };
    });
  }, [countries]);

  /* ------ Analytical ray-sphere intersection --- lat/lng ------
     Casts a ray from screen center to the globe surface and returns
     the exact geographic coordinates of the intersection point.
     Accurate regardless of camera tilt, zoom, or orbit offset.
     Uses the three-globe coordinate convention (Y-up). */
  const GLOBE_RADIUS = 100; // three-globe default
  const surfaceLatLngAtCenter = useCallback((): { lat: number; lng: number } | null => {
    const globe = globeRef.current;
    if (!globe) return null;
    const camera = globe.camera();
    if (!camera) return null;

    raycasterRef.current.setFromCamera(centerNDC.current, camera);
    const { origin, direction } = raycasterRef.current.ray;

    /* Analytical ray-sphere intersection (sphere at origin, radius R).
       Avoids scene traversal  --- zero GC pressure, runs at 60 fps. */
    const a = direction.dot(direction);                      // always 1 for normalised dir
    const b = 2 * origin.dot(direction);
    const c = origin.dot(origin) - GLOBE_RADIUS * GLOBE_RADIUS;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;                       // ray misses the globe

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);      // nearest intersection
    if (t < 0) return null;                                  // globe behind camera

    const px = origin.x + direction.x * t;
    const py = origin.y + direction.y * t;
    const pz = origin.z + direction.z * t;
    const r  = Math.sqrt(px * px + py * py + pz * pz);
    if (r < 1) return null;                                  // degenerate

    /* three-globe convention:
         polar2Cartesian  ---  theta = (90 - lng) -- --/180
                              x = r--sin ----cos --,  z = r--sin ----sin --
         Inverse:
           lat = 90 - acos(y / r) -- 180/--
           lng = 90 - atan2(z, x) -- 180/--           */
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, py / r))) * (180 / Math.PI);
    let lng = 90 - Math.atan2(pz, px) * (180 / Math.PI);
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    return { lat, lng };
  }, []);

  /* ------ Fallback: raycaster --- polygon mesh __data at exact screen center ------ */
  const getCenterCountry = useCallback((): any | null => {
    const globe = globeRef.current;
    if (!globe) return null;

    const camera = globe.camera();
    const scene = globe.scene();
    if (!camera || !scene) return null;

    /* Collect all polygon-layer meshes from the scene graph. */
    const meshes: THREE.Object3D[] = [];
    scene.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh && (obj as any).__data) {
        meshes.push(obj);
      }
    });
    if (meshes.length === 0) return null;

    /* Single ray at exact screen center --- no offsets to avoid adjacency errors */
    raycasterRef.current.setFromCamera(centerNDC.current, camera);
    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const data = (intersects[0].object as any).__data;
      if (data) return data;
    }
    return null;
  }, []);

  /* ------ Primary: raycast to globe surface --- lat/lng --- PIP ------ */
  const getCenterCountryGeo = useCallback((): any | null => {
    if (countryBBoxes.length === 0) return null;

    /* Get the exact lat/lng of the surface point under the crosshair */
    const geo = surfaceLatLngAtCenter();
    if (!geo) return null;
    const { lat, lng } = geo;

    // Fast bbox pre-filter, then precise point-in-polygon
    for (const { feature, minLng, maxLng, minLat, maxLat } of countryBBoxes) {
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      if (geoContainsPoint(feature, lng, lat)) return feature;
    }
    return null;
  }, [countryBBoxes, surfaceLatLngAtCenter]);

  /* ------ Combined center lookup (geo-precise first, raycaster fallback) ------ */
  const getCenterCountryCombined = useCallback((): any | null => {
    return getCenterCountryGeo() ?? getCenterCountry();
  }, [getCenterCountryGeo, getCenterCountry]);

  /* ------ Select (confirm) the country at center ------ */
  const selectFeature = useCallback(
    (feature: any) => {
      const info = extractCountryInfo(feature);
      if (!info) return;

      console.log(
        `%c[Cortex TV] ðŸŽ¯ ${info.name} (${info.iso})`,
        "color: #00ffff; font-weight: bold; font-size: 14px;"
      );

      onCountryClick?.({ country: info });

      /* Pulse the crosshair */
      setCrosshairActive(true);
      setTimeout(() => setCrosshairActive(false), 450);
    },
    [onCountryClick, extractCountryInfo]
  );

  /* ------ Sniper-mode: select whatever is under the crosshair ------ */
  const selectCountryAtCenter = useCallback(() => {
    if (paused) return;
    const feature = getCenterCountryCombined();
    if (feature) {
      selectFeature(feature);
    } else {
      console.log(
        "%c[Cortex TV] ðŸŽ¯ No country at center",
        "color: #555; font-size: 12px;"
      );
    }
  }, [paused, getCenterCountryCombined, selectFeature]);

  /* ------ Live tracking via rAF loop (MOBILE only, 60fps-synced) ------ */
  const updateTargetLabel = useCallback(() => {
    if (!IS_TOUCH_DEVICE) return;
    if (paused) {
      setTargetedCountry((prev) => (prev !== null ? null : prev));
      setLocalTime((prev) => (prev !== null ? null : prev));
      return;
    }

    const feature = getCenterCountryGeo();
    const info = feature ? extractCountryInfo(feature) : null;
    
    setTargetedCountry((prev) => {
      if (prev?.iso === info?.iso) return prev;
      return info ?? null;
    });
    
    setLocalTime((prev) => {
      const newTime = info?.iso ? getCountryTime(info.iso) : null;
      if (prev === newTime) return prev;
      return newTime;
    });
  }, [paused, getCenterCountryGeo, extractCountryInfo]);

  /* rAF loop: runs every frame while the globe is visible (mobile only).
     This catches auto-rotation, inertia, and active dragging at native refresh rate. */
  useEffect(() => {
    if (!IS_TOUCH_DEVICE || paused) return;
    let active = true;
    let lastUpdate = 0;
    const loop = (time: number = performance.now()) => {
      if (!active) return;
      if (time - lastUpdate >= MOBILE_TARGET_INTERVAL_MS) {
        lastUpdate = time;
        updateTargetLabel();
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(rafIdRef.current); };
  }, [paused, updateTargetLabel]);

  /* ------ Tick the live clock every second when a country is targeted ------ */
  useEffect(() => {
    if (!targetedCountry?.iso) { setLocalTime(null); return; }
    const tick = () => setLocalTime(getCountryTime(targetedCountry.iso));
    tick(); // immediate first render
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetedCountry?.iso]);

  /* ------ Bulletproof event blocker for UI overlays ------ */
  const killEvent = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  /* ------ Pointer tracking: distinguish tap from drag ------ */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    /* Ignore taps on UI overlays (buttons, icons, etc.) */
    if ((e.target as HTMLElement).closest?.("button")) return;
    if ((e.target as HTMLElement).tagName !== "CANVAS") return;

    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      /* Ignore taps on UI overlays */
      if ((e.target as HTMLElement).closest?.("button")) return;
      if ((e.target as HTMLElement).tagName !== "CANVAS") return;

      const down = pointerDownRef.current;
      if (!down) return;
      pointerDownRef.current = null;

      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - down.time;

      /* Quick tap: < 12 px movement and < 300 ms.
         Trigger crosshair-based selection for touch/pen, OR if mouse clicks directly on the center crosshair. */
      const isCenter = Math.abs(e.clientX - window.innerWidth / 2) < 30 && Math.abs(e.clientY - window.innerHeight / 2) < 30;
      if (dist < 12 && elapsed < 300 && (e.pointerType !== "mouse" || isCenter)) {
        selectCountryAtCenter();
      }
    },
    [selectCountryAtCenter]
  );

  /* ------ Direct mouse click on polygon (PC/Desktop) ------ */
  const handlePolygonClick = useCallback(
    (polygon: any, _event: MouseEvent, _coords: { lat: number; lng: number; altitude: number }) => {
      if (paused) return; // Allow interaction even in auto mode
      if (polygon) selectFeature(polygon);
    },
    [paused, selectFeature]
  );

  /* ------ Desktop: mouse hover on polygon --- update badge ------ */
  const handlePolygonHover = useCallback(
    (polygon: any) => {
      if (IS_TOUCH_DEVICE || paused) return;
      if (!polygon) {
        setTargetedCountry((prev) => (prev !== null ? null : prev));
        setLocalTime((prev) => (prev !== null ? null : prev));
        return;
      }
      const info = extractCountryInfo(polygon);
      setTargetedCountry((prev) => {
        if (prev?.iso === info?.iso) return prev;
        return info ?? null;
      });
      setLocalTime((prev) => {
        const newTime = info?.iso ? getCountryTime(info.iso) : null;
        if (prev === newTime) return prev;
        return newTime;
      });
    },
    [paused, extractCountryInfo]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* ------ Language toggle button (top-left, mirrors Dark-Mode on the right) ------ */}
      <button
        onTouchStart={killEvent}
        onTouchEnd={killEvent}
        onPointerDown={killEvent}
        onClick={(e) => { e.stopPropagation(); setUiLang((l) => (l === "en" ? "ar" : "en")); }}
        className="fixed top-[4.5rem] mobile-safe-floating-top left-4 z-50 md:hidden flex items-center justify-center
                   h-10 w-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10
                   text-white/60 hover:text-cyan-400 active:scale-90 transition-all shadow-lg"
        aria-label={uiLang === "en" ? "Switch to Arabic" : "Switch to English"}
      >
        {/* Globe icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute opacity-40"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        <span className="relative text-[11px] font-bold leading-none">
          {uiLang === "en" ? "ع" : "EN"}
        </span>
      </button>

      {/* ------ Precision dot (neon blue) ------ */}
      <Crosshair active={crosshairActive} />

      {/* ------ Country Info Badge (iOS Glassmorphism) ------ */}
      <div
        className={`fixed top-14 mobile-safe-badge-top left-1/2 -translate-x-1/2 z-50 pointer-events-none
                    transition-all duration-200 origin-top
                    ${targetedCountry
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-90 pointer-events-none"}`}
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          minWidth: 180,
        }}
      >
        {targetedCountry && (() => {
          const hasIso = targetedCountry.iso.length === 2;
          const displayName = hasIso
            ? getTranslatedCountryName(targetedCountry.iso, uiLang)
            : targetedCountry.name;
          const capital = hasIso ? COUNTRY_CAPITAL[targetedCountry.iso.toUpperCase()] : null;
          const time = localTime;
          const showDetails = !!(capital && time);
          return (
            <div className="flex flex-col items-center gap-1.5">
              {/* ------ Top Row: Flag + Country Name ------ */}
              <div className="flex items-center gap-2.5">
                {hasIso ? (
                  <img
                    src={flagUrl(targetedCountry.iso)}
                    alt=""
                    width={24}
                    height={18}
                    className="rounded-[3px] shadow-sm object-cover"
                    style={{ minWidth: 24 }}
                  />
                ) : (
                  <span className="text-lg leading-none">{"\u{1F30D}"}</span>
                )}
                <span
                  className="text-[15px] font-bold text-white tracking-wide"
                  dir={uiLang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {displayName}
                </span>
              </div>
              {/* ------ Bottom Row: Clock + Time + Capital (only if data exists) ------ */}
              {showDetails && (
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: '#94a3b8' }}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-xs tabular-nums font-medium" style={{ color: '#cbd5e1' }}>{time}</span>
                  <span className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>{"\u2022"}</span>
                  <span className="text-xs" style={{ color: '#cbd5e1' }}>{capital}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {/* ------ Loading overlay ------ */}
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
            Loading Globeâ€¦
          </span>
        </div>
      )}

      <GlobeGL
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        rendererConfig={GLOBE_RENDERER_CONFIG}
        /* ------ Textures ------ */
        globeImageUrl={isNightMode ? GLOBE_NIGHT_URL : GLOBE_DAY_URL}
        bumpImageUrl={undefined}
        /* ------ Scene ------ */
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={GLOBE_BACKGROUND_URL}
        enablePointerInteraction={!paused}
        showAtmosphere={false}
        atmosphereColor={isNightMode ? "#0066cc" : "#00bfff"}
        atmosphereAltitude={atmosphereIntensity}
        animateIn={false}
        /* ------ Country polygons ------ */
        polygonsData={countries}
        polygonCapColor={(feat: any) => {
          if (paused) return "rgba(0,0,0,0)";
          const iso = resolveIsoA2(feat?.properties ?? {});
          if (selectedCountryIso && iso && iso.toUpperCase() === selectedCountryIso.toUpperCase()) {
            return "rgba(255, 40, 40, 0.45)";
          }
          return "rgba(0, 255, 255, 0.02)";
        }}
        polygonSideColor={(feat: any) => {
          if (paused) return "rgba(0,0,0,0)";
          const iso = resolveIsoA2(feat?.properties ?? {});
          if (selectedCountryIso && iso && iso.toUpperCase() === selectedCountryIso.toUpperCase()) {
            return "rgba(255, 40, 40, 0.6)";
          }
          return "rgba(0, 255, 255, 0.05)";
        }}
        polygonStrokeColor={(feat: any) => {
          if (paused) return "rgba(0,0,0,0)";
          const iso = resolveIsoA2(feat?.properties ?? {});
          if (selectedCountryIso && iso && iso.toUpperCase() === selectedCountryIso.toUpperCase()) {
            return "#ff2828";
          }
          return "#00ffff";
        }}
        polygonAltitude={(feat: any) => {
          const iso = resolveIsoA2(feat?.properties ?? {});
          if (selectedCountryIso && iso && iso.toUpperCase() === selectedCountryIso.toUpperCase()) {
            return 0.018;
          }
          return 0.005;
        }}
        polygonCapCurvatureResolution={1}
        polygonLabel={() => ""}
        /* Interaction */
        onPolygonHover={handlePolygonHover}
        onPolygonClick={handlePolygonClick}
        /* Performance */
        polygonsTransitionDuration={300}
      />
    </div>
  );
}

export default memo(GlobeInner);
