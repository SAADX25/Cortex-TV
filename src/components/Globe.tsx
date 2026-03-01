/* ──────────────────────────────────────────────
   Globe.tsx – Interactive 3D Globe using react-globe.gl
   Neon-styled country polygons with CDN textures.
   ────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import GlobeGL from "react-globe.gl";
import * as THREE from "three";
import Crosshair from "./Crosshair";

/* ── GeoJSON point-in-polygon (ray-casting) ── */
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
  // Must NOT be inside any hole (rings[1], rings[2], …)
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

/* ── ISO-A2 → primary IANA timezone map ── */
const COUNTRY_TZ: Record<string, string> = {
  AF:"Asia/Kabul",AL:"Europe/Tirane",DZ:"Africa/Algiers",AD:"Europe/Andorra",
  AO:"Africa/Luanda",AG:"America/Antigua",AR:"America/Argentina/Buenos_Aires",
  AM:"Asia/Yerevan",AU:"Australia/Sydney",AT:"Europe/Vienna",AZ:"Asia/Baku",
  BS:"America/Nassau",BH:"Asia/Bahrain",BD:"Asia/Dhaka",BB:"America/Barbados",
  BY:"Europe/Minsk",BE:"Europe/Brussels",BZ:"America/Belize",BJ:"Africa/Porto-Novo",
  BT:"Asia/Thimphu",BO:"America/La_Paz",BA:"Europe/Sarajevo",BW:"Africa/Gaborone",
  BR:"America/Sao_Paulo",BN:"Asia/Brunei",BG:"Europe/Sofia",BF:"Africa/Ouagadougou",
  BI:"Africa/Bujumbura",KH:"Asia/Phnom_Penh",CM:"Africa/Douala",CA:"America/Toronto",
  CV:"Atlantic/Cape_Verde",CF:"Africa/Bangui",TD:"Africa/Ndjamena",CL:"America/Santiago",
  CN:"Asia/Shanghai",CO:"America/Bogota",KM:"Indian/Comoro",CG:"Africa/Brazzaville",
  CD:"Africa/Kinshasa",CR:"America/Costa_Rica",CI:"Africa/Abidjan",HR:"Europe/Zagreb",
  CU:"America/Havana",CY:"Asia/Nicosia",CZ:"Europe/Prague",DK:"Europe/Copenhagen",
  DJ:"Africa/Djibouti",DM:"America/Dominica",DO:"America/Santo_Domingo",
  EC:"America/Guayaquil",EG:"Africa/Cairo",SV:"America/El_Salvador",GQ:"Africa/Malabo",
  ER:"Africa/Asmara",EE:"Europe/Tallinn",SZ:"Africa/Mbabane",ET:"Africa/Addis_Ababa",
  FJ:"Pacific/Fiji",FI:"Europe/Helsinki",FR:"Europe/Paris",GA:"Africa/Libreville",
  GM:"Africa/Banjul",GE:"Asia/Tbilisi",DE:"Europe/Berlin",GH:"Africa/Accra",
  GR:"Europe/Athens",GD:"America/Grenada",GT:"America/Guatemala",GN:"Africa/Conakry",
  GW:"Africa/Bissau",GY:"America/Guyana",HT:"America/Port-au-Prince",
  HN:"America/Tegucigalpa",HU:"Europe/Budapest",IS:"Atlantic/Reykjavik",
  IN:"Asia/Kolkata",ID:"Asia/Jakarta",IR:"Asia/Tehran",IQ:"Asia/Baghdad",
  IE:"Europe/Dublin",IL:"Asia/Jerusalem",IT:"Europe/Rome",JM:"America/Jamaica",
  JP:"Asia/Tokyo",JO:"Asia/Amman",KZ:"Asia/Almaty",KE:"Africa/Nairobi",
  KI:"Pacific/Tarawa",KP:"Asia/Pyongyang",KR:"Asia/Seoul",KW:"Asia/Kuwait",
  KG:"Asia/Bishkek",LA:"Asia/Vientiane",LV:"Europe/Riga",LB:"Asia/Beirut",
  LS:"Africa/Maseru",LR:"Africa/Monrovia",LY:"Africa/Tripoli",LI:"Europe/Vaduz",
  LT:"Europe/Vilnius",LU:"Europe/Luxembourg",MG:"Indian/Antananarivo",
  MW:"Africa/Blantyre",MY:"Asia/Kuala_Lumpur",MV:"Indian/Maldives",ML:"Africa/Bamako",
  MT:"Europe/Malta",MR:"Africa/Nouakchott",MU:"Indian/Mauritius",MX:"America/Mexico_City",
  MD:"Europe/Chisinau",MC:"Europe/Monaco",MN:"Asia/Ulaanbaatar",ME:"Europe/Podgorica",
  MA:"Africa/Casablanca",MZ:"Africa/Maputo",MM:"Asia/Yangon",NA:"Africa/Windhoek",
  NP:"Asia/Kathmandu",NL:"Europe/Amsterdam",NZ:"Pacific/Auckland",NI:"America/Managua",
  NE:"Africa/Niamey",NG:"Africa/Lagos",MK:"Europe/Skopje",NO:"Europe/Oslo",
  OM:"Asia/Muscat",PK:"Asia/Karachi",PA:"America/Panama",PG:"Pacific/Port_Moresby",
  PY:"America/Asuncion",PE:"America/Lima",PH:"Asia/Manila",PL:"Europe/Warsaw",
  PT:"Europe/Lisbon",QA:"Asia/Qatar",RO:"Europe/Bucharest",RU:"Europe/Moscow",
  RW:"Africa/Kigali",SA:"Asia/Riyadh",SN:"Africa/Dakar",RS:"Europe/Belgrade",
  SL:"Africa/Freetown",SG:"Asia/Singapore",SK:"Europe/Bratislava",SI:"Europe/Ljubljana",
  SB:"Pacific/Guadalcanal",SO:"Africa/Mogadishu",ZA:"Africa/Johannesburg",
  SS:"Africa/Juba",ES:"Europe/Madrid",LK:"Asia/Colombo",SD:"Africa/Khartoum",
  SR:"America/Paramaribo",SE:"Europe/Stockholm",CH:"Europe/Zurich",SY:"Asia/Damascus",
  TW:"Asia/Taipei",TJ:"Asia/Dushanbe",TZ:"Africa/Dar_es_Salaam",TH:"Asia/Bangkok",
  TL:"Asia/Dili",TG:"Africa/Lome",TO:"Pacific/Tongatapu",TT:"America/Port_of_Spain",
  TN:"Africa/Tunis",TR:"Europe/Istanbul",TM:"Asia/Ashgabat",UG:"Africa/Kampala",
  UA:"Europe/Kiev",AE:"Asia/Dubai",GB:"Europe/London",US:"America/New_York",
  UY:"America/Montevideo",UZ:"Asia/Tashkent",VU:"Pacific/Efate",VE:"America/Caracas",
  VN:"Asia/Ho_Chi_Minh",YE:"Asia/Aden",ZM:"Africa/Lusaka",ZW:"Africa/Harare",
  PS:"Asia/Hebron",XK:"Europe/Belgrade",
};

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
  rotationSpeed?: number;
  atmosphereIntensity?: number;
  focusCountryIso?: string | null;
  /** Pause auto-rotation and heavy renders (search open, video playing) */
  paused?: boolean;
}

