import { GEO_BLOCK_COUNTRIES } from "@/shared/lib/channelUtils";

export interface PlaybackErrorInfo {
  title: string;
  message: string;
  icon: "lock" | "signal";
}

export function categoriseError(details: string, country?: string): PlaybackErrorInfo {
  const value = details.toLowerCase();
  const isGeoCountry = country ? GEO_BLOCK_COUNTRIES.has(country.toUpperCase()) : false;
  const restricted =
    isGeoCountry ||
    value.includes("geo") ||
    value.includes("region") ||
    value.includes("restricted") ||
    value.includes("cors") ||
    value.includes("403") ||
    value.includes("forbidden");

  if (restricted) {
    return {
      title: "Stream restricted",
      message: "This stream is restricted by the provider or region.",
      icon: "lock",
    };
  }

  return {
    title: "Stream unavailable",
    message: "Stream unavailable. Try another channel.",
    icon: "signal",
  };
}
