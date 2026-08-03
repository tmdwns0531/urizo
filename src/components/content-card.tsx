"use client";

import type { RecommendationItem } from "@/contracts/recommendation";
import { PosterArt } from "./poster-art";
import { ProviderBadge } from "./provider-badge";
import { WatchlistButton } from "./watchlist/watchlist-button";

function ageLabel(ageRating: RecommendationItem["content"]["ageRating"]) {
  if (ageRating === "ALL") return "전체";
  if (ageRating === "UNKNOWN") return "등급 미상";
  return `${ageRating}세`;
}

function mediaRuntimeLabel(
  mediaType: RecommendationItem["content"]["mediaType"],
  runtimeMinutes: number,
) {
  return mediaType === "MOVIE"
    ? `영화 · ${runtimeMinutes}분`
    : `시리즈 · 회당 ${runtimeMinutes}분`;
}

function providerActionLabel(
  linkType: RecommendationItem["content"]["providers"][number]["linkType"],
) {
  return linkType === "DIRECT" ? "바로 보기" : "OTT에서 찾기";
}

type ContentCardProps = {
  item: RecommendationItem;
  rank: number;
  hero?: boolean;
  rail?: boolean;
  conditionSummary?: string;
  onReplace?: (contentId: string) => void;
  replacing?: boolean;
  replacementPending?: boolean;
};

