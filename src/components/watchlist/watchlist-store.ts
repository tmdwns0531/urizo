"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PublicAccount } from "@/contracts/account";
import type { WatchlistEntry } from "@/domains/watchlist/coverage";

/**
 * 찜 목록은 서버의 계정에 붙어 있다. 브라우저에 두면 기기를 바꾸는 순간
 * 사라져서, "내 목록" 이라고 부를 수 없다.
 *
 * 상태를 화면마다 따로 가져오지 않도록 프로세스에 하나만 두고 구독으로 나눈다.
 * 헤더의 개수와 목록 화면이 같은 값을 봐야 한다.
 */

export type WatchlistState = {
  account: PublicAccount | null;
  entries: WatchlistEntry[];
  /** 첫 조회가 끝나기 전에는 "로그인 필요" 를 띄우면 안 된다. */
  loading: boolean;
};

type Listener = () => void;

/** 서버 렌더에서 쓰는 고정 값. 매번 새 객체를 주면 무한히 다시 그린다. */
const INITIAL: WatchlistState = { account: null, entries: [], loading: true };

let state: WatchlistState = INITIAL;
const listeners = new Set<Listener>();
let loaded: Promise<void> | null = null;

function publish(next: Partial<WatchlistState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

async function loadEntries(): Promise<void> {
  const response = await request("/api/watchlist");
  if (response.status === 401) {
    publish({ entries: [] });
    return;
  }
  if (!response.ok) return;
  const body = (await response.json()) as { entries?: WatchlistEntry[] };
  publish({ entries: body.entries ?? [] });
}

async function loadOnce(): Promise<void> {
  const session = await request("/api/account/session");
  const body = session.ok
    ? ((await session.json()) as { account?: PublicAccount | null })
    : { account: null };
  const account = body.account ?? null;
  publish({ account });
  if (account) await loadEntries();
  publish({ loading: false });
}

function ensureLoaded(): void {
  if (loaded === null) {
    loaded = loadOnce().catch(() => {
      // 네트워크가 끊겨도 화면은 떠야 한다. 비로그인으로 보고 넘어간다.
      publish({ loading: false });
    });
  }
}

/**
 * 구독이 붙는 시점에 첫 조회를 시작한다. 화면이 여러 개 붙어도 `ensureLoaded`
 * 가 한 번만 실제로 부른다.
 */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): WatchlistState => state;
const getServerSnapshot = (): WatchlistState => INITIAL;

/** 로그인·로그아웃 뒤 목록을 다시 맞춘다. */
export async function refreshWatchlist(): Promise<void> {
  loaded = loadOnce();
  await loaded;
}

export function useWatchlist(): WatchlistState & {
  has: (contentId: string) => boolean;
  add: (contentId: string) => Promise<"ok" | "unauthorized" | "failed">;
  remove: (contentId: string) => Promise<void>;
  clear: () => Promise<void>;
  logout: () => Promise<void>;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback(async (contentId: string) => {
    const response = await request("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ contentId }),
    });
    if (response.status === 401) return "unauthorized" as const;
    if (!response.ok) return "failed" as const;
    const body = (await response.json()) as { entry?: WatchlistEntry };
    if (body.entry) {
      // 방금 담은 것을 앞에 둔다. 목록에서 찾게 만들지 않는다.
      const without = state.entries.filter((e) => e.id !== body.entry!.id);
      publish({ entries: [body.entry, ...without] });
    }
    return "ok" as const;
  }, []);

  const remove = useCallback(async (contentId: string) => {
    publish({ entries: state.entries.filter((e) => e.id !== contentId) });
    const response = await request(
      `/api/watchlist?contentId=${encodeURIComponent(contentId)}`,
      { method: "DELETE" },
    );
    // 서버가 거절했으면 화면을 되돌린다.
    if (!response.ok) await loadEntries();
  }, []);

  const clear = useCallback(async () => {
    const previous = state.entries;
    publish({ entries: [] });
    const response = await request("/api/watchlist", { method: "DELETE" });
    if (!response.ok) publish({ entries: previous });
  }, []);

  const logout = useCallback(async () => {
    await request("/api/account/session", { method: "DELETE" });
    publish({ account: null, entries: [] });
  }, []);

  return {
    ...current,
    has: (contentId) => current.entries.some((entry) => entry.id === contentId),
    add,
    remove,
    clear,
    logout,
  };
}
