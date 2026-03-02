/* ──────────────────────────────────────────────────
   iptvWorkerClient.ts – Main-thread adapter
   
   Wraps the IPTV Web Worker into clean async
   functions that mirror the old useIPTV.ts public API.
   The worker is lazily spawned on first use.
   
   All fetch() calls remain on the main thread.
   Only the raw JSON payloads are transferred to the
   worker for indexing, filtering, sorting, and search.
   ────────────────────────────────────────────────── */

import type {
  ChannelWithStream,
  WorkerRequest,
  WorkerResponse,
} from "./iptvWorker.types";
import { idbGet, idbSet, fingerprint } from "./idbCache";

/* ══════════════════════════════════════════════════
   Worker lifecycle — lazy singleton
   ══════════════════════════════════════════════════ */

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let initResolved = false;

/** Pending request callbacks keyed by request id */
const pending = new Map<
  number,
  { resolve: (data: any) => void; reject: (err: Error) => void }
>();
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("./iptvWorker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (e) => {
      console.error("[WorkerClient] Worker error:", e.message);
    };
  }
  return worker;
}

function handleWorkerMessage(e: MessageEvent<WorkerResponse>) {
  const msg = e.data;

  /* INIT_COMPLETE doesn't carry an id — resolve the init promise */
  if (msg.type === "INIT_COMPLETE") {
    initResolved = true;
    console.log(
      `[WorkerClient] Init complete — ${msg.channelCount} channels, ${msg.streamCount} streams indexed`
    );
    return;
  }

  /* ERROR may or may not have an id */
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

  /* All other responses carry an id */
  const id = (msg as any).id as number | undefined;
  if (id !== undefined) {
    const p = pending.get(id);
    pending.delete(id);
    if (p) {
      p.resolve((msg as any).channels);
    }
  }
}

/** Send a request and return a promise for the response payload. */
function request<T>(msg: Record<string, unknown>): Promise<T> {
  const id = nextId++;
  const w = getWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...msg, id });
  });
}

/* ══════════════════════════════════════════════════
   Data loading — Stale-While-Revalidate
   
   Phase 1 (fast):  Read IndexedDB cache → INIT worker
                    → resolve promise (UI renders stale)
   Phase 2 (bg):    Fetch network → compare fingerprint
                    → if changed, re-INIT worker + overwrite cache
   
   Cold launch (no cache): falls through to Phase 2 only.
   ══════════════════════════════════════════════════ */

const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const STREAMS_URL = "https://iptv-org.github.io/api/streams.json";

/**
 * Send raw JSON arrays to the worker and wait for INIT_COMPLETE.
 * Extracted so we can call it for both cached and fresh data.
 */
function sendInitToWorker(
  rawChannels: any[],
  rawStreams: any[],
): Promise<void> {
  const w = getWorker();
  return new Promise<void>((resolve, reject) => {
    const prevHandler = w.onmessage;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      w.onmessage = prevHandler;

      const msg = e.data;
      if (msg.type === "INIT_COMPLETE") {
        initResolved = true;
        console.log(
          `[WorkerClient] Init complete — ${msg.channelCount} channels, ${msg.streamCount} streams indexed`
        );
        resolve();
      } else if (msg.type === "ERROR") {
        reject(new Error(msg.message));
      } else {
        if (prevHandler) (prevHandler as any)(e);
        resolve();
      }
    };

    w.postMessage({
      type: "INIT",
      rawChannels,
      rawStreams,
    } satisfies WorkerRequest);
  });
}

/** Track fingerprints of the data currently in the worker */
let activeChHash = "";
let activeStHash = "";

/**
 * Fetch fresh JSON from the network, compare fingerprints, and
 * if changed, re-INIT the worker + overwrite the IDB cache.
 * Runs silently — errors are logged but never surface to UI.
 */
async function revalidateInBackground(): Promise<void> {
  try {
    console.log("[SWR] Background revalidation starting…");

    const [chRes, stRes] = await Promise.all([
      fetch(CHANNELS_URL),
      fetch(STREAMS_URL),
    ]);

    if (!chRes.ok || !stRes.ok) {
      console.warn("[SWR] Network fetch failed — keeping cached data");
      return;
    }

    const rawChannels: any[] = await chRes.json();
    const rawStreams: any[] = await stRes.json();

    const chHash = fingerprint(rawChannels);
    const stHash = fingerprint(rawStreams);

    if (chHash === activeChHash && stHash === activeStHash) {
      console.log("[SWR] Data unchanged — skipping re-init");
      return;
    }

    console.log(
      `[SWR] Data changed — re-initialising worker (${rawChannels.length} ch, ${rawStreams.length} st)`
    );

    await sendInitToWorker(rawChannels, rawStreams);
    activeChHash = chHash;
    activeStHash = stHash;

    /* Persist fresh data to IDB (fire-and-forget) */
    idbSet("channels", rawChannels, chHash).catch(() => {});
    idbSet("streams", rawStreams, stHash).catch(() => {});
  } catch (err) {
    console.warn("[SWR] Background revalidation error:", err);
  }
}

