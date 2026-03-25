type ApiCacheEntry<T> = {
  data: T;
  cachedAt: number;
  expiresAt: number;
};

type FetchJsonWithCacheOptions = {
  ttlMs?: number;
  forceRefresh?: boolean;
};

const CACHE_PREFIX = "smartlocate:api-cache:";
const inFlight = new Map<string, Promise<unknown>>();

function toStorageKey(cacheKey: string) {
  return `${CACHE_PREFIX}${cacheKey}`;
}

export function readApiCache<T>(cacheKey: string): ApiCacheEntry<T> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(toStorageKey(cacheKey));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ApiCacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeApiCache<T>(cacheKey: string, data: T, ttlMs: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const now = Date.now();
    const entry: ApiCacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + ttlMs,
    };
    window.localStorage.setItem(toStorageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // Ignore storage quota and serialization errors.
  }
}

export function invalidateApiCache(cacheKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(toStorageKey(cacheKey));
  } catch {
    // Ignore storage errors.
  }
}

export async function fetchJsonWithCache<T>(
  cacheKey: string,
  url: string,
  options: FetchJsonWithCacheOptions = {},
) {
  const ttlMs = options.ttlMs ?? 60_000;
  const forceRefresh = options.forceRefresh ?? false;
  const now = Date.now();
  const cached = readApiCache<T>(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  const existingRequest = inFlight.get(cacheKey);
  if (existingRequest && !forceRefresh) {
    return (await existingRequest) as T;
  }

  if (existingRequest && forceRefresh) {
    try {
      // Let any older request finish first, then fetch a fresh copy.
      await existingRequest;
    } catch {
      // Ignore older request failures; we'll do a fresh request below.
    }
  }

  const request = (async () => {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 304 && cached) {
      return cached.data;
    }
    if (!response.ok) {
      throw new Error("failed");
    }

    const data = (await response.json()) as T;
    writeApiCache(cacheKey, data, ttlMs);
    return data;
  })();

  inFlight.set(cacheKey, request);

  try {
    return (await request) as T;
  } catch (error) {
    // If refresh fails but stale data exists, serve stale data as fallback.
    if (cached) {
      return cached.data;
    }
    throw error;
  } finally {
    inFlight.delete(cacheKey);
  }
}