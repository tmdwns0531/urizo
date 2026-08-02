"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MvpApprovalDecision as ApprovalDecision,
  MvpAwaitingApprovalRecommendationResponse as AwaitingApprovalRecommendationResponse,
  MvpClarificationAnswer as ClarificationAnswer,
  MvpCompletedRecommendationResponse as CompletedRecommendationResponse,
  MvpRecommendationResponse as RecommendationResponse,
} from "@/contracts/mvp-recommendation";
import { RecommendationWaitingScreen } from "./advertising/recommendation-waiting-screen";
import { SponsoredVideoAd } from "./advertising/sponsored-video-ad";
import { ContentCard } from "./content-card";
import { RecommendationTimeline } from "./recommendation-timeline";

type RecommendationViewProps = {
  runId: string;
};

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

function ApprovalView({
  response,
  onDecision,
  onClarification,
  deciding,
  error,
}: {
  response: AwaitingApprovalRecommendationResponse;
  onDecision: (decision: ApprovalDecision) => void;
  onClarification: (answer: ClarificationAnswer) => void;
  deciding: ApprovalDecision | ClarificationAnswer | null;
  error: string;
}) {
  if (response.proposal.kind === "FAMILY_COMPOSITION") {
    return (
      <section
        className="rounded-3xl border border-white/10 bg-[#171b21] p-6 shadow-[0_24px_70px_rgba(0,0,0,.24)] sm:p-8"
        data-agent-chat="clarification"
      >
        <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] text-lg font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.2)]" aria-hidden="true">
          A
        </div>
        <div className="mt-5 max-w-3xl">
          <p className="text-sm font-black tracking-[0.14em] text-orange-300">
            추가 질문
          </p>
          <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            {response.proposal.question}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            가족 구성을 선택하면 같은 조건으로 추천을 바로 이어갈게요.
          </p>
          <div className="mt-6 flex flex-wrap gap-3" aria-label="가족 구성 답변">
            {response.proposal.answers.map((answer) => (
              <button
                type="button"
                className="min-h-12 rounded-full border border-orange-400/35 bg-orange-500/10 px-5 text-sm font-black text-orange-200 transition hover:bg-orange-500/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 disabled:opacity-50"
                disabled={deciding !== null}
                onClick={() => onClarification(answer.value)}
                key={answer.value}
              >
                {deciding === answer.value
                  ? "조건을 반영하는 중…"
                  : answer.label}
              </button>
            ))}
          </div>
          {error ? (
            <p className="mt-4 text-sm font-bold text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-[#171b21] p-6 shadow-[0_24px_70px_rgba(0,0,0,.24)] sm:p-8">
        <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] text-xl font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.2)]" aria-hidden="true">
          ?
        </div>
        <div className="mt-5 max-w-3xl">
          <p className="text-sm font-black tracking-[0.14em] text-orange-300">
            APPROVAL REQUIRED
          </p>
          <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            {response.proposal.question}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            넓어지는 조건은 러닝타임뿐이에요. 구독 OTT·기분·연령 기준은
            그대로 유지합니다.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
            {response.conditionSummary}
          </p>
          <div className="mt-6 flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm leading-6 text-slate-300">
            <span>
              현재 <strong className="ml-1 text-lg text-white">{response.proposal.currentMaxMinutes}분</strong>
            </span>
            <i className="not-italic text-orange-400" aria-hidden="true">→</i>
            <span>
              제안 <strong className="ml-1 text-lg text-orange-300">{response.proposal.proposedMaxMinutes}분</strong>
            </span>
            <small className="w-full text-sm text-slate-400 sm:ml-auto sm:w-auto">
              현재 후보 {response.proposal.currentCandidateCount}편에서 더 찾아봐요
            </small>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="min-h-12 rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-6 text-sm font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.2)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:translate-y-0 disabled:opacity-50"
              onClick={() => onDecision("approve")}
              disabled={deciding !== null}
            >
              {deciding === "approve"
                ? `${response.proposal.proposedMaxMinutes}분까지 다시 찾는 중…`
                : response.proposal.approveLabel}
            </button>
            <button
              className="min-h-12 rounded-full border border-slate-700 bg-white/5 px-6 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 disabled:opacity-50"
              onClick={() => onDecision("reject")}
              disabled={deciding !== null}
            >
              {deciding === "reject"
                ? `${response.proposal.currentMaxMinutes}분 결과를 정리하는 중…`
                : response.proposal.rejectLabel}
            </button>
          </div>
          {error ? (
            <p className="mt-4 text-sm font-bold text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="partial-results-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black tracking-[0.14em] text-orange-300">
              CURRENT MATCHES
            </p>
            <h2 id="partial-results-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
              {response.proposal.currentMaxMinutes}분 조건에 맞는{" "}
              {response.partialRecommendations.length}편
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-300">
            조건 유지 중
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {response.partialRecommendations.map((item, index) => (
            <ContentCard
              item={item}
              rank={index + 1}
              key={item.content.id}
            />
          ))}
        </div>
      </section>
      <div className="mt-7">
        <RecommendationTimeline response={response} />
      </div>
    </>
  );
}

