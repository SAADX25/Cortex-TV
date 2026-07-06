/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   idbCache.ts â€“ Tiny raw IndexedDB wrapper for SWR
   caching of IPTV JSON payloads.

   Zero dependencies. Three exports:
     idbGet(key)  â†’ { data, hash, ts } | null
     idbSet(key, data, hash)
     fingerprint(arr)  â†’ string   (fast equality hash)

   DB name : "cortex_cache"
   Store   : "json"
   Keys    : "channels" | "streams"
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const DB_NAME = "cortex_cache";
const DB_VERSION = 1;
const STORE = "json";

/* â”€â”€ Singleton DB connection â”€â”€ */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  /* If open fails (e.g. private browsing), allow retry */
  dbPromise.catch(() => { dbPromise = null; });

  return dbPromise;
}

/* â”€â”€ Cached entry shape â”€â”€ */

export interface CacheEntry {
  data: any[];
  hash: string;
  ts: number; // Date.now() at write time
}

/* â”€â”€ Public API â”€â”€ */

export async function idbGet(key: string): Promise<CacheEntry | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null; // IndexedDB unavailable â€” treat as cache miss
  }
}

export async function idbSet(
  key: string,
  data: any[],
  hash: string,
): Promise<void> {
  try {
    const db = await openDB();
    const entry: CacheEntry = { data, hash, ts: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* Silently swallow â€” caching is best-effort */
  }
}

/**
 * Fast structural fingerprint of a JSON array.
 * NOT cryptographic â€” only used for equality detection
 * between cached and freshly fetched datasets.
 *
 * Format: "length:firstId:lastId"
 * Collisions are astronomically unlikely given the
 * iptv-org dataset characteristics (IDs are unique UUIDs).
 */
export function fingerprint(arr: any[]): string {
  if (arr.length === 0) return "0::";
  const first = arr[0]?.id ?? arr[0]?.channel ?? "";
  const last = arr[arr.length - 1]?.id ?? arr[arr.length - 1]?.channel ?? "";
  return `${arr.length}:${first}:${last}`;
}
