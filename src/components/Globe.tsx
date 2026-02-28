/* ──────────────────────────────────────────────
   Globe.tsx – Interactive 3D Globe using react-globe.gl
   Neon-styled country polygons with CDN textures.
   ────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback, memo } from "react";
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

/** Check whether a GeoJSON feature (Polygon / MultiPolygon) contains a point. */
function geoContainsPoint(
  feature: any,
  lng: number,
  lat: number
): boolean {
  const geom = feature?.geometry;
  if (!geom) return false;
  if (geom.type === "Polygon") {
    return pointInRing2D(lng, lat, geom.coordinates[0]);
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((poly: number[][][]) =>
      pointInRing2D(lng, lat, poly[0])
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

  /* ── Three.js Raycaster: find polygon mesh at screen center ── */
  const getCenterCountry = useCallback((): any | null => {
    const globe = globeRef.current;
    if (!globe) return null;

    const camera = globe.camera();
    const scene = globe.scene();
    if (!camera || !scene) return null;

    raycasterRef.current.setFromCamera(centerNDC.current, camera);

    /* Collect all polygon-layer meshes from the scene graph.
       react-globe.gl nests polygons inside a group whose children
       are individual country Mesh objects with __data bound. */
    const meshes: THREE.Object3D[] = [];
    scene.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh && (obj as any).__data) {
        meshes.push(obj);
      }
    });

    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      return (intersects[0].object as any).__data ?? null;
    }
    return null;
  }, []);

  /* ── Fallback: geo point-in-polygon when raycaster finds nothing ── */
  const getCenterCountryGeo = useCallback((): any | null => {
    if (!globeRef.current || countries.length === 0) return null;
    const pov = globeRef.current.pointOfView();
    const { lat, lng } = pov as { lat: number; lng: number };
    return countries.find((f: any) => geoContainsPoint(f, lng, lat)) ?? null;
  }, [countries]);

  /* ── Combined center lookup (raycast first, geo fallback) ── */
  const getCenterCountryCombined = useCallback((): any | null => {
    return getCenterCountry() ?? getCenterCountryGeo();
  }, [getCenterCountry, getCenterCountryGeo]);

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

  /* ── Live tracking: update label on every move (throttled ~60 ms) ── */
  const updateTargetLabel = useCallback(() => {
    const now = Date.now();
    if (now - throttleRef.current < 60) return;   // throttle
    throttleRef.current = now;

    if (paused) { setTargetedCountry(null); return; }

    const feature = getCenterCountryCombined();
    const info = feature ? extractCountryInfo(feature) : null;
    setTargetedCountry(info ?? null);
  }, [paused, getCenterCountryCombined, extractCountryInfo]);

  const handlePointerMove = useCallback(() => {
    updateTargetLabel();
  }, [updateTargetLabel]);

  /* Also run the label update while the globe auto-rotates (no pointer movement) */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(updateTargetLabel, 120);
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

  /* ── Pointer tracking: distinguish tap from drag ── */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const down = pointerDownRef.current;
      if (!down) return;
      pointerDownRef.current = null;

      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - down.time;

      /* Quick tap: < 12 px movement and < 300 ms */
      if (dist < 12 && elapsed < 300) {
        selectCountryAtCenter();
      }
    },
    [selectCountryAtCenter]
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

      {/* ── Sniper-mode crosshair + live label ── */}
      <Crosshair
        active={crosshairActive}
        targetName={
          targetedCountry?.iso
            ? getTranslatedCountryName(targetedCountry.iso, uiLang)
            : null
        }
      />

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
        /* ── Interaction: disabled for Sniper Mode ── */
        onPolygonHover={() => {}}
        onPolygonClick={() => {}}
        /* ── Performance ── */
        polygonsTransitionDuration={paused ? 0 : 300}
      />
    </div>
  );
}

export default memo(GlobeInner);
