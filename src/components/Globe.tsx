/* ──────────────────────────────────────────────
   Globe.tsx – Interactive 3D Globe using react-globe.gl
   Neon-styled country polygons with CDN textures.
   ────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import GlobeGL from "react-globe.gl";
import * as THREE from "three";
import Crosshair from "./Crosshair";
import { flagUrl } from "../utils/channelUtils";

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
  PS:"Asia/Hebron",XK:"Europe/Belgrade",EH:"Africa/El_Aaiun",
};

/* ── ISO-A2 → Capital city name ── */
const COUNTRY_CAPITAL: Record<string, string> = {
  AF:"Kabul",AL:"Tirana",DZ:"Algiers",AD:"Andorra la Vella",AO:"Luanda",
  AG:"St. John's",AR:"Buenos Aires",AM:"Yerevan",AU:"Canberra",AT:"Vienna",
  AZ:"Baku",BS:"Nassau",BH:"Manama",BD:"Dhaka",BB:"Bridgetown",BY:"Minsk",
  BE:"Brussels",BZ:"Belmopan",BJ:"Porto-Novo",BT:"Thimphu",BO:"Sucre",
  BA:"Sarajevo",BW:"Gaborone",BR:"Brasília",BN:"Bandar Seri Begawan",
  BG:"Sofia",BF:"Ouagadougou",BI:"Gitega",KH:"Phnom Penh",CM:"Yaoundé",
  CA:"Ottawa",CV:"Praia",CF:"Bangui",TD:"N'Djamena",CL:"Santiago",
  CN:"Beijing",CO:"Bogotá",KM:"Moroni",CG:"Brazzaville",CD:"Kinshasa",
  CR:"San José",CI:"Yamoussoukro",HR:"Zagreb",CU:"Havana",CY:"Nicosia",
  CZ:"Prague",DK:"Copenhagen",DJ:"Djibouti",DM:"Roseau",DO:"Santo Domingo",
  EC:"Quito",EG:"Cairo",SV:"San Salvador",GQ:"Malabo",ER:"Asmara",
  EE:"Tallinn",SZ:"Mbabane",ET:"Addis Ababa",FJ:"Suva",FI:"Helsinki",
  FR:"Paris",GA:"Libreville",GM:"Banjul",GE:"Tbilisi",DE:"Berlin",
  GH:"Accra",GR:"Athens",GD:"St. George's",GT:"Guatemala City",GN:"Conakry",
  GW:"Bissau",GY:"Georgetown",HT:"Port-au-Prince",HN:"Tegucigalpa",
  HU:"Budapest",IS:"Reykjavik",IN:"New Delhi",ID:"Jakarta",IR:"Tehran",
  IQ:"Baghdad",IE:"Dublin",IL:"Jerusalem",IT:"Rome",JM:"Kingston",
  JP:"Tokyo",JO:"Amman",KZ:"Astana",KE:"Nairobi",KI:"Tarawa",
  KP:"Pyongyang",KR:"Seoul",KW:"Kuwait City",KG:"Bishkek",LA:"Vientiane",
  LV:"Riga",LB:"Beirut",LS:"Maseru",LR:"Monrovia",LY:"Tripoli",
  LI:"Vaduz",LT:"Vilnius",LU:"Luxembourg",MG:"Antananarivo",MW:"Lilongwe",
  MY:"Kuala Lumpur",MV:"Malé",ML:"Bamako",MT:"Valletta",MR:"Nouakchott",
  MU:"Port Louis",MX:"Mexico City",MD:"Chișinău",MC:"Monaco",MN:"Ulaanbaatar",
  ME:"Podgorica",MA:"Rabat",MZ:"Maputo",MM:"Naypyidaw",NA:"Windhoek",
  NP:"Kathmandu",NL:"Amsterdam",NZ:"Wellington",NI:"Managua",NE:"Niamey",
  NG:"Abuja",MK:"Skopje",NO:"Oslo",OM:"Muscat",PK:"Islamabad",
  PA:"Panama City",PG:"Port Moresby",PY:"Asunción",PE:"Lima",PH:"Manila",
  PL:"Warsaw",PT:"Lisbon",QA:"Doha",RO:"Bucharest",RU:"Moscow",
  RW:"Kigali",SA:"Riyadh",SN:"Dakar",RS:"Belgrade",SL:"Freetown",
  SG:"Singapore",SK:"Bratislava",SI:"Ljubljana",SB:"Honiara",SO:"Mogadishu",
  ZA:"Pretoria",SS:"Juba",ES:"Madrid",LK:"Colombo",SD:"Khartoum",
  SR:"Paramaribo",SE:"Stockholm",CH:"Bern",SY:"Damascus",TW:"Taipei",
  TJ:"Dushanbe",TZ:"Dodoma",TH:"Bangkok",TL:"Dili",TG:"Lomé",
  TO:"Nukuʻalofa",TT:"Port of Spain",TN:"Tunis",TR:"Ankara",TM:"Ashgabat",
  UG:"Kampala",UA:"Kyiv",AE:"Abu Dhabi",GB:"London",US:"Washington, D.C.",
  UY:"Montevideo",UZ:"Tashkent",VU:"Port Vila",VE:"Caracas",
  VN:"Hanoi",YE:"Sana'a",ZM:"Lusaka",ZW:"Harare",PS:"Ramallah",XK:"Pristina",
  EH:"Laayoune",
};