/**
 * Ensure the worker is initialised with channel/stream data.
 * Uses a Stale-While-Revalidate strategy:
 *
 * 1. If IndexedDB has cached data → init worker immediately (fast)
 *    then revalidate from network in the background.
 * 2. If no cache → fetch from network (original cold path).
 *
 * Safe to call multiple times — deduplicates via initPromise.
 */
export function ensureWorkerData(): Promise<void> {
  if (initResolved) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    /* ── Phase 1: Try IndexedDB cache ── */
    const [cachedCh, cachedSt] = await Promise.all([
      idbGet("channels"),
      idbGet("streams"),
    ]);

    if (cachedCh && cachedSt && cachedCh.data.length > 0) {
      console.log(
        `[SWR] Cache hit — ${cachedCh.data.length} channels, ${cachedSt.data.length} streams (age: ${Math.round((Date.now() - cachedCh.ts) / 1000)}s)`
      );

      await sendInitToWorker(cachedCh.data, cachedSt.data);
      activeChHash = cachedCh.hash;
      activeStHash = cachedSt.hash;

      /* Phase 2: Revalidate silently in the background */
      revalidateInBackground();
      return;
    }

    /* ── No cache — cold fetch ── */
    console.log("[WorkerClient] No cache — fetching from iptv-org API…");

    const [chRes, stRes] = await Promise.all([
      fetch(CHANNELS_URL),
      fetch(STREAMS_URL),
    ]);

    if (!chRes.ok) throw new Error(`Channels API: HTTP ${chRes.status}`);
    if (!stRes.ok) throw new Error(`Streams API: HTTP ${stRes.status}`);

    const rawChannels: any[] = await chRes.json();
    const rawStreams: any[] = await stRes.json();

    console.log(
      `[WorkerClient] Fetched ${rawChannels.length} channels, ${rawStreams.length} streams — sending to worker…`
    );

    await sendInitToWorker(rawChannels, rawStreams);

    const chHash = fingerprint(rawChannels);
    const stHash = fingerprint(rawStreams);
    activeChHash = chHash;
    activeStHash = stHash;

    /* Persist to IDB for next launch (fire-and-forget) */
    idbSet("channels", rawChannels, chHash).catch(() => {});
    idbSet("streams", rawStreams, stHash).catch(() => {});
  })();

  /* If init fails, allow retry */
  initPromise.catch(() => {
    initPromise = null;
    initResolved = false;
  });

  return initPromise;
}

/* ══════════════════════════════════════════════════
   Public API — drop-in replacements for the old
   useIPTV.ts exported functions
   ══════════════════════════════════════════════════ */

/**
 * Preload data (fire & forget).
 * Drop-in replacement for the old preloadIPTVData().
 */
export function preloadIPTVData(): void {
  ensureWorkerData().catch(() => {});
}

/**
 * Filter channels by country codes.
 * Returns pre-sorted results (streams first, then alphabetical).
 * 
 * @param countryCodes Already-expanded ISO codes (e.g. ["GB","UK"])
 */
export async function filterByCountry(
  countryCodes: string[]
): Promise<ChannelWithStream[]> {
  await ensureWorkerData();
  return request<ChannelWithStream[]>({
    type: "FILTER_BY_COUNTRY",
    countryCodes,
  });
}

/**
 * Global search across all channels.
 * Drop-in replacement for the old searchAllChannels().
 */
export async function searchAllChannels(
  query: string,
  limit = 80,
  categoryFilter?: string | null
): Promise<ChannelWithStream[]> {
  await ensureWorkerData();
  return request<ChannelWithStream[]>({
    type: "SEARCH",
    query,
    limit,
    categoryFilter: categoryFilter ?? null,
  });
}

/**
 * Fetch news channels (pre-indexed + playlist merge).
 * Drop-in replacement for the old fetchNewsChannels().
 */
export async function fetchNewsChannels(
  limit = 300,
  extraPlaylistChannels?: ChannelWithStream[]
): Promise<ChannelWithStream[]> {
  await ensureWorkerData();
  return request<ChannelWithStream[]>({
    type: "FETCH_NEWS",
    limit,
    extraPlaylistChannels: extraPlaylistChannels ?? [],
  });
}

/**
 * Process raw JSON from the country-endpoint fallback.
 * The fetch itself stays on the main thread; only the
 * mapping + sorting is offloaded.
 */
export async function processFallbackChannels(
  rawChannels: any[]
): Promise<ChannelWithStream[]> {
  return request<ChannelWithStream[]>({
    type: "PROCESS_FALLBACK",
    rawChannels,
  });
}
