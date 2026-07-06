import type {
  BrowseMetadata,
  ChannelWithStream,
  HomeData,
  SearchFilters,
  WorkerRequest,
  WorkerResponse,
} from "../types";
import { fingerprint, idbGet, idbSet } from "./idbCache";

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let initResolved = false;

const pending = new Map<
  number,
  { resolve: (data: any) => void; reject: (err: Error) => void }
>();
let nextId = 1;

export type IPTVDataPhase =
  | "idle"
  | "loading"
  | "cached"
  | "updating"
  | "ready"
  | "error";

export interface IPTVDataStatus {
  phase: IPTVDataPhase;
  message: string;
  source: "cache" | "network" | null;
  channelCount: number;
  streamCount: number;
  updatedAt: number | null;
  error: string | null;
}

const statusListeners = new Set<(status: IPTVDataStatus) => void>();
let dataStatus: IPTVDataStatus = {
  phase: "idle",
  message: "Waiting to load channel data",
  source: null,
  channelCount: 0,
  streamCount: 0,
  updatedAt: null,
  error: null,
};

function emitStatus(patch: Partial<IPTVDataStatus>): void {
  dataStatus = { ...dataStatus, ...patch };
  for (const listener of statusListeners) listener(dataStatus);
}

export function getIPTVDataStatus(): IPTVDataStatus {
  return dataStatus;
}

export function subscribeIPTVDataStatus(
  listener: (status: IPTVDataStatus) => void,
): () => void {
  statusListeners.add(listener);
  listener(dataStatus);
  return () => statusListeners.delete(listener);
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./iptvWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (e) => {
      console.error("[WorkerClient] Worker error:", e.message);
      emitStatus({
        phase: "error",
        message: "Worker failed while preparing channel data",
        error: e.message,
      });
    };
  }
  return worker;
}

function resolvePayload(msg: WorkerResponse): any {
  switch (msg.type) {
    case "FILTER_RESULT":
    case "SEARCH_RESULT":
    case "NEWS_RESULT":
    case "FALLBACK_RESULT":
      return msg.channels;
    case "HOME_DATA_RESULT":
      return msg.data;
    case "METADATA_RESULT":
      return msg.metadata;
    default:
      return undefined;
  }
}

function handleWorkerMessage(e: MessageEvent<WorkerResponse>) {
  const msg = e.data;

  if (msg.type === "STATUS_UPDATE") {
    emitStatus(msg.statusPatch);
    return;
  }

  if (msg.type === "INIT_COMPLETE") {
    initResolved = true;
    console.log(
      `[WorkerClient] Init complete - ${msg.channelCount} channels, ${msg.streamCount} streams indexed`,
    );
    if (initResolveFn) {
      initResolveFn();
      initResolveFn = null;
      initRejectFn = null;
    }
    return;
  }

  if (msg.type === "ERROR") {
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      p?.reject(new Error(msg.message));
    } else {
      console.error("[WorkerClient] Worker error:", msg.message);
      if (initRejectFn) {
        initRejectFn(new Error(msg.message));
        initResolveFn = null;
        initRejectFn = null;
      }
    }
    return;
  }

  const id = (msg as any).id as number | undefined;
  if (id !== undefined) {
    const p = pending.get(id);
    pending.delete(id);
    p?.resolve(resolvePayload(msg));
  }
}

function request<T>(msg: Record<string, unknown>): Promise<T> {
  const id = nextId++;
  const w = getWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...msg, id });
  });
}

let initResolveFn: (() => void) | null = null;
let initRejectFn: ((err: Error) => void) | null = null;

export function ensureWorkerData(): Promise<void> {
  if (initResolved) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    initResolveFn = resolve;
    initRejectFn = reject;

    emitStatus({
      phase: "loading",
      message: "Initializing worker...",
      source: null,
      error: null,
    });

    const w = getWorker();
    w.postMessage({ type: "INIT" } satisfies WorkerRequest);
  });

  initPromise.catch((err: any) => {
    initPromise = null;
    initResolved = false;
    emitStatus({
      phase: "error",
      message: "Failed to initialize worker",
      source: null,
      error: err?.message ?? "Failed to init worker",
    });
  });

  return initPromise;
}

export function preloadIPTVData(): void {
  ensureWorkerData().catch(() => {});
}

export async function filterByCountry(countryCodes: string[]): Promise<ChannelWithStream[]> {
  await ensureWorkerData();
  return request<ChannelWithStream[]>({ type: "FILTER_BY_COUNTRY", countryCodes });
}

export async function searchAllChannels(
  query: string,
  limit = 80,
  filtersOrCategory?: SearchFilters | string | null,
  favoriteIds: string[] = [],
  recentIds: string[] = [],
): Promise<ChannelWithStream[]> {
  await ensureWorkerData();
  const filters: SearchFilters =
    typeof filtersOrCategory === "string" || filtersOrCategory === null
      ? { category: filtersOrCategory ?? null }
      : filtersOrCategory ?? {};
  return request<ChannelWithStream[]>({
    type: "SEARCH",
    query,
    limit,
    filters,
    favoriteIds,
    recentIds,
  });
}

export async function fetchNewsChannels(
  limit = 300,
  extraPlaylistChannels?: ChannelWithStream[],
): Promise<ChannelWithStream[]> {
  await ensureWorkerData();
  return request<ChannelWithStream[]>({
    type: "FETCH_NEWS",
    limit,
    extraPlaylistChannels: extraPlaylistChannels ?? [],
  });
}

export async function processFallbackChannels(rawChannels: any[]): Promise<ChannelWithStream[]> {
  return request<ChannelWithStream[]>({ type: "PROCESS_FALLBACK", rawChannels });
}

export async function getHomeData(
  favoriteIds: string[] = [],
  recentIds: string[] = [],
): Promise<HomeData> {
  await ensureWorkerData();
  return request<HomeData>({ type: "GET_HOME_DATA", favoriteIds, recentIds });
}

export async function getBrowseMetadata(): Promise<BrowseMetadata> {
  await ensureWorkerData();
  return request<BrowseMetadata>({ type: "GET_METADATA" });
}