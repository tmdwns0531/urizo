"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  MvpApprovalDecision as ApprovalDecision,
  MvpAwaitingApprovalRecommendationResponse as AwaitingApprovalRecommendationResponse,
  MvpClarificationAnswer as ClarificationAnswer,
  MvpRecommendationResponse as RecommendationResponse,
} from "@/contracts/mvp-recommendation";
import { RecommendationWaitingScreen } from "./advertising/recommendation-waiting-screen";
import { useChoiceHandoff } from "./choice-handoff/choice-handoff-provider";
import { ContentCard } from "./content-card";
import {
  ChoiceConditionSummary,
  CompletedRecommendationResult,
} from "./completed-recommendation-result";
import { RecommendationTimeline } from "./recommendation-timeline";

type RecommendationViewProps = {
  runId: string;
};

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

export function RecommendationView({ runId }: RecommendationViewProps) {
  const router = useRouter();
  const {
    pendingChoiceHandoff,
    publishChoiceHandoff,
    consumeChoiceHandoff,
  } = useChoiceHandoff();
  const [choiceDraft] = useState(() => pendingChoiceHandoff?.draft ?? null);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deciding, setDeciding] = useState<
    ApprovalDecision | ClarificationAnswer | null
  >(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (pendingChoiceHandoff) {
      consumeChoiceHandoff(pendingChoiceHandoff.token);
    }
  }, [consumeChoiceHandoff, pendingChoiceHandoff]);

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
        <CompletedRecommendationResult
          source="choice"
          response={response}
          conditionSummary={
            <ChoiceConditionSummary summary={response.conditionSummary} />
          }
          onResponseChange={setResponse}
          onEditConditions={() => {
            if (choiceDraft) publishChoiceHandoff(choiceDraft);
            router.push("/choice");
          }}
          onReset={() => window.location.assign("/choice")}
        />
      )}
    </div>
  );
}
