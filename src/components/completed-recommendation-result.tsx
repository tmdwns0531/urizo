"use client";

import { useRef, useState, type ReactNode } from "react";
import type {
  MvpCompletedRecommendationResponse,
  MvpRecommendationResponse,
} from "@/contracts/mvp-recommendation";
import { SponsoredVideoAd } from "./advertising/sponsored-video-ad";
import { ContentCard } from "./content-card";
import {
  ComparisonCandidate,
  RecommendationComparisonTray,
  useRecommendationComparisonSelection,
} from "./content-comparison/recommendation-comparison-tray";
import { RecommendationTimeline } from "./recommendation-timeline";

export type ResultSource = "choice" | "natural";

export type ReplacementFeedbackStatus =
  | "pending"
  | "success"
  | "exhausted"
  | "error";

export type ReplacementFeedback = {
  status: ReplacementFeedbackStatus;
  title: string;
  description: string;
};

export const REPLACEMENT_FEEDBACK = {
  pending: {
    status: "pending",
    title: "새 교체 후보를 찾고 있어요.",
    description:
      "현재 카드와 이전에 본 작품을 제외하고 안전 기준을 확인 중이에요.",
  },
  success: {
    status: "success",
    title: "작품을 교체했어요.",
    description: "카드 한 자리만 새 후보로 바꾸고 나머지 결과는 유지했어요.",
  },
  exhausted: {
    status: "exhausted",
    title: "같은 조건의 다른 후보가 없어요.",
    description: "기존 결과는 그대로 유지했어요.",
  },
  error: {
    status: "error",
    title: "교체 요청을 완료하지 못했어요.",
    description:
      "네트워크 연결을 확인한 뒤 다시 시도해 주세요. 기존 결과는 그대로 유지했어요.",
  },
} as const satisfies Record<ReplacementFeedbackStatus, ReplacementFeedback>;

class ReplacementRequestError extends Error {
  constructor(
    readonly feedbackStatus: Extract<
      ReplacementFeedbackStatus,
      "exhausted" | "error"
    >,
    message: string,
  ) {
    super(message);
    this.name = "ReplacementRequestError";
  }
}

export function ReplacementFeedbackNotice({
  feedback,
}: {
  feedback: ReplacementFeedback | null;
}) {
  if (!feedback) return null;

  const icon =
    feedback.status === "pending"
      ? "↻"
      : feedback.status === "success"
        ? "✓"
        : feedback.status === "exhausted"
          ? "i"
          : "!";

  return (
    <aside
      className="result-notice result-notice--neutral"
      data-replacement-state={feedback.status}
      aria-live="polite"
    >
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{feedback.title}</strong>
        <p>{feedback.description}</p>
      </div>
    </aside>
  );
}

function rememberNotInterested(contentId: string) {
  try {
    const storageKey = "ott-damoa:not-interested";
    const current = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as unknown;
    const values = Array.isArray(current)
      ? current.filter((value): value is string => typeof value === "string")
      : [];
    sessionStorage.setItem(
      storageKey,
      JSON.stringify([...new Set([...values, contentId])]),
    );
  } catch {
    // Replacement remains available when browser storage is unavailable.
  }
}

async function requestReplacement(runId: string, contentId: string) {
  const request = await fetch(
    `/api/recommendations/${encodeURIComponent(runId)}/replacement`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentId }),
    },
  );
  const result = (await request.json().catch(() => null)) as
    | MvpRecommendationResponse
    | { error?: string }
    | null;
  if (!request.ok || !result || !("status" in result)) {
    throw new ReplacementRequestError(
      request.status === 400 ? "exhausted" : "error",
      (result && "error" in result && result.error) || "다른 후보가 없어요.",
    );
  }
  if (result.status !== "completed") {
    throw new ReplacementRequestError("error", "교체 결과를 확인하지 못했어요.");
  }
  return result;
}

