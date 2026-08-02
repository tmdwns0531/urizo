"use client";

import { useRouter } from "next/navigation";
import type {
  MvpApprovalDecision,
  MvpAwaitingApprovalRecommendationResponse,
  MvpClarificationAnswer,
  MvpCompletedRecommendationResponse,
  MvpRecommendationResponse,
  MvpRuntimeRelaxationProposal,
} from "../../contracts/mvp-recommendation";
import { SponsoredVideoAd } from "../advertising/sponsored-video-ad";
import { useChoiceHandoff } from "../choice-handoff/choice-handoff-provider";
import { ContentCard } from "../content-card";
import { RecommendationTimeline } from "../recommendation-timeline";
import { NaturalConditionSummary } from "./natural-condition-summary";
import type { NaturalInterpretation } from "./natural-language";

type NaturalResultProps = {
  response: MvpRecommendationResponse;
  interpretation: NaturalInterpretation;
  deciding: MvpApprovalDecision | MvpClarificationAnswer | null;
  decisionError: string;
  onDecision: (
    decision: MvpApprovalDecision | MvpClarificationAnswer,
  ) => void;
  onSameConditions: () => void;
  onAllowAnyMediaType: () => void;
  onEditInput: () => void;
  onReset: () => void;
};

function RuntimeApprovalBanner({
  response,
  deciding,
  error,
  onDecision,
}: {
  response: MvpAwaitingApprovalRecommendationResponse & {
    proposal: MvpRuntimeRelaxationProposal;
  };
  deciding: MvpApprovalDecision | MvpClarificationAnswer | null;
  error: string;
  onDecision: (decision: MvpApprovalDecision) => void;
}) {
  return (
    <section
      className="mb-8 grid gap-5 rounded-3xl border border-white/10 bg-[#191d22] p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)] sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6 sm:p-7"
      aria-labelledby="runtime-approval-title"
    >
      <div
        className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] text-xl font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.22)] sm:size-14"
        aria-hidden="true"
      >
        ?
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black tracking-[0.14em] text-orange-300">
          조건 변경 전 확인
        </p>
        <h2
          id="runtime-approval-title"
          className="mt-2 text-balance text-[clamp(1.75rem,3.6vw,2.625rem)] font-black leading-tight tracking-[-0.05em] text-white"
        >
          {response.proposal.question}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          정확히 맞는 후보가 부족해도 조건을 몰래 바꾸지 않아요. 넓어지는
          조건은 러닝타임뿐이고 OTT·느낌·연령 기준은 그대로 유지합니다.
        </p>
        <div className="mt-5 flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#10151b]/80 p-5 text-sm leading-6 text-slate-300">
          <span>
            현재
            <strong className="ml-1 text-lg text-white">
              {response.proposal.currentMaxMinutes}분
            </strong>
          </span>
          <i className="not-italic text-orange-400" aria-hidden="true">→</i>
          <span>
            제안
            <strong className="ml-1 text-lg text-orange-300">
              {response.proposal.proposedMaxMinutes}분
            </strong>
          </span>
          <small className="w-full text-sm text-slate-400 sm:ml-auto sm:w-auto">
            현재 조건 후보 {response.proposal.currentCandidateCount}편
          </small>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-12 rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-6 text-sm font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.22)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:translate-y-0 disabled:opacity-50"
            disabled={deciding !== null}
            onClick={() => onDecision("approve")}
          >
            {deciding === "approve"
              ? `${response.proposal.proposedMaxMinutes}분까지 다시 찾는 중…`
              : response.proposal.approveLabel}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-full border border-slate-700 bg-white/5 px-6 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 disabled:opacity-50"
            disabled={deciding !== null}
            onClick={() => onDecision("reject")}
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
  );
}

