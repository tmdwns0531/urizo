"use client";

import type { RecommendationItem } from "@/contracts/recommendation";
import { EngagementActions } from "./engagement-actions";
import { PosterArt } from "./poster-art";
import { ProviderBadge } from "./provider-badge";

function ageLabel(ageRating: RecommendationItem["content"]["ageRating"]) {
  if (ageRating === "ALL") return "전체";
  if (ageRating === "UNKNOWN") return "등급 미상";
  return `${ageRating}세`;
}

function mediaLabel(mediaType: RecommendationItem["content"]["mediaType"]) {
  return mediaType === "MOVIE" ? "영화" : "시리즈";
}

type ContentCardProps = {
  item: RecommendationItem;
  rank: number;
  runId: string;
  hero?: boolean;
  onReplace?: (contentId: string) => void;
  replacing?: boolean;
  replacementPending?: boolean;
};

export function ContentCard({
  item,
  rank,
  runId,
  hero = false,
  onReplace,
  replacing = false,
  replacementPending = false,
}: ContentCardProps) {
  const { content } = item;
  const provider = content.providers[0];

  function recordOttClick(providerName: string) {
    void fetch("/api/engagement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentId: content.id,
        runId,
        type: "OTT_CLICK",
        provider: providerName,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }

  if (hero) {
    return (
      <article className="top-pick-card" aria-busy={replacing}>
        <div className="top-pick-card__poster">
          <span className="rank-ribbon">
            <small>TOP</small> 1
          </span>
          <PosterArt content={content} priority />
        </div>
        <div className="top-pick-card__content">
          <div className="top-pick-card__eyebrow">
            <span className="match-badge">취향 일치 {item.matchPercent}%</span>
            <span>오늘의 첫 번째 선택</span>
          </div>
          <h2>{content.title}</h2>
          <div className="content-meta">
            <span>{content.releaseYear}</span>
            <span>{mediaLabel(content.mediaType)}</span>
            <span>{content.runtimeMinutes}분</span>
            <span>{ageLabel(content.ageRating)}</span>
            <span>★ {content.voteAverage.toFixed(1)}</span>
          </div>
          <p className="content-synopsis">{content.synopsis}</p>
          <div className="genre-row">
            {content.genres.slice(0, 3).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          <section className="reason-box" aria-labelledby={`reason-${content.id}`}>
            <p id={`reason-${content.id}`}>
              <span aria-hidden="true">✦</span>
              이 작품을 먼저 고른 이유
            </p>
            <ul>
              {item.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
          <div className="provider-action">
            <div>
              {content.providers.slice(0, 3).map((availability) => (
                <ProviderBadge
                  provider={availability.provider}
                  compact
                  key={availability.provider}
                />
              ))}
            </div>
            {provider ? (
              <a
                className="button button--primary"
                href={provider.watchUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => recordOttClick(provider.provider)}
                aria-label={`${content.title} ${provider.provider}에서 찾기, 새 창`}
              >
                OTT에서 찾기 <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="button button--disabled">제공처 확인 중</span>
            )}
          </div>
          <EngagementActions contentId={content.id} runId={runId} />
          {onReplace ? (
            <button
              type="button"
              className="replace-link"
              onClick={() => onReplace(content.id)}
              disabled={replacementPending}
            >
              <span aria-hidden="true">↻</span>
              {replacing ? "새 후보를 찾는 중…" : "다른 작품으로 바꾸기"}
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`content-card${replacing ? " is-replacing" : ""}`}
      aria-busy={replacing}
    >
      <div className="content-card__poster">
        <span className="card-rank">{rank}</span>
        <PosterArt content={content} />
        <span className="card-match">{item.matchPercent}% match</span>
      </div>
      <div className="content-card__body">
        <div className="content-card__provider">
          {content.providers.slice(0, 2).map((availability) => (
            <ProviderBadge
              provider={availability.provider}
              compact
              key={availability.provider}
            />
          ))}
        </div>
        <h3>{content.title}</h3>
        <div className="content-meta content-meta--compact">
          <span>{content.releaseYear}</span>
          <span>{content.runtimeMinutes}분</span>
          <span>{ageLabel(content.ageRating)}</span>
        </div>
        <p>{item.reasons[0]}</p>
        <div className="content-card__actions">
          {provider ? (
            <a
              href={provider.watchUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => recordOttClick(provider.provider)}
              aria-label={`${content.title} OTT에서 찾기, 새 창`}
            >
              OTT에서 찾기 <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          {onReplace ? (
            <button
              type="button"
              onClick={() => onReplace(content.id)}
              disabled={replacementPending}
              aria-label={`${content.title} ${replacing ? "새 후보를 찾는 중" : "다른 작품으로 바꾸기"}`}
            >
              <span aria-hidden="true">↻</span>
            </button>
          ) : null}
        </div>
        <EngagementActions contentId={content.id} runId={runId} compact />
      </div>
    </article>
  );
}
