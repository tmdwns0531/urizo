interface CacheEntry<Value> {
  value: Value;
  expiresAt: number;
  staleUntil: number;
}

export interface ExpiringAsyncCacheOptions {
  ttlMs: number;
  staleIfErrorMs?: number;
  maxEntries?: number;
  now?: () => number;
}

/**
 * Small process-local cache for public, non-personalized daily-line data.
 * Concurrent misses for the same key share one loader invocation. A recently
 * expired value may be served only when the refresh fails.
 */
export class ExpiringAsyncCache<Key, Value> {
  private readonly entries = new Map<Key, CacheEntry<Value>>();
  private readonly inFlight = new Map<Key, Promise<Value>>();
  private readonly ttlMs: number;
  private readonly staleIfErrorMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: ExpiringAsyncCacheOptions) {
    this.ttlMs = positiveInteger(options.ttlMs, "ttlMs");
    this.staleIfErrorMs = nonNegativeInteger(
      options.staleIfErrorMs ?? 0,
      "staleIfErrorMs",
    );
    this.maxEntries = positiveInteger(options.maxEntries ?? 64, "maxEntries");
    this.now = options.now ?? Date.now;
  }

  async getOrLoad(key: Key, loader: () => Promise<Value>): Promise<Value> {
    const now = this.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }

    const load = loader()
      .then((value) => {
        const storedAt = this.now();
        this.entries.set(key, {
          value,
          expiresAt: storedAt + this.ttlMs,
          staleUntil: storedAt + this.ttlMs + this.staleIfErrorMs,
        });
        this.prune(storedAt);
        return value;
      })
      .catch((error: unknown) => {
        const failedAt = this.now();
        const stale = this.entries.get(key);
        if (stale && stale.staleUntil > failedAt) {
          return stale.value;
        }
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, load);
    return load;
  }

  delete(key: Key): void {
    this.entries.delete(key);
    this.inFlight.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil <= now) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as Key | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return Math.floor(value);
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return Math.floor(value);
}
