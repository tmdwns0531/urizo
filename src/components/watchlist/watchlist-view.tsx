"use client";

import Link from "next/link";
import { buildCoveragePlan } from "@/domains/watchlist/coverage";
import { providerLabels } from "../provider-badge";
import { LogoutButton } from "./logout-button";
import { useWatchlist } from "./watchlist-store";

const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

export function WatchlistView() {
  const { account, entries, remove, clear, loading } = useWatchlist();
  const plan = buildCoveragePlan(entries);

  // 첫 조회가 끝나기 전에는 아무 상태도 단정하지 않는다. 로그인했는데
  // "로그인이 필요해요" 가 잠깐 스치면 오작동으로 읽힌다.
  if (loading) {
    return (
      <section className="app-container py-16">
        <p className="text-base font-semibold text-slate-400">
          찜 목록을 불러오는 중이에요…
        </p>
      </section>
    );
  }

  if (!account) {
    return (
      <section className="app-container py-16">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          찜 목록
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
          로그인하면 찜한 작품이 계정에 저장돼요. 어느 기기에서 열어도 그대로
          있고, 어느 OTT를 구독해야 가장 많이 볼 수 있는지 알려드려요.
        </p>
        <Link
          href="/login?next=%2Fwatchlist"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff6b3d] px-6 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#ff7d56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          로그인하고 시작하기
        </Link>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="app-container py-16">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          찜 목록
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
          보고 싶은 작품을 찜해 두면, 어느 OTT를 구독해야 가장 많이 볼 수 있는지
          알려드려요.
        </p>
        {/* 이 화면은 찜이 0편이면 아래 헤더까지 가지 않고 여기서 끝난다. 그래서
            로그아웃을 헤더에만 두면 방금 가입한 사람이 빠져나갈 길이 없어진다. */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/choice"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff6b3d] px-6 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#ff7d56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            추천받으러 가기
          </Link>
          <LogoutButton />
        </div>
      </section>
    );
  }

  const covered = plan.saved - plan.uncovered.length;

  return (
    <section className="app-container py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            찜 목록
          </h1>
          <p className="mt-2 text-base font-semibold text-slate-300">
            {account.nickname}님이 {plan.saved}편을 담아두셨어요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-bold text-slate-300 transition hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            onClick={() => {
              if (window.confirm("찜한 작품을 모두 지울까요?")) void clear();
            }}
          >
            전체 비우기
          </button>
          <LogoutButton />
        </div>
      </header>

      {plan.steps.length > 0 ? (
        <section
          className="mt-8 rounded-3xl border border-white/10 bg-[#17202a] p-6 sm:p-8"
          aria-labelledby="coverage-heading"
        >
          <h2
            id="coverage-heading"
            className="flex items-center gap-2 text-lg font-black text-orange-200"
          >
            <span aria-hidden="true">✦</span>
            어느 OTT를 구독하면 좋을까요
          </h2>

          <ol className="mt-5 grid gap-3">
            {plan.steps.map((step, index) => (
              <li
                key={step.provider}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-black text-white">
                  {index + 1}
                </span>
                <strong className="text-base font-black text-white">
                  {providerLabels[step.provider]}
                </strong>
                <span className="text-sm font-semibold text-slate-300">
                  {index === 0
                    ? `이것만 있으면 ${step.total}편`
                    : `더하면 ${step.added}편 늘어 ${step.total}편`}
                </span>
                <span className="ml-auto text-sm font-black text-emerald-300">
                  {percent(step.total, plan.saved)}%
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-sm leading-6 text-slate-400">
            찜한 {plan.saved}편 가운데 {covered}편은 위 조합으로 볼 수 있어요.
            {plan.uncovered.length > 0
              ? ` 나머지 ${plan.uncovered.length}편은 국내 OTT에서 확인되지 않았어요.`
              : ""}
          </p>
        </section>
      ) : null}

      {plan.single.length > 1 ? (
        <section className="mt-6" aria-labelledby="single-heading">
          <h2
            id="single-heading"
            className="text-sm font-black tracking-[0.08em] text-slate-400"
          >
            OTT 하나씩만 봤을 때
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {plan.single.map((reach) => (
              <li
                key={reach.provider}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-bold text-slate-200"
              >
                {providerLabels[reach.provider]}
                <span className="font-black text-white">{reach.count}편</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17202a]"
          >
            <div
              className="aspect-[2/3] bg-cover bg-center bg-[#10151b]"
              style={{
                backgroundImage: entry.posterUrl
                  ? `url("${entry.posterUrl}")`
                  : undefined,
              }}
              aria-hidden="true"
            />
            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <p className="line-clamp-2 text-sm font-black leading-6 text-white">
                {entry.title}
              </p>
              <p className="text-sm font-semibold text-slate-400">
                {entry.providers.length > 0
                  ? entry.providers
                      .map((provider) => providerLabels[provider])
                      .join(", ")
                  : "국내 OTT 확인 안 됨"}
              </p>
              <button
                type="button"
                className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-slate-300 transition hover:bg-orange-500/15 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                onClick={() => void remove(entry.id)}
                aria-label={`${entry.title} 찜 목록에서 빼기`}
              >
                빼기
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
