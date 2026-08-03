"use client";

import Link from "next/link";
import { useWatchlist } from "../watchlist/watchlist-store";

const ITEM =
  "inline-flex min-h-11 items-center px-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043] sm:px-3";

/**
 * 홈 헤더의 계정 영역.
 *
 * 첫 조회가 끝나기 전에는 로그인 여부를 단정하지 않는다. 로그인한 사람에게
 * `로그인` 이 잠깐 보였다 바뀌면 로그아웃된 줄로 읽힌다. 자리는 차지하되
 * 내용은 비워 헤더가 흔들리지 않게 한다.
 */
export function LandingAuth() {
  const { account, entries, loading } = useWatchlist();

  if (loading) {
    return <div className="ml-auto min-h-11 w-32 shrink-0" aria-hidden="true" />;
  }

  if (!account) {
    return (
      <div className="ml-auto flex shrink-0 items-center text-sm font-extrabold text-slate-200">
        <Link className={ITEM} href="/login?mode=signup">
          회원가입
        </Link>
        <span className="h-5 w-px bg-white/25" aria-hidden="true" />
        <Link className={ITEM} href="/login">
          로그인
        </Link>
      </div>
    );
  }

  return (
    <div className="ml-auto flex shrink-0 items-center text-sm font-extrabold text-slate-200">
      <Link className={ITEM} href="/watchlist">
        <span aria-hidden="true" className="mr-1.5">
          ♥
        </span>
        찜 목록
        {entries.length > 0 ? (
          <span className="ml-1.5 rounded-full bg-orange-500/25 px-2 text-sm font-black text-orange-100">
            {entries.length}
          </span>
        ) : null}
      </Link>
      <span className="h-5 w-px bg-white/25" aria-hidden="true" />
      <span className={`${ITEM} text-slate-400`}>{account.nickname}님</span>
    </div>
  );
}
