"use client";

import Link from "next/link";
import { useWatchlist } from "./watchlist-store";

/**
 * 담은 개수를 함께 보여준다. 찜을 눌러도 화면이 바뀌지 않아서, 숫자가 늘어나는
 * 것 말고는 담겼다는 신호가 없다.
 */
export function WatchlistNavLink() {
  const { account, entries, loading } = useWatchlist();

  return (
    <Link
      href={account ? "/watchlist" : "/login?next=%2Fwatchlist"}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-extrabold text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
    >
      <span aria-hidden="true">♥</span>
      찜 목록
      {!loading && account && entries.length > 0 ? (
        <span className="rounded-full bg-orange-500/25 px-2 text-sm font-black text-orange-100">
          {entries.length}
        </span>
      ) : null}
    </Link>
  );
}