export function ContentCard({
  item,
  rank,
  hero = false,
  rail = false,
  conditionSummary,
  onReplace,
  replacing = false,
  replacementPending = false,
}: ContentCardProps) {
  const { content } = item;
  const provider = content.providers[0];


  if (hero) {
    return (
      <article
        className={`relative isolate flex min-h-[36rem] w-full min-w-0 max-w-[calc(100vw_-_2rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#17202a] shadow-[0_30px_90px_rgba(0,0,0,.35)] sm:min-h-[42rem] sm:max-w-none lg:min-h-[46rem] ${
          replacing ? "opacity-60" : ""
        }`}
        aria-busy={replacing}
      >
        <div
          className="absolute inset-0 -z-30 bg-cover bg-center sm:bg-[position:68%_center]"
          style={{
            backgroundColor: content.backdropColor,
            backgroundImage: content.posterUrl
              ? `url("${content.posterUrl}")`
              : undefined,
          }}
          aria-hidden="true"
        >
          {content.posterUrl ? null : (
            <span className="grid h-full w-full place-items-center text-[9rem] font-thin text-white/15">
              ✦
            </span>
          )}
        </div>
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(8,12,17,.98)_0%,rgba(8,12,17,.88)_34%,rgba(8,12,17,.28)_72%,rgba(8,12,17,.42)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,12,17,.08)_20%,rgba(8,12,17,.35)_56%,#0f1215_100%)]" />

        <div className="flex min-w-0 w-full items-end px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="min-w-0 max-w-3xl">
            <p className="mb-3 text-sm font-black tracking-[0.14em] text-[#ff9f82]">
              오늘의 1순위 추천
            </p>
            <h2 className="text-balance text-[clamp(2.5rem,8vw,6.5rem)] font-black leading-[0.96] tracking-[-0.065em] text-white">
              {content.title}
            </h2>
            <p className="mt-3 text-base font-medium leading-7 text-slate-300">
              {conditionSummary ?? "선택한 조건과 안전 기준을 모두 확인했어요."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold leading-6 text-slate-200">
              <span>{content.releaseYear}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>
                {mediaRuntimeLabel(content.mediaType, content.runtimeMinutes)}
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>{ageLabel(content.ageRating)}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>★ {content.voteAverage.toFixed(1)}</span>
              {item.matchPercent !== null ? (
                <strong className="ml-1 text-emerald-300">
                  취향 일치 {item.matchPercent}%
                </strong>
              ) : null}
            </div>

            <p className="mt-5 line-clamp-3 max-w-2xl text-base leading-7 text-slate-200">
              {content.synopsis}
            </p>

            <section
              className="mt-5 max-w-2xl rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm sm:p-5"
              aria-labelledby={`reason-${content.id}`}
            >
              <p
                id={`reason-${content.id}`}
                className="flex items-center gap-2 text-sm font-black text-orange-200"
              >
                <span aria-hidden="true">✦</span>
                이 작품을 먼저 고른 이유
              </p>
              <ul className="mt-3 grid gap-2 pl-5 text-sm leading-6 text-slate-200 marker:text-orange-400">
                {item.reasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              {provider ? (
                <a
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-6 text-sm font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.25)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
                  href={provider.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${content.title} ${providerActionLabel(provider.linkType)}, 새 창`}
                >
                  {providerActionLabel(provider.linkType)}
                  <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="inline-flex min-h-12 items-center rounded-full border border-slate-700 px-5 text-sm font-bold text-slate-400">
                  제공처 확인 중
                </span>
              )}
              {onReplace ? (
                <button
                  type="button"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-extrabold text-slate-200 transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 disabled:opacity-50 sm:w-auto"
                  onClick={() => onReplace(content.id)}
                  disabled={replacementPending}
                >
                  <span aria-hidden="true">↻</span>
                  {replacing ? "새 후보를 찾는 중…" : "다른 작품으로 바꾸기"}
                </button>
              ) : null}
              <WatchlistButton content={content} hero />
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {content.providers.slice(0, 3).map((availability) => (
                <ProviderBadge
                  provider={availability.provider}
                  compact
                  key={availability.provider}
                />
              ))}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17202a] shadow-[0_16px_45px_rgba(0,0,0,.18)] transition duration-300 hover:-translate-y-1 hover:border-white/20 ${
        rail
          ? "w-[min(76vw,17rem)] shrink-0 snap-center md:w-auto"
          : "min-w-0"
      } ${replacing ? "opacity-60" : ""}`}
      aria-busy={replacing}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-[#10151b] p-2.5">
        <span className="absolute left-4 top-4 z-10 grid size-9 place-items-center rounded-lg border border-white/30 bg-black/65 text-sm font-black text-white backdrop-blur-md">
          {rank}
        </span>
        <div className="h-full overflow-hidden rounded-xl [&_.poster-art]:h-full [&_.poster-art]:w-full">
          <PosterArt content={content} />
        </div>
        {item.matchPercent !== null ? (
          <span className="absolute bottom-4 right-4 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1.5 text-sm font-black text-emerald-100 backdrop-blur-md">
            취향 일치 {item.matchPercent}%
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-h-5 flex-wrap gap-1">
          {content.providers.slice(0, 2).map((availability) => (
            <ProviderBadge
              provider={availability.provider}
              compact
              key={availability.provider}
            />
          ))}
        </div>
        <h3 className="mt-3 truncate text-lg font-black tracking-[-0.035em] text-white">
          {content.title}
        </h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
          {content.releaseYear} ·{" "}
          {mediaRuntimeLabel(content.mediaType, content.runtimeMinutes)} ·{" "}
          {ageLabel(content.ageRating)}
        </p>
        <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-300">
          {item.reasons[0]}
        </p>

        {/* `mt-auto` keeps this row on the card floor. Card heights are already
            equalised by `h-full`, but the badge row and the meta line wrap at
            different lengths per title, so a fixed top margin let the action
            row drift up by one line. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-5">
          {provider ? (
            <a
              href={provider.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-black text-orange-200 transition hover:text-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
              aria-label={`${content.title} ${providerActionLabel(provider.linkType)}, 새 창`}
            >
              {providerActionLabel(provider.linkType)}
              <span className="ml-1" aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="text-sm font-bold text-slate-400">제공처 확인 중</span>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <WatchlistButton content={content} />
            {onReplace ? (
              <button
                type="button"
                className="grid size-10 place-items-center rounded-xl bg-white/5 text-base text-slate-300 transition hover:bg-orange-500/15 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-50"
                onClick={() => onReplace(content.id)}
                disabled={replacementPending}
                aria-label={`${content.title} ${replacing ? "새 후보를 찾는 중" : "다른 작품으로 바꾸기"}`}
              >
                <span aria-hidden="true">↻</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
