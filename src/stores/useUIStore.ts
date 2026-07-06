/* UI store: navigation, theme, globe settings, and splash state. */

import { create } from "zustand";
import type { CountryInfo } from "@/features/globe/components/Globe";
import { usePlayerStore } from "./usePlayerStore";

export type GlobeFps = "auto" | 30 | 60;

export interface GlobeSettings {
  rotationSpeed: number;       // 0 - 2.0 (default 0.4)
  atmosphereIntensity: number; // 0.05 - 0.5 (default 0.25)
  globeFps: GlobeFps;          // "auto" | 30 | 60 (default "auto")
  devMonitorVisible?: boolean; // Show Dev Monitor overlay
  autoRotate: boolean;         // Enable/disable globe auto-rotation
}

export type ActiveTab = "globe" | "search" | "favorites" | "settings" | "news";

const SETTINGS_KEY = "cortex_settings";

const DEFAULT_SETTINGS: GlobeSettings = {
  rotationSpeed: 0.4,
  atmosphereIntensity: 0.25,
  globeFps: "auto",
  devMonitorVisible: false,
  autoRotate: false,
};

function loadSettings(): GlobeSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface UIState {
  activeTab: ActiveTab;
  selectedCountry: CountryInfo | null;
  focusCountryIso: string | null;
  isNightMode: boolean;
  globeSettings: GlobeSettings;
  splashVisible: boolean;
  splashFading: boolean;

  setActiveTab: (tab: ActiveTab) => void;
  selectCountry: (country: CountryInfo | null) => void;
  setFocusCountryIso: (iso: string | null) => void;
  toggleNightMode: () => void;
  setNightMode: (v: boolean) => void;
  setGlobeSettings: (s: GlobeSettings) => void;
  setSplashFading: (v: boolean) => void;
  setSplashVisible: (v: boolean) => void;
  navigateTo: (tab: ActiveTab) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "globe",
  selectedCountry: null,
  focusCountryIso: null,
  isNightMode: false,
  globeSettings: loadSettings(),
  splashVisible: true,
  splashFading: false,

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

  navigateTo: (tab) => {
    usePlayerStore.getState().close();
    set({ activeTab: tab, selectedCountry: null });
  },
}));