function AgentClarificationChat({
  response,
  deciding,
  error,
  onDecision,
}: {
  response: MvpAwaitingApprovalRecommendationResponse;
  deciding: MvpApprovalDecision | MvpClarificationAnswer | null;
  error: string;
  onDecision: (answer: MvpClarificationAnswer) => void;
}) {
  if (response.proposal.kind !== "FAMILY_COMPOSITION") return null;

  return (
    <section
      className="mb-8 rounded-3xl border border-white/10 bg-[#171b21] p-5 shadow-2xl sm:p-7"
      aria-labelledby="agent-clarification-title"
      data-agent-chat="clarification"
    >
      <p className="choice-stepper__eyebrow">추가 질문</p>
      <div className="mt-5 flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-500 font-black text-white" aria-hidden="true">A</span>
        <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-white px-5 py-4 text-[#0b1f52]">
          <h2 id="agent-clarification-title" className="text-lg font-black sm:text-xl">
            {response.proposal.question}
          </h2>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 pl-0 sm:pl-13" aria-label="추가 질문 답변">
        {response.proposal.answers.map((answer) => (
          <button
            type="button"
            className="min-h-12 rounded-full border border-orange-400/35 bg-orange-500/10 px-5 text-sm font-black text-orange-200 transition hover:bg-orange-500/20 disabled:opacity-50"
            disabled={deciding !== null}
            onClick={() => onDecision(answer.value)}
            key={answer.value}
          >
            {deciding === answer.value ? "조건을 반영하는 중…" : answer.label}
          </button>
        ))}
      </div>
      {error ? <p className="form-error mt-4" role="alert">{error}</p> : null}
    </section>
  );
}

function CompletedNaturalResults({
  response,
  onAllowAnyMediaType,
  onEditInput,
}: {
  response: MvpCompletedRecommendationResponse;
  onAllowAnyMediaType: () => void;
  onEditInput: () => void;
}) {
  const alternatives = response.recommendations
    .filter((item) => item.content.id !== response.topPick?.content.id)
    .slice(0, 4);
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
            <strong>연령 기준에 맞지 않는 후보를 제외했어요.</strong>
            <p>부적합 후보 {response.policyBlockedCount}편의 상세는 노출하지 않았어요.</p>
          </div>
        </aside>
      ) : null}

      {response.notice ? (
        <aside className="result-notice result-notice--neutral">
          <span aria-hidden="true">i</span>
          <div><strong>{response.notice}</strong></div>
        </aside>
      ) : null}

      {response.topPick ? (
        <section aria-labelledby="natural-top-pick-title">
          <h2 id="natural-top-pick-title" className="sr-only">가장 먼저 추천하는 작품</h2>
          <ContentCard item={response.topPick} rank={1} hero />
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-700 bg-white/[0.03] px-6 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-800 text-xl text-slate-400" aria-hidden="true">◇</span>
          <h2 className="mt-4 text-2xl font-black text-white">
            {response.noResult?.message ?? "현재 조건을 모두 만족하는 작품이 없어요."}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-300">
            영화·시리즈, 아이 안전, 제외 장르와 선택한 OTT는 자동으로 완화하지 않았어요.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {response.noResult?.availableActions.includes("EXTEND_RUNTIME") ? (
              <button
                type="button"
                className="min-h-12 rounded-full border border-slate-600 px-5 text-sm font-black text-slate-200 hover:border-slate-400 hover:text-white"
                onClick={onEditInput}
              >
                시청 시간 늘리기
              </button>
            ) : null}
            {response.noResult?.availableActions.includes("ALLOW_ANY_MEDIA_TYPE") ? (
              <button
                type="button"
                className="min-h-12 rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-5 text-sm font-black text-white"
                onClick={onAllowAnyMediaType}
              >
                영화·시리즈 모두 보기
              </button>
            ) : null}
            <button
              type="button"
              className="min-h-12 rounded-full border border-slate-600 px-5 text-sm font-black text-slate-200 hover:border-slate-400 hover:text-white"
              onClick={onEditInput}
            >
              조건 다시 입력하기
            </button>
          </div>
        </section>
      )}

      {alternatives.length ? (
        <section className="alternative-section" aria-labelledby="natural-alternatives-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="choice-stepper__eyebrow">함께 비교할 후보</p>
              <h2 id="natural-alternatives-title" className="text-2xl font-black tracking-[-0.04em] text-white">
                나머지 {alternatives.length}편도 비교해 보세요.
              </h2>
            </div>
            <span className="hidden text-sm font-bold text-slate-400 sm:inline">
              추천 {alternatives.length}편 · 광고/안내 1개
            </span>
          </div>
          <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin] md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-3 xl:grid-cols-5">
            {alternatives.map((item, index) => (
              <ContentCard
                item={item}
                rank={index + 2}
                rail
                key={item.content.id}
              />
            ))}
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
    </>
  );
}

