/* ------------------------------------------------------------------------------------------------------------------------------------------
   Globe.tsx --- Interactive 3D Globe using react-globe.gl
   Neon-styled country polygons with CDN textures.
   ------------------------------------------------------------------------------------------------------------------------------------------ */

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import GlobeGL from "react-globe.gl";
import * as THREE from "three";
import Crosshair from "./Crosshair";
import SafeImage from "@/shared/components/SafeImage";
import { flagUrl } from "@/shared/lib/channelUtils";
import { COUNTRY_TZ, COUNTRY_CAPITAL, A3_TO_A2, ADMIN_TO_A2 } from "../data/geoData";
import {
  computeCountryFocusTarget,
  computeFlightDurationMs,
  findCountryFeature,
  isoMatches,
  normalizeGlobeIso,
  type CountryFocusTarget,
} from "../utils/countryFocus";
import "../styles/countryPin.css";
import { getCachedGeoJson, setCachedGeoJson } from "../data/geoJsonCache";
import { resolvePixelRatio } from "../utils/globePerf";

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
const dateTimeFormatCache: Record<string, Intl.DateTimeFormat> = {};
function getCountryTime(iso: string): string | null {
  const tz = COUNTRY_TZ[iso.toUpperCase()];
  if (!tz) return null;
  try {
    if (!dateTimeFormatCache[tz]) {
      dateTimeFormatCache[tz] = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return dateTimeFormatCache[tz].format(new Date());
  } catch {
    return null;
  }
}

/** Translate an ISO-A2 region code to a localised country name via Intl.DisplayNames. */
const displayNamesCache: Record<string, Intl.DisplayNames> = {};
function getTranslatedCountryName(
  countryCode: string,
  lang: "en" | "ar"
): string {
  try {
    if (!displayNamesCache[lang]) {
      displayNamesCache[lang] = new Intl.DisplayNames([lang], { type: "region" });
    }
    return displayNamesCache[lang].of(countryCode.toUpperCase()) || countryCode;
  } catch {
    return countryCode;
  }
}

/** Standalone component for the badge to prevent GlobeInner from re-rendering every second */
const CountryInfoBadge = memo(function CountryInfoBadge({ 
  targetedCountry, 
  uiLang 
}: { 
  targetedCountry: { name: string; iso: string } | null; 
  uiLang: "en" | "ar";
}) {
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    if (!targetedCountry?.iso) { 
      setLocalTime(null); 
      return; 
    }
    const tick = () => setLocalTime(getCountryTime(targetedCountry.iso));
    tick(); // immediate first render
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [targetedCountry?.iso]);

  const hasIso = targetedCountry?.iso?.length === 2;
  const displayName = targetedCountry ? (hasIso
    ? getTranslatedCountryName(targetedCountry.iso, uiLang)
    : targetedCountry.name) : '';
  const capital = hasIso ? COUNTRY_CAPITAL[targetedCountry.iso.toUpperCase()] : null;
  const showDetails = !!(capital && localTime);

  return (
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
      {targetedCountry && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2.5">
            {hasIso ? (
              <SafeImage
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
          {showDetails && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: '#94a3b8' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-xs tabular-nums font-medium" style={{ color: '#cbd5e1' }}>{localTime}</span>
              <span className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>{"\u2022"}</span>
              <span className="text-xs" style={{ color: '#cbd5e1' }}>{capital}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/** Detect if the primary input is touch (mobile/tablet). */
const IS_TOUCH_DEVICE = typeof window !== 'undefined'
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  && window.matchMedia('(pointer: coarse)').matches;

/* ------ CDN asset URLs ------ */
const GLOBE_DAY_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const GLOBE_NIGHT_URL =
  "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const GLOBE_BACKGROUND_URL =
  "https://unpkg.com/three-globe/example/img/night-sky.png";
const GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson";
const MOBILE_TARGET_INTERVAL_MS = 250;

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
  focusTrigger?: number;
  /** ISO-A2 code of the currently selected country - highlighted in royal blue */
  selectedCountryIso?: string | null;
  selectedCountryName?: string | null;
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
  focusTrigger,
  selectedCountryIso,
  selectedCountryName,
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

  const rendererConfig = useMemo(() => ({
    antialias: highQualityGraphics,
    alpha: true,
    // Keep the last composited frame intact while animation pauses so Chromium never flashes black.
    preserveDrawingBuffer: true,
    powerPreference: (highQualityGraphics ? "high-performance" : "low-power") as WebGLPowerPreference,
  }), [highQualityGraphics]);
  /* ------ Sniper-mode state ------ */
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [targetedCountry, setTargetedCountry] = useState<{
    name: string;
    iso: string;
  } | null>(null);

  /* ------ Language toggle state ------ */
  const [uiLang, setUiLang] = useState<"en" | "ar">("en");

  const isPointerDraggingRef = useRef(false);
  const lastHoverCheckMsRef = useRef(0);

  /* ------ Three.js Raycaster (reused across frames) ------ */
  const raycasterRef = useRef(new THREE.Raycaster());
  const centerNDC = useRef(new THREE.Vector2(0, 0));
  const hoverNdcRef = useRef(new THREE.Vector2(0, 0));
  const rafIdRef = useRef(0);

  /* ------ Responsive resize (debounced to avoid WebGL target churn while dragging edges) ------ */
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      }, 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
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
          features.forEach((f: any) => {
            if (f.__isoA2 === undefined) {
              f.__isoA2 = resolveIsoA2(f.properties ?? {});
            }
          });
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
          features.forEach((f: any) => {
            if (f.__isoA2 === undefined) {
              f.__isoA2 = resolveIsoA2(f.properties ?? {});
            }
          });
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

      const disposeMaterial = (mat: any) => {
        if (!mat) return;
        mat.map?.dispose?.();
        mat.lightMap?.dispose?.();
        mat.bumpMap?.dispose?.();
        mat.normalMap?.dispose?.();
        mat.specularMap?.dispose?.();
        mat.envMap?.dispose?.();
        mat.dispose?.();
      };

      if (scene) {
        scene.traverse((object: any) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) {
            object.material.forEach(disposeMaterial);
          } else {
            disposeMaterial(object.material);
          }
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

  /* ------ Freeze / resume the Three.js render loop (battery saver) ------ */
  const wakeUntilRef = useRef(Date.now() + 3500);
  const isAwakeRef = useRef(true);
  const [focusMarker, setFocusMarker] = useState<(CountryFocusTarget & { name: string }) | null>(null);
  const updateFocusMarker = useCallback((target: CountryFocusTarget, name: string) => {
    setFocusMarker((prev) =>
      prev &&
      prev.iso === target.iso &&
      prev.name === name &&
      Math.abs(prev.lat - target.lat) < 0.01 &&
      Math.abs(prev.lng - target.lng) < 0.01
        ? prev
        : { ...target, name }
    );
  }, []);
  const [ringBurstActive, setRingBurstActive] = useState(false);
  const lastExecutedFocusRef = useRef<string | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCountryNameRef = useRef(selectedCountryName);
  selectedCountryNameRef.current = selectedCountryName;

  const wakeGlobeFor = useCallback((holdMs = 1500, _highPriority = false) => {
    const targetWakeUntil = Date.now() + holdMs;
    if (targetWakeUntil > wakeUntilRef.current) {
      wakeUntilRef.current = targetWakeUntil;
    }
    if (!isAwakeRef.current) {
      isAwakeRef.current = true;
      globeRef.current?.resumeAnimation();
    }
  }, []);

  const wakeGlobe = useCallback(() => {
    wakeGlobeFor(1500);
  }, [wakeGlobeFor]);

  const handleGlobeReady = useCallback(() => {
    wakeGlobeFor(1500);
  }, [wakeGlobeFor]);

  useEffect(() => {
    if (!paused) {
      wakeGlobeFor(900);
    }
  }, [paused, isNightMode, globeFps, highQualityGraphics, dimensions, countries.length, selectedCountryIso, wakeGlobeFor]);

  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const renderer = globe.renderer?.();
    if (renderer) {
      const targetPixelRatio = resolvePixelRatio(
        window.devicePixelRatio || 1,
        globeFps,
        highQualityGraphics
      );
      if (renderer.getPixelRatio() !== targetPixelRatio) {
        renderer.setPixelRatio(targetPixelRatio);
        const currentSize = renderer.getSize(new THREE.Vector2());
        renderer.setSize(currentSize.width, currentSize.height, false);
        wakeGlobeFor(800);
      }

      if (import.meta.env.DEV) {
        (window as any).__cortexGlobeRendererInfo = renderer.info.memory;
      }
    }

    const ctrl = globe.controls?.();
    const requestRender = () => {
      wakeGlobe();
    };
    const clearDrag = () => {
      isPointerDraggingRef.current = false;
    };
    if (ctrl) {
      ctrl.addEventListener("change", requestRender);
    }
    window.addEventListener("pointerup", clearDrag);
    window.addEventListener("pointercancel", clearDrag);

    // Timer to put the globe to sleep when idle to save CPU/GPU
    const interval = setInterval(() => {
      if (paused) {
        if (isAwakeRef.current) {
          isAwakeRef.current = false;
          globe?.pauseAnimation();
        }
        return;
      }

      if (autoRotate && rotationSpeed > 0) {
        wakeGlobe(); // Keep awake if auto-rotating
        return;
      }

      // Keep rAF awake while three-render-objects holds scene.visible=false awaiting night-sky.png load
      const scene = globe?.scene?.();
      if (scene && scene.visible === false) {
        wakeGlobeFor(900);
        return;
      }

      if (Date.now() >= wakeUntilRef.current && isAwakeRef.current) {
        isAwakeRef.current = false;
        globe?.pauseAnimation();
      }
    }, 500);

    /* Cleanup */
    return () => {
      clearInterval(interval);
      if (ctrl) ctrl.removeEventListener("change", requestRender);
      window.removeEventListener("pointerup", clearDrag);
      window.removeEventListener("pointercancel", clearDrag);
    };
  }, [paused, highQualityGraphics, globeFps, autoRotate, rotationSpeed, wakeGlobe, wakeGlobeFor]);

  /* ------ Keep selected country locator marker synced ------ */
  useEffect(() => {
    if (!selectedCountryIso || countries.length === 0) {
      setFocusMarker(null);
      setRingBurstActive(false);
      return;
    }

    const feature = findCountryFeature(countries, selectedCountryIso);
    if (!feature) {
      setFocusMarker(null);
      return;
    }

    const target = computeCountryFocusTarget(feature, selectedCountryIso);
    if (!target) {
      setFocusMarker(null);
      return;
    }

    const resolvedName =
      selectedCountryName ||
      feature.properties?.NAME ||
      feature.properties?.ADMIN ||
      feature.properties?.name ||
      target.iso;

    updateFocusMarker(target, resolvedName);
  }, [selectedCountryIso, selectedCountryName, countries, updateFocusMarker]);

  /* ------ Fly to country + sonar lock-on when focusCountryIso changes ------ */
  useEffect(() => {
    if (!focusCountryIso) {
      lastExecutedFocusRef.current = null;
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      setRingBurstActive(false);
      return;
    }
    if (paused || !globeRef.current || countries.length === 0) return;

    const normIso = normalizeGlobeIso(focusCountryIso);
    const focusKey = `${focusTrigger ?? 0}:${normIso}`;
    if (lastExecutedFocusRef.current === focusKey) return;

    const feature = findCountryFeature(countries, focusCountryIso);
    if (!feature) return;

    const target = computeCountryFocusTarget(feature, focusCountryIso);
    if (!target) return;

    lastExecutedFocusRef.current = focusKey;

    const globe = globeRef.current;
    const currentPov = typeof globe.pointOfView === "function" ? globe.pointOfView() : undefined;
    const durationMs = computeFlightDurationMs(
      currentPov?.lat,
      currentPov?.lng,
      target.lat,
      target.lng,
      PREFERS_REDUCED_MOTION
    );

    const pulseDurationMs = PREFERS_REDUCED_MOTION ? 0 : 3400;
    const holdAwakeMs = durationMs + pulseDurationMs + 450;

    // Wake WebGL at 60fps before starting pointOfView tween so fly-to stays smooth even in Smart mode.
    wakeGlobeFor(holdAwakeMs, true);

    const resolvedName =
      selectedCountryNameRef.current ||
      feature.properties?.NAME ||
      feature.properties?.ADMIN ||
      feature.properties?.name ||
      target.iso;
    updateFocusMarker(target, resolvedName);

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    if (!PREFERS_REDUCED_MOTION) {
      setRingBurstActive(true);
      ringTimeoutRef.current = setTimeout(() => {
        setRingBurstActive(false);
        ringTimeoutRef.current = null;
      }, durationMs + pulseDurationMs);
    } else {
      setRingBurstActive(false);
    }

    globe.pointOfView(
      { lat: target.lat, lng: target.lng, altitude: target.altitude },
      durationMs
    );
  }, [focusCountryIso, focusTrigger, countries, paused, wakeGlobeFor, updateFocusMarker]);

  /* ------ Render Triggers for transitions ------ */
  useEffect(() => {
    wakeGlobeFor(1000);
  }, [countries, wakeGlobeFor]);

  useEffect(() => {
    wakeGlobeFor(550);
  }, [selectedCountryIso, wakeGlobeFor]);

  /* ------ Helper: extract name + iso from a GeoJSON feature ------ */
  const extractCountryInfo = useCallback((feature: any) => {
    if (!feature) return null;
    const props = feature.properties ?? {};
    const adminName = props.ADMIN || props.NAME || 'Unknown';
    const iso = feature.__isoA2 !== undefined ? feature.__isoA2 : resolveIsoA2(props);
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
  const surfaceLatLngAtNDC = useCallback((ndc: THREE.Vector2): { lat: number; lng: number } | null => {
    const globe = globeRef.current;
    if (!globe) return null;
    const camera = globe.camera();
    if (!camera) return null;

    raycasterRef.current.setFromCamera(ndc, camera);
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

  const surfaceLatLngAtCenter = useCallback(
    () => surfaceLatLngAtNDC(centerNDC.current),
    [surfaceLatLngAtNDC]
  );

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

  const findCountryAtGeo = useCallback((lng: number, lat: number): any | null => {
    for (const { feature, minLng, maxLng, minLat, maxLat } of countryBBoxes) {
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      if (geoContainsPoint(feature, lng, lat)) return feature;
    }
    return null;
  }, [countryBBoxes]);

  /* ------ Primary: raycast to globe surface --- lat/lng --- PIP ------ */
  const getCenterCountryGeo = useCallback((): any | null => {
    if (countryBBoxes.length === 0) return null;

    /* Get the exact lat/lng of the surface point under the crosshair */
    const geo = surfaceLatLngAtCenter();
    if (!geo) return null;
    return findCountryAtGeo(geo.lng, geo.lat);
  }, [countryBBoxes.length, surfaceLatLngAtCenter, findCountryAtGeo]);

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
      return;
    }

    const feature = getCenterCountryGeo();
    const info = feature ? extractCountryInfo(feature) : null;
    
    setTargetedCountry((prev) => {
      if (prev?.iso === info?.iso) return prev;
      return info ?? null;
    });
  }, [paused, getCenterCountryGeo, extractCountryInfo]);

  /* rAF loop: runs every frame while the globe is visible (mobile only).
     This catches auto-rotation, inertia, and active dragging at native refresh rate. */
  useEffect(() => {
    if (!IS_TOUCH_DEVICE || paused || dimensions.width >= 1024) return;
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
  }, [paused, dimensions.width, updateTargetLabel]);

  /* ------ Bulletproof event blocker for UI overlays ------ */
  const killEvent = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  /* ------ Pointer tracking: distinguish tap from drag ------ */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    /* Ignore taps on UI overlays (buttons, icons, etc.) */
    if ((e.target as HTMLElement).closest?.("button")) return;
    if ((e.target as HTMLElement).tagName !== "CANVAS") return;

    isPointerDraggingRef.current = true;
    wakeGlobeFor(1500, true);
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  }, [wakeGlobeFor]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      isPointerDraggingRef.current = false;
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

  /* Hover lookup on resting globe stays analytical on CPU so cursor movement never wakes WebGL. */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (paused) return;
      if (isPointerDraggingRef.current || e.buttons > 0) {
        wakeGlobeFor(1500, true);
        return;
      }
      if (IS_TOUCH_DEVICE || isAwakeRef.current) return;
      if ((e.target as HTMLElement).tagName !== "CANVAS") return;

      const now = performance.now();
      if (now - lastHoverCheckMsRef.current < 85) return;
      lastHoverCheckMsRef.current = now;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      hoverNdcRef.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const geo = surfaceLatLngAtNDC(hoverNdcRef.current);
      const feature = geo ? findCountryAtGeo(geo.lng, geo.lat) : null;
      const info = feature ? extractCountryInfo(feature) : null;
      setTargetedCountry((prev) => (prev?.iso === info?.iso ? prev : info ?? null));
    },
    [paused, wakeGlobeFor, surfaceLatLngAtNDC, findCountryAtGeo, extractCountryInfo]
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
        return;
      }
      const info = extractCountryInfo(polygon);
      setTargetedCountry((prev) => {
        if (prev?.iso === info?.iso) return prev;
        return info ?? null;
      });
    },
    [paused, extractCountryInfo]
  );

  /* ------ Memoized Accessors for react-globe.gl ------ */
  const getPolygonCapColor = useCallback((feat: any) => {
    if (isoMatches(feat.__isoA2, selectedCountryIso)) {
      return "rgba(37, 99, 235, 0.42)";
    }
    return "rgba(0, 255, 255, 0.02)";
  }, [selectedCountryIso]);

  const getPolygonSideColor = useCallback((feat: any) => {
    if (isoMatches(feat.__isoA2, selectedCountryIso)) {
      return "rgba(56, 189, 248, 0.72)";
    }
    return "rgba(0, 255, 255, 0.04)";
  }, [selectedCountryIso]);

  const getPolygonStrokeColor = useCallback((feat: any) => {
    if (isoMatches(feat.__isoA2, selectedCountryIso)) {
      return "#7dd3fc";
    }
    return selectedCountryIso ? "rgba(34, 211, 238, 0.45)" : "#00ffff";
  }, [selectedCountryIso]);

  const getPolygonAltitude = useCallback((feat: any) => {
    if (isoMatches(feat.__isoA2, selectedCountryIso)) {
      return 0.028;
    }
    return 0.005;
  }, [selectedCountryIso]);

  const getPolygonLabel = useCallback(() => "", []);

  const focusPinPoints = useMemo(
    () => (focusMarker && !paused ? [focusMarker] : []),
    [focusMarker, paused]
  );

  const focusRings = useMemo(() => {
    if (!focusMarker || !ringBurstActive || paused) return [];
    return [
      {
        lat: focusMarker.lat,
        lng: focusMarker.lng,
        maxRadius: focusMarker.ringRadius,
        speed: 3.4,
        period: 1050,
        rgb: "56, 189, 248",
      },
      {
        lat: focusMarker.lat,
        lng: focusMarker.lng,
        maxRadius: focusMarker.ringRadius * 0.58,
        speed: 2.3,
        period: 900,
        rgb: "96, 165, 250",
      },
    ];
  }, [focusMarker, ringBurstActive, paused]);

  const getPointColor = useCallback(() => "#38bdf8", []);
  const getRingColor = useCallback(
    (r: any) => (t: number) => `rgba(${r.rgb}, ${Math.max(0, 1 - t).toFixed(3)})`,
    []
  );
  const getRingMaxRadius = useCallback((r: any) => r.maxRadius, []);
  const getRingSpeed = useCallback((r: any) => r.speed, []);
  const getRingPeriod = useCallback((r: any) => r.period, []);

  const buildPinElement = useCallback((d: any) => {
    const root = document.createElement("div");
    root.className = "cortex-globe-pin";
    root.style.pointerEvents = "none";

    const callout = document.createElement("div");
    callout.className = "cortex-globe-pin-callout";

    const badge = document.createElement("div");
    badge.className = "cortex-globe-pin-badge";

    const isoSpan = document.createElement("span");
    isoSpan.className = "cortex-globe-pin-iso";
    isoSpan.textContent = d.iso || "";

    const nameSpan = document.createElement("span");
    nameSpan.className = "cortex-globe-pin-name";
    nameSpan.textContent = d.name || d.iso || "";

    badge.appendChild(isoSpan);
    badge.appendChild(nameSpan);

    const stem = document.createElement("div");
    stem.className = "cortex-globe-pin-stem";

    callout.appendChild(badge);
    callout.appendChild(stem);

    const reticle = document.createElement("div");
    reticle.className = "cortex-globe-pin-reticle";

    const pulse = document.createElement("div");
    pulse.className = "cortex-globe-pin-pulse";

    const ring = document.createElement("div");
    ring.className = "cortex-globe-pin-ring";

    const core = document.createElement("div");
    core.className = "cortex-globe-pin-core";

    reticle.appendChild(pulse);
    reticle.appendChild(ring);
    reticle.appendChild(core);

    root.appendChild(callout);
    root.appendChild(reticle);
    return root;
  }, []);

  const handleWheel = useCallback(() => {
    wakeGlobeFor(1500, true);
  }, [wakeGlobeFor]);

  const handlePointerLeave = useCallback(() => {
    isPointerDraggingRef.current = false;
    if (!IS_TOUCH_DEVICE) {
      setTargetedCountry((prev) => (prev !== null ? null : prev));
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
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
      <CountryInfoBadge targetedCountry={targetedCountry} uiLang={uiLang} />
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
            Loading Globe…
          </span>
        </div>
      )}

      <GlobeGL
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        rendererConfig={rendererConfig}
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
        waitForGlobeReady={false}
        onGlobeReady={handleGlobeReady}
        /* ------ Country polygons ------ */
        polygonsData={countries}
        polygonCapColor={getPolygonCapColor}
        polygonSideColor={getPolygonSideColor}
        polygonStrokeColor={getPolygonStrokeColor}
        polygonAltitude={getPolygonAltitude}
        polygonCapCurvatureResolution={highQualityGraphics ? 3 : 5}
        polygonLabel={getPolygonLabel}
        /* ------ Selected country pinpoint & radar lock-on ------ */
        pointsData={focusPinPoints}
        pointLat="lat"
        pointLng="lng"
        pointColor={getPointColor}
        pointAltitude={0.085}
        pointRadius={0.28}
        pointsTransitionDuration={450}
        ringsData={focusRings}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0.032}
        ringColor={getRingColor}
        ringMaxRadius={getRingMaxRadius}
        ringPropagationSpeed={getRingSpeed}
        ringRepeatPeriod={getRingPeriod}
        htmlElementsData={focusPinPoints}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.035}
        htmlElement={buildPinElement}
        /* Interaction */
        onPolygonHover={handlePolygonHover}
        onPolygonClick={handlePolygonClick}
        /* Performance */
        polygonsTransitionDuration={450}
      />
    </div>
  );
}

export default memo(GlobeInner);