export function CompletedView({
  response,
  onReplace,
  replacingId,
  replacementFeedback,
}: {
  response: CompletedRecommendationResponse;
  onReplace: (contentId: string) => void;
  replacingId: string | null;
  replacementFeedback: ReplacementFeedback | null;
}) {
  const alternatives = response.recommendations.filter(
    (item) => item.content.id !== response.topPick?.content.id,
  ).slice(0, 4);

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-black tracking-[0.14em] text-orange-300">
            YOUR PICKS
          </p>
          <h1 className="sr-only">
            조건에 맞는 {response.recommendations.length}편을 찾았어요.
          </h1>
          <p className="mt-1 text-base leading-7 text-slate-300">
            선택한 조건을 끝까지 지키고, 마지막 안전 확인까지 마쳤어요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 text-sm font-bold text-emerald-200">
            <span aria-hidden="true">◇</span>
            조건·안전 확인 완료
          </span>
          <Link
            href="/choice"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-700 bg-white/5 px-4 text-sm font-bold text-slate-200 transition hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            조건 바꾸기
          </Link>
        </div>
      </header>

      <ReplacementFeedbackNotice feedback={replacementFeedback} />

      {response.fallbackUsed ? (
        <aside className="result-notice result-notice--fallback">
          <span aria-hidden="true">↯</span>
          <div>
            <strong>빠른 규칙 추천으로 전환했어요.</strong>
            <p>
              AI 추천이 잠시 멈췄어도 같은 조건과 안전 기준은 그대로
              지켰어요.
            </p>
          </div>
        </aside>
      ) : null}

      {response.policyBlockedCount > 0 ? (
        <aside className="result-notice result-notice--policy">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>연령 기준에 맞지 않는 후보를 제외했어요.</strong>
            <p>
              부적합 후보 {response.policyBlockedCount}편의 제목과 상세는
              노출하지 않았습니다.
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

      {response.topPick ? (
        <section aria-labelledby="top-pick-heading">
          <h2 id="top-pick-heading" className="sr-only">가장 먼저 추천하는 작품</h2>
          <ContentCard
            item={response.topPick}
            rank={1}
            hero
            conditionSummary={response.conditionSummary}
            onReplace={onReplace}
            replacing={replacingId === response.topPick.content.id}
            replacementPending={replacingId !== null}
          />
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-700 bg-white/[0.03] px-6 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-800 text-xl text-slate-400" aria-hidden="true">◇</span>
          <h2 className="mt-4 text-2xl font-black text-white">
            조건에 맞는 안전한 작품이 없어요.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-300">
            조건을 자동으로 바꾸지 않았어요. 조건 선택 화면에서 다시 골라
            주세요.
          </p>
          <Link
            href="/choice"
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-6 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            조건 다시 고르기
          </Link>
        </section>
      )}

      {response.topPick ? (
        <section className="mt-12" aria-labelledby="alternative-results-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black tracking-[0.14em] text-orange-300">
                ALSO FOR YOU
              </p>
              <h2 id="alternative-results-heading" className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                함께 비교해 볼 작품
              </h2>
            </div>
            <span className="hidden text-sm font-bold text-slate-400 sm:inline">
              추천 {alternatives.length}편 · 광고/안내 1개
            </span>
          </div>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin] md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-3 xl:grid-cols-5">
            {alternatives.length
              ? alternatives.map((item, index) => (
                  <ContentCard
                    item={item}
                    rank={index + 2}
                    rail
                    key={item.content.id}
                    onReplace={onReplace}
                    replacing={replacingId === item.content.id}
                    replacementPending={replacingId !== null}
                  />
                ))
              : null}
            <div className="w-[min(76vw,17rem)] shrink-0 snap-center md:w-auto">
              <SponsoredVideoAd
                placement="RESULT"
                theme="dark"
                runId={response.runId}
                variant="rail"
              />
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <RecommendationTimeline response={response} />
      </div>
    </>
  );
}

export function RecommendationView({ runId }: RecommendationViewProps) {
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deciding, setDeciding] = useState<
    ApprovalDecision | ClarificationAnswer | null
  >(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacementFeedback, setReplacementFeedback] =
    useState<ReplacementFeedback | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const replacementLock = useRef(false);

  const loadRun = useCallback(async () => {
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}`,
        { cache: "no-store" },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new Error(
          (result && "error" in result && result.error) ||
            "추천 기록을 찾을 수 없어요.",
        );
      }
      setResponse(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "추천 기록을 찾을 수 없어요.",
      );
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    let ignore = false;
    const request = fetch(
      `/api/recommendations/${encodeURIComponent(runId)}`,
      { cache: "no-store" },
    );

    void request
      .then(async (resultResponse) => {
        const result = (await resultResponse.json().catch(() => null)) as
          | RecommendationResponse
          | { error?: string }
          | null;
        if (!resultResponse.ok || !result || !("status" in result)) {
          throw new Error(
            (result && "error" in result && result.error) ||
              "추천 기록을 찾을 수 없어요.",
          );
        }
        return result;
      })
      .then((result) => {
        if (!ignore) setResponse(result);
      })
      .catch((loadError: unknown) => {
        if (ignore) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "추천 기록을 찾을 수 없어요.",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [runId]);

  async function decide(decision: ApprovalDecision) {
    const proposal =
      response?.status === "awaiting_approval" &&
      response.proposal.kind === "RUNTIME_RELAXATION"
        ? response.proposal
        : null;
    setDeciding(decision);
    setActionError("");
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}/approval`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new Error(
          (result && "error" in result && result.error) ||
            "승인 결과를 반영하지 못했어요.",
        );
      }
      setResponse(result);
      setAnnouncement(
        decision === "approve"
          ? proposal
            ? `${proposal.proposedMaxMinutes}분까지 넓혀 추천을 다시 만들었어요.`
            : "시청 시간 조건을 넓혀 추천을 다시 만들었어요."
          : proposal
            ? `${proposal.currentMaxMinutes}분 조건을 유지한 결과를 보여드려요.`
            : "기존 시청 시간 조건을 유지한 결과를 보여드려요.",
      );
    } catch (decisionError) {
      setActionError(
        decisionError instanceof Error
          ? decisionError.message
          : "승인 결과를 반영하지 못했어요.",
      );
    } finally {
      setDeciding(null);
    }
  }

  async function clarify(answer: ClarificationAnswer) {
    if (
      response?.status !== "awaiting_approval" ||
      response.proposal.kind !== "FAMILY_COMPOSITION"
    ) {
      return;
    }
    const answerLabel = response.proposal.answers.find(
      (item) => item.value === answer,
    )?.label;
    setDeciding(answer);
    setActionError("");
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}/approval`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new Error(
          (result && "error" in result && result.error) ||
            "가족 구성 답변을 반영하지 못했어요.",
        );
      }
      setResponse(result);
      setAnnouncement(
        `${answerLabel ?? "선택한 가족 구성"} 조건을 반영해 추천을 이어갔어요.`,
      );
    } catch (clarificationError) {
      setActionError(
        clarificationError instanceof Error
          ? clarificationError.message
          : "가족 구성 답변을 반영하지 못했어요.",
      );
    } finally {
      setDeciding(null);
    }
  }

  async function replace(contentId: string) {
    if (replacementLock.current) return;
    replacementLock.current = true;
    setReplacingId(contentId);
    setReplacementFeedback(REPLACEMENT_FEEDBACK.pending);
    setAnnouncement(
      `${REPLACEMENT_FEEDBACK.pending.title} ${REPLACEMENT_FEEDBACK.pending.description}`,
    );
    try {
      const storageKey = "ott-damoa:not-interested";
      const current = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "[]",
      ) as unknown;
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
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}/replacement`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentId }),
        },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new ReplacementRequestError(
          request.status === 400 ? "exhausted" : "error",
          (result && "error" in result && result.error) ||
            "다른 후보가 없어요.",
        );
      }
      if (result.status !== "completed") {
        throw new ReplacementRequestError(
          "error",
          "교체 결과를 확인하지 못했어요.",
        );
      }
      setResponse(result);
      setReplacementFeedback(REPLACEMENT_FEEDBACK.success);
      setAnnouncement(
        `${REPLACEMENT_FEEDBACK.success.title} ${REPLACEMENT_FEEDBACK.success.description}`,
      );
    } catch (replaceError) {
      const feedback =
        replaceError instanceof ReplacementRequestError
          ? {
              ...REPLACEMENT_FEEDBACK[replaceError.feedbackStatus],
              description: `${replaceError.message} 기존 결과는 그대로 유지했어요.`,
            }
          : REPLACEMENT_FEEDBACK.error;
      setReplacementFeedback(feedback);
      setAnnouncement(`${feedback.title} ${feedback.description}`);
    } finally {
      replacementLock.current = false;
      setReplacingId(null);
    }
  }

  if (loading) {
    return <RecommendationWaitingScreen stage={2} theme="dark" />;
  }

  if (error || !response) {
    return (
      <div className="app-container my-12">
        <section className="flex min-h-[28rem] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-white/[0.03] p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-red-400/10 text-xl font-black text-red-300" aria-hidden="true">!</span>
          <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">
            추천 기록을 불러오지 못했어요.
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">
            {error || "추천 기록이 만료되었거나 저장소에 없을 수 있어요."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              className="min-h-12 rounded-full border border-slate-700 bg-white/5 px-5 text-sm font-black text-slate-200 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-orange-400"
              onClick={() => {
                setLoading(true);
                setError("");
                void loadRun();
              }}
            >
              다시 시도
            </button>
            <Link
              href="/choice"
              className="inline-flex min-h-12 items-center rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-5 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              새 추천 받기
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container results-page overflow-x-clip py-8 pb-20 sm:py-12">
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      {response.status === "awaiting_approval" ? (
        <ApprovalView
          response={response}
          onDecision={decide}
          onClarification={clarify}
          deciding={deciding}
          error={actionError}
        />
      ) : (
        <CompletedView
          response={response}
          onReplace={replace}
          replacingId={replacingId}
          replacementFeedback={replacementFeedback}
        />
      )}
    </div>
  );
}