function ResultActions({
  interpretation,
  onSameConditions,
  onEditInput,
  onReset,
}: {
  interpretation: NaturalInterpretation;
  onSameConditions: () => void;
  onEditInput: () => void;
  onReset: () => void;
}) {
  const router = useRouter();
  const { publishChoiceHandoff } = useChoiceHandoff();

  function continueInChoice() {
    publishChoiceHandoff(interpretation.draft);
    router.push("/choice");
  }

  return (
    <section className="mt-9 border-t border-white/10 pt-7" aria-labelledby="natural-next-actions-title">
      <h2 id="natural-next-actions-title" className="text-xl font-black text-white">다음에는 무엇을 할까요?</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="flex min-h-24 flex-col items-start justify-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] px-5 text-left font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.2)] transition hover:-translate-y-0.5"
          onClick={continueInChoice}
        >
          디테일하게 직접 고르기
          <small className="mt-2 text-sm font-semibold leading-6 text-orange-100">현재 조건 유지 →</small>
        </button>
        <button type="button" className="min-h-24 rounded-2xl border border-slate-700 bg-[#191d22] px-5 text-left font-bold text-slate-200 hover:border-slate-500" onClick={onSameConditions}>
          같은 조건으로 다시 추천받기
        </button>
        <button type="button" className="min-h-24 rounded-2xl border border-slate-700 bg-[#191d22] px-5 text-left font-bold text-slate-200 hover:border-slate-500" onClick={onEditInput}>
          한마디 수정하기
        </button>
        <button type="button" className="min-h-24 rounded-2xl border border-slate-700 bg-[#191d22] px-5 text-left font-bold text-slate-200 hover:border-slate-500" onClick={onReset}>
          새 한마디로 시작하기
        </button>
      </div>
    </section>
  );
}

export function NaturalRecommendationResult({
  response,
  interpretation,
  deciding,
  decisionError,
  onDecision,
  onSameConditions,
  onAllowAnyMediaType,
  onEditInput,
  onReset,
}: NaturalResultProps) {
  const displayedCount =
    response.status === "completed"
      ? response.recommendations.length
      : response.partialRecommendations.length;
  const timelineSteps = interpretation.steps.map((step) => ({
    title: step.title,
    description: step.description,
    kind:
      step.source === "EXPLICIT" ||
      step.source === "USER_EDITED" ||
      step.source === "CLARIFIED"
        ? ("user" as const)
        : step.source === "DEFAULT"
          ? ("default" as const)
          : ("disclosure" as const),
  }));

  return (
    <main
      className="app-container py-10 pb-20 sm:py-14"
      data-natural-result="true"
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="choice-stepper__eyebrow">한마디 추천 결과</p>
          <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            {response.status === "awaiting_approval"
              ? response.proposal.kind === "FAMILY_COMPOSITION"
                ? "한 가지만 더 알려주세요."
                : "조건을 그대로 지킨 후보가 부족해요."
              : `조건에 맞는 ${displayedCount}편을 찾았어요.`}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            직접 말한 조건과 시스템 기본값을 구분하고, 왜 골랐는지 함께 보여드려요.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">
          조건·안전 확인
        </span>
      </header>

      <NaturalConditionSummary interpretation={interpretation} className="mb-7" />

      {response.status === "awaiting_approval" ? (
        <>
          {response.proposal.kind === "FAMILY_COMPOSITION" ? (
            <AgentClarificationChat
              response={response}
              deciding={deciding}
              error={decisionError}
              onDecision={onDecision}
            />
          ) : (
            <RuntimeApprovalBanner
              response={{ ...response, proposal: response.proposal }}
              deciding={deciding}
              error={decisionError}
              onDecision={onDecision}
            />
          )}
          {response.proposal.kind === "RUNTIME_RELAXATION" &&
          response.partialRecommendations.length ? (
            <section className="mb-7" aria-labelledby="partial-result-title">
              <h2 id="partial-result-title" className="mb-4 text-xl font-black text-white">
                현재 조건을 지킨 후보 {response.partialRecommendations.length}편
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
                {response.partialRecommendations.map((item, index) => (
                  <ContentCard item={item} rank={index + 1} key={item.content.id} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <CompletedNaturalResults
            response={response}
            onAllowAnyMediaType={onAllowAnyMediaType}
            onEditInput={onEditInput}
          />

          <div className="mt-7">
            <RecommendationTimeline
              response={response}
              interpretationSteps={timelineSteps}
            />
          </div>

          <ResultActions
            interpretation={interpretation}
            onSameConditions={onSameConditions}
            onEditInput={onEditInput}
            onReset={onReset}
          />
        </>
      )}
    </main>
  );
}
