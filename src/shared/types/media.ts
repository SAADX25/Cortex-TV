export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  country: string;
  categories: string[];
  languages: string[];
  website: string | null;
  isNsfw: boolean;
  altNames?: string[];
}

export interface ChannelWithStream extends Channel {
  streamUrl: string | null;
  streamStatus?: string | null;
  countryName?: string;
  languageNames?: string[];
}

export interface Stream {
  channel: string;
  url: string;
  status?: string | null;
}

export type PlaybackState = "loading" | "playing" | "error";

export type Platform = "web" | "electron" | "ios" | "android";
