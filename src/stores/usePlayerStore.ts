import { create } from "zustand";
import type { ChannelWithStream } from "../hooks/useIPTV";
import { useRecentStore } from "./useRecentStore";

interface PlayerState {
  playingChannel: ChannelWithStream | null;
  play: (channel: ChannelWithStream) => void;
  close: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playingChannel: null,

  play: (channel) => {
    useRecentStore.getState().add(channel);
    set({ playingChannel: channel });
  },

  close: () => set({ playingChannel: null }),
}));