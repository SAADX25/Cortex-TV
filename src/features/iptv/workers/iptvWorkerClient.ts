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

  if (msg.type === "INIT_COMPLETE") {
    initResolved = true;
    console.log(
      `[WorkerClient] Init complete - ${msg.channelCount} channels, ${msg.streamCount} streams indexed`,
    );
    return;
  }

  if (msg.type === "ERROR") {
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      p?.reject(new Error(msg.message));
    } else {
      console.error("[WorkerClient] Worker error:", msg.message);
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

const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const STREAMS_URL = "https://iptv-org.github.io/api/streams.json";

interface InitStats {
  channelCount: number;
  streamCount: number;
}

function sendInitToWorker(rawChannels: any[], rawStreams: any[]): Promise<InitStats> {
  const w = getWorker();
  return new Promise<InitStats>((resolve, reject) => {
    const prevHandler = w.onmessage;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      w.onmessage = prevHandler;
      const msg = e.data;
      if (msg.type === "INIT_COMPLETE") {
        initResolved = true;
        console.log(
          `[WorkerClient] Init complete - ${msg.channelCount} channels, ${msg.streamCount} streams indexed`,
        );
        resolve({ channelCount: msg.channelCount, streamCount: msg.streamCount });
      } else if (msg.type === "ERROR") {
        reject(new Error(msg.message));
      } else {
        if (prevHandler) (prevHandler as any)(e);
        reject(new Error("Unexpected worker response during init"));
      }
    };

    w.postMessage({
      type: "INIT",
      rawChannels,
      rawStreams,
    } satisfies WorkerRequest);
  });
}

let activeChHash = "";
let activeStHash = "";
const CACHE_REVALIDATE_DELAY_MS = 5 * 60 * 1000;
let revalidateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRevalidateInBackground(): void {
  if (revalidateTimer) return;
  revalidateTimer = setTimeout(() => {
    revalidateTimer = null;
    revalidateInBackground();
  }, CACHE_REVALIDATE_DELAY_MS);
}

async function revalidateInBackground(): Promise<void> {
  emitStatus({
    phase: "updating",
    message: "Using cached data while checking for updates",
    source: "cache",
    error: null,
  });

  try {
    console.log("[SWR] Background revalidation starting...");
    const [chRes, stRes] = await Promise.all([fetch(CHANNELS_URL), fetch(STREAMS_URL)]);

    if (!chRes.ok || !stRes.ok) {
      console.warn("[SWR] Network fetch failed - keeping cached data");
      emitStatus({
        phase: "cached",
        message: "Using cached channel data",
        source: "cache",
        error: null,
      });
      return;
    }

    const rawChannels: any[] = await chRes.json();
    const rawStreams: any[] = await stRes.json();
    const chHash = fingerprint(rawChannels);
    const stHash = fingerprint(rawStreams);

    if (chHash === activeChHash && stHash === activeStHash) {
      console.log("[SWR] Data unchanged - skipping re-init");
      emitStatus({
        phase: "ready",
        message: "Channel data is up to date",
        source: "cache",
        updatedAt: Date.now(),
        error: null,
      });
      return;
    }

    console.log(`[SWR] Data changed - reinitialising worker (${rawChannels.length} ch, ${rawStreams.length} st)`);
    const stats = await sendInitToWorker(rawChannels, rawStreams);
    activeChHash = chHash;
    activeStHash = stHash;

    idbSet("channels", rawChannels, chHash).catch(() => {});
    idbSet("streams", rawStreams, stHash).catch(() => {});

    emitStatus({
      phase: "ready",
      message: "Channel data updated",
      source: "network",
      channelCount: stats.channelCount,
      streamCount: stats.streamCount,
      updatedAt: Date.now(),
      error: null,
    });
  } catch (err: any) {
    console.warn("[SWR] Background revalidation error:", err);
    emitStatus({
      phase: "cached",
      message: "Using cached data; update check failed",
      source: "cache",
      error: err?.message ?? null,
    });
  }
}

export function ensureWorkerData(): Promise<void> {
  if (initResolved) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    emitStatus({
      phase: "loading",
      message: "Loading channel database",
      source: null,
      error: null,
    });

    const [cachedCh, cachedSt] = await Promise.all([idbGet("channels"), idbGet("streams")]);

    if (cachedCh && cachedSt && cachedCh.data.length > 0) {
      console.log(
        `[SWR] Cache hit - ${cachedCh.data.length} channels, ${cachedSt.data.length} streams (age: ${Math.round((Date.now() - cachedCh.ts) / 1000)}s)`,
      );
      const stats = await sendInitToWorker(cachedCh.data, cachedSt.data);
      activeChHash = cachedCh.hash;
      activeStHash = cachedSt.hash;

      emitStatus({
        phase: "cached",
        message: "Using cached channel data",
        source: "cache",
        channelCount: stats.channelCount,
        streamCount: stats.streamCount,
        updatedAt: cachedCh.ts,
        error: null,
      });
      scheduleRevalidateInBackground();
      return;
    }

    console.log("[WorkerClient] No cache - fetching from iptv-org API...");
    const [chRes, stRes] = await Promise.all([fetch(CHANNELS_URL), fetch(STREAMS_URL)]);
    if (!chRes.ok) throw new Error(`Channels API: HTTP ${chRes.status}`);
    if (!stRes.ok) throw new Error(`Streams API: HTTP ${stRes.status}`);

    const rawChannels: any[] = await chRes.json();
    const rawStreams: any[] = await stRes.json();
    console.log(`[WorkerClient] Fetched ${rawChannels.length} channels, ${rawStreams.length} streams`);

    const stats = await sendInitToWorker(rawChannels, rawStreams);
    const chHash = fingerprint(rawChannels);
    const stHash = fingerprint(rawStreams);
    activeChHash = chHash;
    activeStHash = stHash;

    idbSet("channels", rawChannels, chHash).catch(() => {});
    idbSet("streams", rawStreams, stHash).catch(() => {});

    emitStatus({
      phase: "ready",
      message: "Channel database loaded",
      source: "network",
      channelCount: stats.channelCount,
      streamCount: stats.streamCount,
      updatedAt: Date.now(),
      error: null,
    });
  })();

  initPromise.catch((err: any) => {
    initPromise = null;
    initResolved = false;
    emitStatus({
      phase: "error",
      message: "Failed to load channel database",
      source: null,
      error: err?.message ?? "Failed to load channel data",
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