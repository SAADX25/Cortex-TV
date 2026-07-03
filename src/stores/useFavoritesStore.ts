/* ──────────────────────────────────────────────────
   useFavoritesStore.ts – Persistent favorites list.
   
   Reads from localStorage on init, auto-persists on
   every mutation via subscribe(). Only ChannelList
   star icons and the Favorites sidebar read this store
   — toggling a favorite does NOT re-render the globe,
   nav bar, player, or settings.
   ────────────────────────────────────────────────── */

import { create } from "zustand";
import type { ChannelWithStream } from "../hooks/useIPTV";

const FAVORITES_KEY = "cortex_favorites";

function isValidChannel(c: unknown): c is ChannelWithStream {
  if (!c || typeof c !== "object") return false;
  const ch = c as Record<string, unknown>;
  return (
    typeof ch.id === "string" &&
    ch.id.length > 0 &&
    typeof ch.name === "string"
  );
}

function loadFavorites(): ChannelWithStream[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isValidChannel);
  } catch {
    return [];
  }
}

interface FavoritesState {
  favorites: ChannelWithStream[];

  /** Add if not present, remove if already present */
  toggle: (channel: ChannelWithStream) => void;
}

export const useFavoritesStore = create<FavoritesState>((set) => ({
  favorites: loadFavorites(),

  toggle: (channel) =>
    set((state) => {
      const exists = state.favorites.some((c) => c.id === channel.id);
      return {
        favorites: exists
          ? state.favorites.filter((c) => c.id !== channel.id)
          : [...state.favorites, channel],
      };
    }),
}));

/* ── Auto-persist to localStorage on every change ── */
useFavoritesStore.subscribe((state) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
});
