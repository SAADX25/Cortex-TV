/* ──────────────────────────────────────────────────
   usePlayerStore.ts – Currently playing channel.
   
   Tiny atomic slice. Only the <Player> component and
   the active-row highlight in ChannelList consume this.
   Changing the playing channel does NOT re-render the
   globe, nav bar, settings, or any other subtree.
   ────────────────────────────────────────────────── */

import { create } from "zustand";
import type { ChannelWithStream } from "../hooks/useIPTV";

interface PlayerState {
  playingChannel: ChannelWithStream | null;

  /** Start playing a channel */
  play: (channel: ChannelWithStream) => void;

  /** Stop playback and clear the playing channel */
  close: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playingChannel: null,

  play: (channel) => set({ playingChannel: channel }),

  close: () => set({ playingChannel: null }),
}));