/* ── ISO-A3 / ADM0_A3 → ISO-A2  (comprehensive, covers all Natural Earth entries) ── */
const A3_TO_A2: Record<string, string> = {
  AFG:"AF",ALB:"AL",DZA:"DZ",AND:"AD",AGO:"AO",ATG:"AG",ARG:"AR",ARM:"AM",
  AUS:"AU",AUT:"AT",AZE:"AZ",BHS:"BS",BHR:"BH",BGD:"BD",BRB:"BB",BLR:"BY",
  BEL:"BE",BLZ:"BZ",BEN:"BJ",BTN:"BT",BOL:"BO",BIH:"BA",BWA:"BW",BRA:"BR",
  BRN:"BN",BGR:"BG",BFA:"BF",BDI:"BI",KHM:"KH",CMR:"CM",CAN:"CA",CPV:"CV",
  CAF:"CF",TCD:"TD",CHL:"CL",CHN:"CN",COL:"CO",COM:"KM",COG:"CG",COD:"CD",
  CRI:"CR",CIV:"CI",HRV:"HR",CUB:"CU",CYP:"CY",CZE:"CZ",DNK:"DK",DJI:"DJ",
  DMA:"DM",DOM:"DO",ECU:"EC",EGY:"EG",SLV:"SV",GNQ:"GQ",ERI:"ER",EST:"EE",
  SWZ:"SZ",ETH:"ET",FJI:"FJ",FIN:"FI",FRA:"FR",GAB:"GA",GMB:"GM",GEO:"GE",
  DEU:"DE",GHA:"GH",GRC:"GR",GRD:"GD",GTM:"GT",GIN:"GN",GNB:"GW",GUY:"GY",
  HTI:"HT",HND:"HN",HUN:"HU",ISL:"IS",IND:"IN",IDN:"ID",IRN:"IR",IRQ:"IQ",
  IRL:"IE",ISR:"IL",ITA:"IT",JAM:"JM",JPN:"JP",JOR:"JO",KAZ:"KZ",KEN:"KE",
  KIR:"KI",PRK:"KP",KOR:"KR",KWT:"KW",KGZ:"KG",LAO:"LA",LVA:"LV",LBN:"LB",
  LSO:"LS",LBR:"LR",LBY:"LY",LIE:"LI",LTU:"LT",LUX:"LU",MDG:"MG",MWI:"MW",
  MYS:"MY",MDV:"MV",MLI:"ML",MLT:"MT",MRT:"MR",MUS:"MU",MEX:"MX",MDA:"MD",
  MCO:"MC",MNG:"MN",MNE:"ME",MAR:"MA",MOZ:"MZ",MMR:"MM",NAM:"NA",NPL:"NP",
  NLD:"NL",NZL:"NZ",NIC:"NI",NER:"NE",NGA:"NG",MKD:"MK",NOR:"NO",OMN:"OM",
  PAK:"PK",PAN:"PA",PNG:"PG",PRY:"PY",PER:"PE",PHL:"PH",POL:"PL",PRT:"PT",
  QAT:"QA",ROU:"RO",RUS:"RU",RWA:"RW",SAU:"SA",SEN:"SN",SRB:"RS",SLE:"SL",
  SGP:"SG",SVK:"SK",SVN:"SI",SLB:"SB",SOM:"SO",ZAF:"ZA",SSD:"SS",ESP:"ES",
  LKA:"LK",SDN:"SD",SUR:"SR",SWE:"SE",CHE:"CH",SYR:"SY",TWN:"TW",TJK:"TJ",
  TZA:"TZ",THA:"TH",TLS:"TL",TGO:"TG",TON:"TO",TTO:"TT",TUN:"TN",TUR:"TR",
  TKM:"TM",UGA:"UG",UKR:"UA",ARE:"AE",GBR:"GB",USA:"US",URY:"UY",UZB:"UZ",
  VUT:"VU",VEN:"VE",VNM:"VN",YEM:"YE",ZMB:"ZM",ZWE:"ZW",PSE:"PS",ESH:"EH",
  /* Natural Earth special ADM0_A3 codes */
  KOS:"XK",  /* Kosovo */
  SOL:"SO",  /* Somaliland → Somalia fallback */
  CYN:"CY",  /* Northern Cyprus → Cyprus */
  KAS:"IN",  /* Kashmir → India */
  SAH:"EH",  /* Western Sahara */
  SDS:"SS",  /* South Sudan (alternate) */
  NRU:"NR",WSM:"WS",FSM:"FM",PLW:"PW",MHL:"MH",TUV:"TV",
  SCG:"RS",  /* Serbia and Montenegro legacy */
  GRL:"GL",  /* Greenland */
  NCL:"NC",  /* New Caledonia */
  PYF:"PF",  /* French Polynesia */
  FLK:"FK",  /* Falkland Islands */
  GUF:"GF",  /* French Guiana */
  ATF:"TF",  /* French Southern Territories */
  SPM:"PM",  /* Saint Pierre and Miquelon */
  WLF:"WF",  /* Wallis and Futuna */
  REU:"RE",  /* Réunion */
  MYT:"YT",  /* Mayotte */
  MTQ:"MQ",  /* Martinique */
  GLP:"GP",  /* Guadeloupe */
  PRI:"PR",  /* Puerto Rico */
  VIR:"VI",  /* US Virgin Islands */
  GUM:"GU",  /* Guam */
  ASM:"AS",  /* American Samoa */
  MNP:"MP",  /* Northern Mariana Islands */
  CUW:"CW",ABW:"AW",SXM:"SX",BES:"BQ",
  AIA:"AI",BMU:"BM",VGB:"VG",CYM:"KY",MSR:"MS",TCA:"TC",
  SHN:"SH",IOT:"IO",PCN:"PN",SGS:"GS",HMD:"HM",BVT:"BV",
  ATA:"AQ",SJM:"SJ",UMI:"UM",CCK:"CC",CXR:"CX",NFK:"NF",
  TKL:"TK",NIU:"NU",COK:"CK",MAC:"MO",HKG:"HK",
};

