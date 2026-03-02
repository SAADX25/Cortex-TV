/* ──────────────────────────────────────────────────
   iptvWorker.types.ts – Shared message protocol
   between the main thread and the IPTV Web Worker.
   ────────────────────────────────────────────────── */

/* ── Domain types (duplicated here to keep the worker self-contained) ── */

export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  country: string;
  categories: string[];
  languages: string[];
  website: string | null;
  isNsfw: boolean;
}

export interface ChannelWithStream extends Channel {
  streamUrl: string | null;
}

/* ── Main → Worker requests ── */

export interface InitRequest {
  type: "INIT";
  rawChannels: any[];
  rawStreams: any[];
}

export interface FilterByCountryRequest {
  type: "FILTER_BY_COUNTRY";
  id: number;
  /** Pre-expanded ISO codes (e.g. ["GB","UK"]) — expansion stays on main thread */
  countryCodes: string[];
}

export interface SearchRequest {
  type: "SEARCH";
  id: number;
  query: string;
  limit: number;
  categoryFilter: string | null;
}

export interface FetchNewsRequest {
  type: "FETCH_NEWS";
  id: number;
  limit: number;
  /** Playlist channels serialised from the main thread */
  extraPlaylistChannels: ChannelWithStream[];
}

export interface ProcessFallbackRequest {
  type: "PROCESS_FALLBACK";
  id: number;
  rawChannels: any[];
}

export type WorkerRequest =
  | InitRequest
  | FilterByCountryRequest
  | SearchRequest
  | FetchNewsRequest
  | ProcessFallbackRequest;

/* ── Worker → Main responses ── */

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
  | ErrorResponse;
