/* ──────────────────────────────────────────────────
   useUIStore.ts – Navigation, theme, globe settings,
   and splash state.
   
   Components subscribe to individual selectors so that
   e.g. toggling night mode only re-renders Scene +
   the dark-mode button — not the entire App tree.
   ────────────────────────────────────────────────── */

import { create } from "zustand";
import type { CountryInfo } from "../components/Globe";
import { usePlayerStore } from "./usePlayerStore";

/* ── Types ── */

export interface GlobeSettings {
  rotationSpeed: number;       // 0 – 2.0  (default 0.4)
  atmosphereIntensity: number; // 0.05 – 0.5 (default 0.25)
}

export type ActiveTab = "globe" | "search" | "favorites" | "settings" | "news";

/* ── LocalStorage keys ── */
const SETTINGS_KEY = "cortex_settings";

const DEFAULT_SETTINGS: GlobeSettings = {
  rotationSpeed: 0.4,
  atmosphereIntensity: 0.25,
};

function loadSettings(): GlobeSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/* ── Store ── */

interface UIState {
  /* Navigation */
  activeTab: ActiveTab;
  selectedCountry: CountryInfo | null;
  focusCountryIso: string | null;

  /* Theme */
  isNightMode: boolean;

  /* Globe settings (persisted) */
  globeSettings: GlobeSettings;

  /* Splash */
  splashVisible: boolean;
  splashFading: boolean;

  /* ── Actions ── */
  setActiveTab: (tab: ActiveTab) => void;
  selectCountry: (country: CountryInfo | null) => void;
  setFocusCountryIso: (iso: string | null) => void;
  toggleNightMode: () => void;
  setNightMode: (v: boolean) => void;
  setGlobeSettings: (s: GlobeSettings) => void;
  setSplashFading: (v: boolean) => void;
  setSplashVisible: (v: boolean) => void;

  /**
   * Coordinated navigation: switches tab and clears
   * country selection + player in one atomic update.
   * Prevents impossible states (e.g. favorites tab
   * with a country sidebar still open).
   */
  navigateTo: (tab: ActiveTab) => void;
}

export const useUIStore = create<UIState>((set) => ({
  /* Initial values */
  activeTab: "globe",
  selectedCountry: null,
  focusCountryIso: null,
  isNightMode: false,
  globeSettings: loadSettings(),
  splashVisible: true,
  splashFading: false,

  /* Simple setters */
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectCountry: (country) => set({ selectedCountry: country }),
  setFocusCountryIso: (iso) => set({ focusCountryIso: iso }),
  toggleNightMode: () => set((s) => ({ isNightMode: !s.isNightMode })),
  setNightMode: (v) => set({ isNightMode: v }),
  setSplashFading: (v) => set({ splashFading: v }),
  setSplashVisible: (v) => set({ splashVisible: v }),

  setGlobeSettings: (s) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    set({ globeSettings: s });
  },

  /* Coordinated transition — clears cross-cutting state atomically */
  navigateTo: (tab) => {
    usePlayerStore.getState().close();
    set({ activeTab: tab, selectedCountry: null });
  },
}));
