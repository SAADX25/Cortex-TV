import type { ChannelWithStream, HomeData, IPTVDataStatus, MetadataOption } from "../hooks/useIPTV";

interface HomeExperienceProps {
  data: HomeData | null;
  status: IPTVDataStatus;
  favorites: ChannelWithStream[];
  recentChannels: ChannelWithStream[];
  onRetry: () => void;
  onOpenSearch: () => void;
  onPlayChannel: (channel: ChannelWithStream) => void;
  onToggleFavorite: (channel: ChannelWithStream) => void;
  onBrowseCountry: (country: MetadataOption) => void;
  onBrowseCategory: (category: string) => void;
  onOpenFavorites: () => void;
}

export default function HomeExperience(_: HomeExperienceProps) {
  return null;
}