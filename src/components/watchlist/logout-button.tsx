"use client";

import { useWatchlist } from "./watchlist-store";

const BASE =
  "inline-flex min-h-11 shrink-0 items-center justify-center text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";

/**
 * 헤더에 두는 로그아웃.
 *
 * 원래는 찜 목록 화면 안에만 있었는데, 그 화면은 찜이 0편이면 빈 상태로 갈라져
 * 버튼까지 함께 사라진다. 가입 직후가 정확히 그 상태라 방금 가입한 사람은
 * 로그아웃할 방법이 없었다. 헤더는 찜 개수와 무관하므로 그 구멍이 생기지 않는다.
 *
 * 로그인하지 않았거나 아직 확인 전이면 아무것도 그리지 않는다. 첫 조회가 끝나기
 * 전에 로그아웃이 잠깐 보이면 로그인된 줄로 읽힌다.
 */
export function LogoutButton({
  className = "rounded-full border border-white/15 px-4 text-slate-200 hover:border-white/30 hover:text-white",
}: {
  className?: string;
}) {
  const { account, loading, logout } = useWatchlist();

  if (loading || !account) return null;

  return (
    <button type="button" className={`${BASE} ${className}`} onClick={() => void logout()}>
      로그아웃
    </button>
  );
}