/* ── ADMIN name → ISO-A2 (fallback for entries with no valid codes) ── */
const ADMIN_TO_A2: Record<string, string> = {
  "france":"FR","norway":"NO","northern cyprus":"CY","kosovo":"XK",
  "somaliland":"SO","western sahara":"EH","united states of america":"US",
  "united kingdom":"GB","united arab emirates":"AE","south korea":"KR",
  "north korea":"KP","south sudan":"SS","democratic republic of the congo":"CD",
  "republic of the congo":"CG","ivory coast":"CI","c\u00f4te d'ivoire":"CI",
  "czech republic":"CZ","czechia":"CZ","eswatini":"SZ","swaziland":"SZ",
  "timor-leste":"TL","east timor":"TL","myanmar":"MM","burma":"MM",
  "republic of serbia":"RS","the bahamas":"BS","bahamas":"BS",
  "trinidad and tobago":"TT","bosnia and herzegovina":"BA",
  "antigua and barbuda":"AG","saint lucia":"LC","saint kitts and nevis":"KN",
  "saint vincent and the grenadines":"VC","greenland":"GL",
  "new caledonia":"NC","puerto rico":"PR","papua new guinea":"PG",
  "central african republic":"CF","solomon islands":"SB",
  "sierra leone":"SL","burkina faso":"BF","equatorial guinea":"GQ",
  "dominican republic":"DO","saudi arabia":"SA","south africa":"ZA",
  "sri lanka":"LK","new zealand":"NZ","costa rica":"CR","el salvador":"SV",
  "taiwan":"TW","palestine":"PS","state of palestine":"PS","falkland islands":"FK",
  "french guiana":"GF","r\u00e9union":"RE","reunion":"RE","mayotte":"YT",
  "martinique":"MQ","guadeloupe":"GP",
};

