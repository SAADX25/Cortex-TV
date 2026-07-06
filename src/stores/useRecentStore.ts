import { create } from "zustand";
import type { ChannelWithStream } from "@/shared/types";

const RECENTS_KEY = "cortex_recent_channels";
const MAX_RECENTS = 24;

function isValidChannel(value: unknown): value is ChannelWithStream {
  if (!value || typeof value !== "object") return false;
  const channel = value as Record<string, unknown>;
  return typeof channel.id === "string" && typeof channel.name === "string";
}

function loadRecentChannels(): ChannelWithStream[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isValidChannel).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

interface RecentState {
  recentChannels: ChannelWithStream[];
  add: (channel: ChannelWithStream) => void;
  clear: () => void;
}

export const useRecentStore = create<RecentState>((set) => ({
  recentChannels: loadRecentChannels(),

  add: (channel) =>
    set((state) => ({
      recentChannels: [
        channel,
        ...state.recentChannels.filter((item) => item.id !== channel.id),
      ].slice(0, MAX_RECENTS),
    })),

  clear: () => set({ recentChannels: [] }),
}));

useRecentStore.subscribe((state) => {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(state.recentChannels));
});
