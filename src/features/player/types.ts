import type { ChannelWithStream } from "@/shared/types";

export interface PlayerProps {
  channel: ChannelWithStream;
  onClose: () => void;
  sidebarChannels?: ChannelWithStream[];
  sidebarCountryName?: string;
  sidebarLoading?: boolean;
  sidebarError?: string | null;
  favorites?: ChannelWithStream[];
  onToggleFavorite?: (ch: ChannelWithStream) => void;
  onPlayChannel?: (ch: ChannelWithStream) => void;
  onBack?: () => void;
}

export type StreamStatus = "loading" | "playing" | "error";
