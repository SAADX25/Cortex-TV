/* Shared message protocol between the main thread and the IPTV Web Worker. */

export type { Channel, ChannelWithStream, Stream } from "@/shared/types";
import type { ChannelWithStream } from "@/shared/types";

export interface SearchFilters {
  country?: string | null;
  category?: string | null;
  language?: string | null;
  favoritesOnly?: boolean;
  workingOnly?: boolean;
}

export interface MetadataOption {
  value: string;
  label: string;
  count: number;
}

export interface BrowseMetadata {
  channelCount: number;
  streamCount: number;
  countries: MetadataOption[];
  categories: MetadataOption[];
  languages: MetadataOption[];
}

export interface HomeData {
  featured: ChannelWithStream[];
  popular: ChannelWithStream[];
  continueBrowsing: ChannelWithStream[];
  countries: MetadataOption[];
  categories: MetadataOption[];
  languages: MetadataOption[];
  channelCount: number;
  streamCount: number;
}

/* Main -> Worker requests */

export interface InitRequest {
  type: "INIT";
  rawChannels: any[];
  rawStreams: any[];
}

export interface FilterByCountryRequest {
  type: "FILTER_BY_COUNTRY";
  id: number;
  countryCodes: string[];
}

export interface SearchRequest {
  type: "SEARCH";
  id: number;
  query: string;
  limit: number;
  filters: SearchFilters;
  favoriteIds: string[];
  recentIds: string[];
}

export interface FetchNewsRequest {
  type: "FETCH_NEWS";
  id: number;
  limit: number;
  extraPlaylistChannels: ChannelWithStream[];
}

export interface ProcessFallbackRequest {
  type: "PROCESS_FALLBACK";
  id: number;
  rawChannels: any[];
}

export interface GetHomeDataRequest {
  type: "GET_HOME_DATA";
  id: number;
  favoriteIds: string[];
  recentIds: string[];
}

export interface GetMetadataRequest {
  type: "GET_METADATA";
  id: number;
}

export type WorkerRequest =
  | InitRequest
  | FilterByCountryRequest
  | SearchRequest
  | FetchNewsRequest
  | ProcessFallbackRequest
  | GetHomeDataRequest
  | GetMetadataRequest;

/* Worker -> Main responses */

export interface InitCompleteResponse {
  type: "INIT_COMPLETE";
  channelCount: number;
  streamCount: number;
}

export interface FilterResultResponse {
  type: "FILTER_RESULT";
  id: number;
  channels: ChannelWithStream[];
}

export interface SearchResultResponse {
  type: "SEARCH_RESULT";
  id: number;
  channels: ChannelWithStream[];
}

export interface NewsResultResponse {
  type: "NEWS_RESULT";
  id: number;
  channels: ChannelWithStream[];
}

export interface FallbackResultResponse {
  type: "FALLBACK_RESULT";
  id: number;
  channels: ChannelWithStream[];
}

export interface HomeDataResponse {
  type: "HOME_DATA_RESULT";
  id: number;
  data: HomeData;
}

export interface MetadataResponse {
  type: "METADATA_RESULT";
  id: number;
  metadata: BrowseMetadata;
}

export interface ErrorResponse {
  type: "ERROR";
  id?: number;
  message: string;
}

export type WorkerResponse =
  | InitCompleteResponse
  | FilterResultResponse
  | SearchResultResponse
  | NewsResultResponse
  | FallbackResultResponse
  | HomeDataResponse
  | MetadataResponse
  | ErrorResponse;