function GlobeInner({
  onCountryClick,
  isNightMode = false,
  rotationSpeed = 0.4,
  atmosphereIntensity = 0.25,
  focusCountryIso,
  paused = false,
}: GlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [loading, setLoading] = useState(true);

  /* ── Sniper-mode state ── */
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [targetedCountry, setTargetedCountry] = useState<{
    name: string;
    iso: string;
  } | null>(null);
  const [localTime, setLocalTime] = useState<string | null>(null);

  /* ── Language toggle state ── */
  const [uiLang, setUiLang] = useState<"en" | "ar">("en");

  /* ── Three.js Raycaster (reused across frames) ── */
  const raycasterRef = useRef(new THREE.Raycaster());
  const centerNDC = useRef(new THREE.Vector2(0, 0));
  const throttleRef = useRef(0);

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
    controls.autoRotateSpeed = rotationSpeed;
    controls.enablePan = false;
    controls.minDistance = 150;
    controls.maxDistance = 500;

    // Slight initial tilt for a nicer default view
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
  }, []);

  /* ── Update rotation speed + pause state dynamically ── */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = !paused;
    controls.autoRotateSpeed = paused ? 0 : rotationSpeed;
  }, [rotationSpeed, paused]);

  /* ── Fly to country when focusCountryIso changes ── */
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
  }, [focusCountryIso, countries]);

  /* ── Helper: extract name + iso from a GeoJSON feature ── */
  const extractCountryInfo = useCallback((feature: any) => {
    if (!feature) return null;
    const props = feature.properties ?? {};
    const name = props.ADMIN || props.NAME || "Unknown";
    const clean = (v: string | undefined) => {
      const s = (v ?? "").trim();
      return s === "-99" || s === "" ? "" : s;
    };
    const iso =
      clean(props.ISO_A2) ||
      clean(props.ISO_A3) ||
      clean(props.ADM0_A3) ||
      "";
    return { name, iso };
  }, []);

  /* ── Bounding-box spatial index for fast geo rejection ── */
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
      // If bbox spans > 180° in longitude it likely crosses the antimeridian;
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

  /* ── Analytical ray-sphere intersection → lat/lng ──
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
       Avoids scene traversal  → zero GC pressure, runs at 60 fps. */
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
         polar2Cartesian  →  theta = (90 - lng) · π/180
                              x = r·sin φ·cos θ,  z = r·sin φ·sin θ
         Inverse:
           lat = 90 - acos(y / r) · 180/π
           lng = 90 - atan2(z, x) · 180/π           */
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, py / r))) * (180 / Math.PI);
    const lng = 90 - Math.atan2(pz, px) * (180 / Math.PI);
    return { lat, lng };
  }, []);

  /* ── Fallback: raycaster → polygon mesh __data at exact screen center ── */
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

    /* Single ray at exact screen center – no offsets to avoid adjacency errors */
    raycasterRef.current.setFromCamera(centerNDC.current, camera);
    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const data = (intersects[0].object as any).__data;
      if (data) return data;
    }
    return null;
  }, []);

  /* ── Primary: raycast to globe surface → lat/lng → PIP ── */
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

  /* ── Combined center lookup (geo-precise first, raycaster fallback) ── */
  const getCenterCountryCombined = useCallback((): any | null => {
    return getCenterCountryGeo() ?? getCenterCountry();
  }, [getCenterCountryGeo, getCenterCountry]);

  /* ── Select (confirm) the country at center ── */
  const selectFeature = useCallback(
    (feature: any) => {
      const info = extractCountryInfo(feature);
      if (!info) return;

      console.log(
        `%c[Cortex TV] 🎯 ${info.name} (${info.iso})`,
        "color: #00ffff; font-weight: bold; font-size: 14px;"
      );

      onCountryClick?.({ country: info });

      /* Pulse the crosshair */
      setCrosshairActive(true);
      setTimeout(() => setCrosshairActive(false), 450);
    },
    [onCountryClick, extractCountryInfo]
  );

  /* ── Sniper-mode: select whatever is under the crosshair ── */
  const selectCountryAtCenter = useCallback(() => {
    if (paused) return;
    const feature = getCenterCountryCombined();
    if (feature) {
      selectFeature(feature);
    } else {
      console.log(
        "%c[Cortex TV] 🎯 No country at center",
        "color: #555; font-size: 12px;"
      );
    }
  }, [paused, getCenterCountryCombined, selectFeature]);

  /* ── Live tracking: update label using lightweight geo-only path ── */
  const updateTargetLabel = useCallback(() => {
    const now = Date.now();
    if (now - throttleRef.current < 80) return;    // throttle to ~12 Hz
    throttleRef.current = now;

    if (paused) { setTargetedCountry(null); return; }

    // Use geo-only (bbox + PIP) — no scene traversal, no raycaster
    const feature = getCenterCountryGeo();
    const info = feature ? extractCountryInfo(feature) : null;
    setTargetedCountry(info ?? null);
  }, [paused, getCenterCountryGeo, extractCountryInfo]);

  const handlePointerMove = useCallback(() => {
    updateTargetLabel();
  }, [updateTargetLabel]);

  /* Also run the label update while the globe auto-rotates (no pointer movement) */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(updateTargetLabel, 200);   // ~5 fps label refresh during idle rotation
    return () => clearInterval(id);
  }, [paused, updateTargetLabel]);

  /* ── Tick the live clock every second when a country is targeted ── */
  useEffect(() => {
    if (!targetedCountry?.iso) { setLocalTime(null); return; }
    const tick = () => setLocalTime(getCountryTime(targetedCountry.iso));
    tick(); // immediate first render
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetedCountry?.iso]);

  /* ── Bulletproof event blocker for UI overlays ── */
  const killEvent = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  /* ── Pointer tracking: distinguish tap from drag ── */
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
         Only trigger crosshair-based selection for touch/pen (mobile);
         mouse clicks are handled by onPolygonClick instead. */
      if (dist < 12 && elapsed < 300 && e.pointerType !== "mouse") {
        selectCountryAtCenter();
      }
    },
    [selectCountryAtCenter]
  );

  /* ── Direct mouse click on polygon (PC/Desktop) ── */
  const handlePolygonClick = useCallback(
    (polygon: any, _event: MouseEvent, _coords: { lat: number; lng: number; altitude: number }) => {
      if (paused) return;
      if (polygon) selectFeature(polygon);
    },
    [paused, selectFeature]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onTouchMove={handlePointerMove}
    >
      {/* ── Language toggle button (top-left, mirrors Dark-Mode on the right) ── */}
      <button
        onTouchStart={killEvent}
        onTouchEnd={killEvent}
        onPointerDown={killEvent}
        onClick={(e) => { e.stopPropagation(); setUiLang((l) => (l === "en" ? "ar" : "en")); }}
        className="fixed top-[4.5rem] left-4 z-50 md:hidden flex items-center justify-center
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

      {/* ── Precision dot (neon blue) ── */}
      <Crosshair active={crosshairActive} />

      {/* ── World Clock badge (premium glass pill) ── */}
      <div
        className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none
                    flex items-center gap-2.5 px-5 py-2 rounded-full
                    bg-[#0f172a]/60 backdrop-blur-lg border border-white/10
                    shadow-[0_4px_30px_rgba(0,0,0,0.5)]
                    transition-all duration-300 origin-top
                    ${targetedCountry && localTime
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-95 pointer-events-none"}`}
      >
        {/* Clock icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 text-cyan-400 shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span
          className="whitespace-nowrap text-sm font-semibold tracking-wide text-white/95"
          dir={uiLang === "ar" ? "rtl" : "ltr"}
        >
          {targetedCountry?.iso
            ? getTranslatedCountryName(targetedCountry.iso, uiLang)
            : targetedCountry?.name}
          <span className="mx-2 opacity-30">|</span>
          <span className="tabular-nums">{localTime}</span>
        </span>
      </div>
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
        atmosphereAltitude={atmosphereIntensity}
        animateIn={true}
        /* ── Country polygons ── */
        polygonsData={countries}
        polygonCapColor={() =>
          paused ? "rgba(0,0,0,0)" : "rgba(0, 255, 255, 0.02)"
        }
        polygonSideColor={() => paused ? "rgba(0,0,0,0)" : "rgba(0, 255, 255, 0.05)"}
        polygonStrokeColor={() => paused ? "rgba(0,0,0,0)" : "#00ffff"}
        polygonAltitude={() => 0.005}
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
        onPolygonHover={() => {}}
        onPolygonClick={handlePolygonClick}
        /* ── Performance ── */
        polygonsTransitionDuration={paused ? 0 : 300}
      />
    </div>
  );
}

export default memo(GlobeInner);