/**
 * Resolve any code/name from GeoJSON properties to a valid ISO-A2 code.
 * Tries: direct 2-letter, A3→A2 lookup, ADM0_A3→A2 lookup, ADMIN name lookup.
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
  // 2) ISO_A3 → lookup
  const a3 = clean(props.ISO_A3);
  if (a3 && A3_TO_A2[a3.toUpperCase()]) return A3_TO_A2[a3.toUpperCase()];
  // 3) ADM0_A3 → lookup (different field, sometimes different value)
  const adm = clean(props.ADM0_A3);
  if (adm && A3_TO_A2[adm.toUpperCase()]) return A3_TO_A2[adm.toUpperCase()];
  // 4) WB_A2 / FIPS_10_ (some NE versions)
  const wb = clean(props.WB_A2);
  if (wb.length === 2) return wb.toUpperCase();
  // 5) ADMIN name → lookup
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

/* ── CDN asset URLs ── */
const GLOBE_DAY_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const GLOBE_NIGHT_URL =
  "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const BUMP_IMAGE_URL =
  "https://unpkg.com/three-globe/example/img/earth-topology.png";
const NIGHT_SKY_URL =
  "https://unpkg.com/three-globe/example/img/night-sky.png";
const GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson";
const GLOBE_TARGET_FPS = 20;
const GLOBE_FRAME_MS = 1000 / GLOBE_TARGET_FPS;
const MAX_GLOBE_PIXEL_RATIO = 1;
const MOBILE_TARGET_INTERVAL_MS = 250;
const GLOBE_RENDERER_CONFIG = {
  antialias: false,
  alpha: true,
  powerPreference: "low-power" as WebGLPowerPreference,
};

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
  const rafIdRef = useRef(0);

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

    globe.renderer?.()?.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_GLOBE_PIXEL_RATIO));

    // Slight initial tilt for a nicer default view
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
  }, []);

  useEffect(() => {
    return () => {
      const globe = globeRef.current;
      const renderer = globe?.renderer?.();
      renderer?.setAnimationLoop?.(null);
      renderer?.dispose?.();
      renderer?.forceContextLoss?.();
    };
  }, []);

  /* ── Update rotation speed + pause state dynamically ── */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = !paused;
    controls.autoRotateSpeed = paused ? 0 : rotationSpeed;
  }, [rotationSpeed, paused]);

  /* ── Freeze / resume the Three.js render loop (battery saver) ──
     When paused, setAnimationLoop(null) cancels the internal rAF.
     No frames rendered, no shaders execute → 0% GPU while hidden.
     On resume the existing WebGL context + textures are reused instantly. */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const renderer = globe.renderer?.();
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_GLOBE_PIXEL_RATIO));
    let lastFrame = 0;

    if (paused) {
      renderer.setAnimationLoop(null);
    } else {
      renderer.setAnimationLoop((time: number = performance.now()) => {
        if (time - lastFrame < GLOBE_FRAME_MS) return;
        lastFrame = time;
        const ctrl = globe.controls?.();
        if (ctrl) ctrl.update();
        renderer.render(globe.scene(), globe.camera());
      });
    }

    /* Cleanup: ensure the loop is stopped if the component unmounts while running */
    return () => {
      renderer.setAnimationLoop(null);
    };
  }, [paused]);

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
    const adminName = props.ADMIN || props.NAME || 'Unknown';
    const iso = resolveIsoA2(props);
    // Always produce a human-readable name, never a raw code
    const name = iso
      ? getTranslatedCountryName(iso, 'en')
      : adminName;
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
    let lng = 90 - Math.atan2(pz, px) * (180 / Math.PI);
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
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

  /* ── Live tracking via rAF loop (MOBILE only, 60fps-synced) ── */
  const updateTargetLabel = useCallback(() => {
    if (!IS_TOUCH_DEVICE) return;
    if (paused) { setTargetedCountry(null); setLocalTime(null); return; }

    const feature = getCenterCountryGeo();
    const info = feature ? extractCountryInfo(feature) : null;
    setTargetedCountry(info ?? null);
    setLocalTime(info?.iso ? getCountryTime(info.iso) : null);
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

  /* ── Desktop: mouse hover on polygon → update badge ── */
  const handlePolygonHover = useCallback(
    (polygon: any) => {
      if (IS_TOUCH_DEVICE || paused) return;
      if (!polygon) {
        setTargetedCountry(null);
        setLocalTime(null);
        return;
      }
      const info = extractCountryInfo(polygon);
      setTargetedCountry(info ?? null);
      setLocalTime(info?.iso ? getCountryTime(info.iso) : null);
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
      {/* ── Language toggle button (top-left, mirrors Dark-Mode on the right) ── */}
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

      {/* ── Precision dot (neon blue) ── */}
      <Crosshair active={crosshairActive} />

      {/* ── Country Info Badge (iOS Glassmorphism) ── */}
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
              {/* ── Top Row: Flag + Country Name ── */}
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
              {/* ── Bottom Row: Clock + Time + Capital (only if data exists) ── */}
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
        rendererConfig={GLOBE_RENDERER_CONFIG}
        /* ── Textures ── */
        globeImageUrl={isNightMode ? GLOBE_NIGHT_URL : GLOBE_DAY_URL}
        bumpImageUrl={undefined}
        /* ── Scene ── */
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={undefined}
        enablePointerInteraction={!paused}
        showAtmosphere={false}
        atmosphereColor={isNightMode ? "#0066cc" : "#00bfff"}
        atmosphereAltitude={atmosphereIntensity}
        animateIn={false}
        /* ── Country polygons ── */
        polygonsData={countries}
        polygonCapColor={() =>
          paused ? "rgba(0,0,0,0)" : "rgba(0, 255, 255, 0.02)"
        }
        polygonSideColor={() => paused ? "rgba(0,0,0,0)" : "rgba(0, 255, 255, 0.05)"}
        polygonStrokeColor={() => paused ? "rgba(0,0,0,0)" : "#00ffff"}
        polygonAltitude={() => 0.005}
        polygonCapCurvatureResolution={1}
        polygonLabel={() => ''}
        /* ── Interaction ── */
        onPolygonHover={handlePolygonHover}
        onPolygonClick={handlePolygonClick}
        /* ── Performance ── */
        polygonsTransitionDuration={0}
      />
    </div>
  );
}

export default memo(GlobeInner);