export function ChoiceConditionSummary({ summary }: { summary: string }) {
  const tags = summary
    .split(" · ")
    .map((tag) =>
      tag === "작품 유형 제한 없음" ? "영화·시리즈 모두" : tag,
    )
    .filter(Boolean);

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"
      aria-labelledby="choice-condition-summary-title"
    >
      <p className="choice-stepper__eyebrow">선택한 조건</p>
      <h2 id="choice-condition-summary-title" className="sr-only">
        직접 선택한 추천 조건
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li
            className="inline-flex min-h-10 items-center rounded-full border border-orange-500/35 bg-orange-500/10 px-3 py-1.5 text-sm font-bold leading-6 text-orange-100"
            key={tag}
          >
            {tag}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommonNotices({
  response,
}: {
  response: MvpCompletedRecommendationResponse;
}) {
  const childRatingApplied = response.conditionSummary.includes(
    "최대 허용 관람등급",
  );
  const approvedRuntimeMinutes = [...response.trace]
    .reverse()
    .find(
      (event) =>
        event.action === "approval_decision" && event.title.includes("넓혀"),
    )?.metrics?.effectiveRuntimeMinutes;

  return (
    <>
      {approvedRuntimeMinutes !== undefined ? (
        <aside className="result-notice result-notice--neutral">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>승인한 범위로 시간 조건을 완화했어요.</strong>
            <p>
              러닝타임만 {approvedRuntimeMinutes}분까지 넓혔고 나머지 조건은
              그대로 지켰어요.
            </p>
          </div>
        </aside>
      ) : null}

      {response.fallbackUsed ? (
        <aside className="result-notice result-notice--fallback">
          <span aria-hidden="true">↯</span>
          <div>
            <strong>빠른 규칙 추천으로 전환했어요.</strong>
            <p>추천 방식만 바뀌었고 선택한 조건과 안전 기준은 그대로 지켰어요.</p>
          </div>
        </aside>
      ) : null}

      {response.policyBlockedCount > 0 ? (
        <aside className="result-notice result-notice--policy">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>
              {childRatingApplied
                ? "고른 관람 등급을 최대 허용 기준으로 결과 필터에 적용했고, 선택한 최대 허용 관람등급을 포함한 모든 조건으로 다시 확인해 맞지 않는 후보를 제외했어요."
                : "선택한 관람등급을 포함한 모든 조건으로 다시 확인해 맞지 않는 후보를 제외했어요."}
            </strong>
            <p>
              부적합 후보 {response.policyBlockedCount}편의 상세는 노출하지
              않았어요.
            </p>
          </div>
        </aside>
      ) : null}

      {response.notice ? (
        <aside className="result-notice result-notice--neutral">
          <span aria-hidden="true">i</span>
          <div>
            <strong>{response.notice}</strong>
          </div>
        </aside>
      ) : null}
    </>
  );
}

type CompletedRecommendationResultProps = {
  source: ResultSource;
  response: MvpCompletedRecommendationResponse;
  conditionSummary: ReactNode;
  onResponseChange: (response: MvpCompletedRecommendationResponse) => void;
  onEditConditions: () => void;
  onReset: () => void;
  onContinueInChoice?: () => void;
  onAllowAnyMediaType?: () => void;
};

export function CompletedRecommendationResult({
  source,
  response,
  conditionSummary,
  onResponseChange,
  onEditConditions,
  onReset,
  onContinueInChoice,
  onAllowAnyMediaType,
}: CompletedRecommendationResultProps) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacementFeedback, setReplacementFeedback] =
    useState<ReplacementFeedback | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const replacementLock = useRef(false);
  const alternatives = response.recommendations
    .filter((item) => item.content.id !== response.topPick?.content.id)
    .slice(0, 4);
  const comparisonCandidates = response.topPick
    ? [response.topPick.content, ...alternatives.map(({ content }) => content)]
    : [];
  const { selectedIds, toggle } =
    useRecommendationComparisonSelection(comparisonCandidates);
  const selectionFull = selectedIds.length >= 2;

  function showFeedback(feedback: ReplacementFeedback) {
    setReplacementFeedback(feedback);
    setAnnouncement(`${feedback.title} ${feedback.description}`);
  }

  async function replace(contentId: string) {
    if (replacementLock.current) return;
    replacementLock.current = true;
    setReplacingId(contentId);
    showFeedback(REPLACEMENT_FEEDBACK.pending);
    rememberNotInterested(contentId);
    try {
      onResponseChange(await requestReplacement(response.runId, contentId));
      showFeedback(REPLACEMENT_FEEDBACK.success);
    } catch (error) {
      const feedback =
        error instanceof ReplacementRequestError
          ? {
              ...REPLACEMENT_FEEDBACK[error.feedbackStatus],
              description: `${error.message} 기존 결과는 그대로 유지했어요.`,
            }
          : REPLACEMENT_FEEDBACK.error;
      showFeedback(feedback);
    } finally {
      replacementLock.current = false;
      setReplacingId(null);
    }
  }

  async function replaceAll() {
    if (replacementLock.current) return;
    replacementLock.current = true;
    showFeedback({
      ...REPLACEMENT_FEEDBACK.pending,
      title: "같은 조건의 다른 5편을 찾고 있어요.",
    });
    let current = response;
    let replacedCount = 0;
    try {
      for (const item of response.recommendations) {
        setReplacingId(item.content.id);
        rememberNotInterested(item.content.id);
        try {
          current = await requestReplacement(current.runId, item.content.id);
          replacedCount += 1;
        } catch (error) {
          if (
            error instanceof ReplacementRequestError &&
            error.feedbackStatus === "exhausted"
          ) {
            break;
          }
          throw error;
        }
      }
      if (replacedCount > 0) {
        onResponseChange(current);
        showFeedback({
          status: "success",
          title: "같은 조건의 새 후보를 찾았어요.",
          description: `기존 결과와 겹치지 않는 작품 ${replacedCount}편으로 바꿨어요.`,
        });
      } else {
        showFeedback(REPLACEMENT_FEEDBACK.exhausted);
      }
    } catch {
      if (replacedCount > 0) onResponseChange(current);
      showFeedback(REPLACEMENT_FEEDBACK.error);
    } finally {
      replacementLock.current = false;
      setReplacingId(null);
    }
  }

  const provider = response.topPick?.content.providers[0];

  return (
    <>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      <header className="mb-7 max-w-3xl">
        <p className="choice-stepper__eyebrow">추천 결과</p>
        <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
          조건에 맞는 {response.recommendations.length}편을 찾았어요
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-300">
          선택한 조건을 모두 반영해 추천했어요.
        </p>
      </header>

      <div className="mb-7">{conditionSummary}</div>

      <ReplacementFeedbackNotice feedback={replacementFeedback} />
      <CommonNotices response={response} />

      {response.topPick ? (
        <section aria-labelledby="top-pick-heading">
          <h2 id="top-pick-heading" className="sr-only">
            오늘의 1순위 추천
          </h2>
          <ComparisonCandidate
            content={response.topPick.content}
            selected={selectedIds.includes(response.topPick.content.id)}
            disabled={
              selectionFull &&
              !selectedIds.includes(response.topPick.content.id)
            }
            onToggle={toggle}
          >
            <ContentCard
              item={response.topPick}
              rank={1}
              hero
              onReplace={replace}
              replacing={replacingId === response.topPick.content.id}
              replacementPending={replacingId !== null}
            />
          </ComparisonCandidate>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-700 bg-white/[0.03] px-6 py-16 text-center">
          <span
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-800 text-xl text-slate-400"
            aria-hidden="true"
          >
            ◇
          </span>
          <h2 className="mt-4 text-2xl font-black text-white">
            {response.noResult?.message ??
              "현재 조건을 모두 만족하는 작품이 없어요."}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-300">
            조건을 자동으로 바꾸지 않았어요. 입력한 조건을 수정해 다시 찾아보세요.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {response.noResult?.availableActions.includes("EXTEND_RUNTIME") ? (
              <button
                type="button"
                className="min-h-12 rounded-full border border-slate-600 px-5 text-sm font-black text-slate-200 hover:border-slate-400 hover:text-white"
                onClick={onEditConditions}
              >
                시청 시간 늘리기
              </button>
            ) : null}
            {response.noResult?.availableActions.includes(
              "ALLOW_ANY_MEDIA_TYPE",
            ) && onAllowAnyMediaType ? (
              <button
                type="button"
                className="min-h-12 rounded-full border border-slate-600 px-5 text-sm font-black text-slate-200 hover:border-slate-400 hover:text-white"
                onClick={onAllowAnyMediaType}
              >
                영화·시리즈 모두 보기
              </button>
            ) : null}
            <button
              type="button"
              className="min-h-12 rounded-full border border-slate-600 px-5 text-sm font-black text-slate-200 hover:border-slate-400 hover:text-white"
              onClick={onEditConditions}
            >
              현재 조건 수정하기
            </button>
          </div>
        </section>
      )}

      {alternatives.length ? (
        <section className="mt-12" aria-labelledby="alternative-results-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="choice-stepper__eyebrow">2위부터 5위까지</p>
              <h2
                id="alternative-results-heading"
                className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl"
              >
                함께 비교해 볼 작품
              </h2>
            </div>
            <span className="hidden text-sm font-bold text-slate-400 sm:inline">
              추천 {alternatives.length}편 · 광고 1개
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {alternatives.map((item, index) => (
              <ComparisonCandidate
                content={item.content}
                selected={selectedIds.includes(item.content.id)}
                disabled={
                  selectionFull && !selectedIds.includes(item.content.id)
                }
                onToggle={toggle}
                key={item.content.id}
              >
                <ContentCard
                  item={item}
                  rank={index + 2}
                  key={item.content.id}
                  onReplace={replace}
                  replacing={replacingId === item.content.id}
                  replacementPending={replacingId !== null}
                />
              </ComparisonCandidate>
            ))}
            <SponsoredVideoAd
              placement="RESULT"
              theme="dark"
              runId={response.runId}
              variant="rail"
            />
          </div>
        </section>
      ) : null}

      <RecommendationComparisonTray
        contents={comparisonCandidates}
        selectedIds={selectedIds}
        onToggle={toggle}
      />

      <div className="mt-8">
        <RecommendationTimeline response={response} />
      </div>

      {response.topPick ? (
        <section
          className="mt-10 border-t border-white/10 pt-8"
          aria-labelledby="next-actions-title"
        >
          <h2 id="next-actions-title" className="text-2xl font-black text-white">
            다음에는 무엇을 할까요?
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {provider ? (
              <a
                href={provider.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-24 flex-col items-start justify-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] px-5 text-left font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.2)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                1순위 작품 보러가기 ↗
                <small className="mt-2 text-sm font-semibold leading-6 text-orange-100">
                  선택한 OTT에서 바로 찾아보세요.
                </small>
              </a>
            ) : null}
            <button
              type="button"
              className="min-h-24 rounded-2xl border border-slate-700 bg-[#191d22] px-5 text-left font-bold text-slate-200 hover:border-slate-500 disabled:opacity-50"
              onClick={() => void replaceAll()}
              disabled={replacingId !== null}
            >
              같은 조건으로 다른 5편 보기
            </button>
            <button
              type="button"
              className="min-h-24 rounded-2xl border border-slate-700 bg-[#191d22] px-5 text-left font-bold text-slate-200 hover:border-slate-500"
              onClick={onEditConditions}
            >
              현재 조건 수정하기
            </button>
            <button
              type="button"
              className="min-h-24 rounded-2xl border border-slate-700 bg-[#191d22] px-5 text-left font-bold text-slate-200 hover:border-slate-500"
              onClick={onReset}
            >
              {source === "natural"
                ? "새 문장으로 다시 추천받기"
                : "처음부터 새 조건으로 추천받기"}
            </button>
          </div>
          {source === "natural" && onContinueInChoice ? (
            <p className="mt-6 text-sm leading-6 text-slate-400">
              더 세밀하게 고르고 싶다면{" "}
              <button
                type="button"
                className="font-black text-orange-200 underline decoration-orange-400/40 underline-offset-4 hover:text-orange-100"
                onClick={onContinueInChoice}
              >
                조건을 직접 선택해 다시 추천받기 →
              </button>
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
