"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecommendationItem } from "@/contracts/recommendation";
import { useWatchlist } from "./watchlist-store";

export function WatchlistButton({
  content,
  hero = false,
}: {
  content: RecommendationItem["content"];
  hero?: boolean;
}) {
  const router = useRouter();
  const { has, add, remove, loading } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const saved = has(content.id);
  const label = saved ? "찜 목록에서 빼기" : "찜 목록에 담기";

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await remove(content.id);
        return;
      }
      const result = await add(content.id);
      if (result === "unauthorized") {
        // 담으려던 작품을 들고 로그인 화면으로 보낸다. 로그인 뒤 돌아와서
        // 다시 찾게 만들지 않는다.
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(
          `/login?next=${encodeURIComponent(next)}&save=${encodeURIComponent(content.id)}`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || loading;

  if (hero) {
    return (
      <button
        type="button"
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 disabled:opacity-50 sm:w-auto ${
          saved
            ? "border-orange-400/50 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25"
            : "border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
        }`}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={saved}
        aria-label={`${content.title} ${label}`}
      >
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
        {saved ? "찜함" : "찜하기"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`grid size-10 place-items-center rounded-xl text-base transition focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-50 ${
        saved
          ? "bg-orange-500/20 text-orange-200 hover:bg-orange-500/30"
          : "bg-white/5 text-slate-300 hover:bg-orange-500/15 hover:text-orange-200"
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={saved}
      aria-label={`${content.title} ${label}`}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
    </button>
  );
}
