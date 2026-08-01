"use client";

import { useRouter } from "next/navigation";
import type {
  MvpApprovalDecision,
  MvpAwaitingApprovalRecommendationResponse,
  MvpCompletedRecommendationResponse,
  MvpRecommendationResponse,
} from "../../contracts/mvp-recommendation";
import { useChoiceHandoff } from "../choice-handoff/choice-handoff-provider";
import { ContentCard } from "../content-card";
import { RecommendationTimeline } from "../recommendation-timeline";
import type { NaturalInterpretation } from "./natural-language";

type NaturalResultProps = {
  response: MvpRecommendationResponse;
  interpretation: NaturalInterpretation;
  deciding: MvpApprovalDecision | null;
  decisionError: string;
  onDecision: (decision: MvpApprovalDecision) => void;
  onSameConditions: () => void;
  onEditInput: () => void;
  onReset: () => void;
};

function ConditionTags({ interpretation }: { interpretation: NaturalInterpretation }) {
  return (
    <section
      className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"
      aria-labelledby="interpreted-condition-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="choice-stepper__eyebrow">해석한 조건</p>
          <h2 id="interpreted-condition-title" className="text-xl font-black text-white sm:text-2xl">
            직접 말한 조건과 기본값을 나눠 봤어요.
          </h2>
        </div>
        <p className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
          <span><i className="mr-1 inline-block size-2 rounded-full bg-orange-500" />직접 말한 조건</span>
          <span><i className="mr-1 inline-block size-2 rounded-full bg-slate-600" />시스템 기본값</span>
        </p>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="해석된 추천 조건">
        {interpretation.tags.map((tag) => (
          <li
            key={tag.dimension}
            data-condition-source={tag.source.toLowerCase()}
            className={`rounded-full border px-3 py-2 text-xs font-bold leading-5 sm:text-sm ${
              tag.source === "USER"
                ? "border-orange-500/35 bg-orange-500/10 text-orange-200"
                : "border-slate-700 bg-slate-800/55 text-slate-400"
            }`}
          >
            <span className="mr-1.5 opacity-60">{tag.dimension}</span>
            {tag.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RuntimeApprovalBanner({
  response,
  deciding,
  error,
  onDecision,
}: {
  response: MvpAwaitingApprovalRecommendationResponse;
  deciding: MvpApprovalDecision | null;
  error: string;
  onDecision: (decision: MvpApprovalDecision) => void;
}) {
  return (
    <section className="approval-banner mb-8" aria-labelledby="runtime-approval-title">
      <div className="approval-banner__icon" aria-hidden="true">?</div>
      <div className="approval-banner__copy">
        <p className="eyebrow">조건 변경 전 확인</p>
        <h2 id="runtime-approval-title" className="mt-1 text-[clamp(1.75rem,3.6vw,2.625rem)] font-black leading-tight tracking-[-0.05em] text-[#0b1f52]">
          {response.proposal.question}
        </h2>
        <p>
          정확히 맞는 후보가 부족해도 조건을 몰래 바꾸지 않아요. 넓어지는
          조건은 러닝타임뿐이고 OTT·느낌·연령 기준은 그대로 유지합니다.
        </p>
        <div className="approval-change">
          <span>현재 <strong>{response.proposal.currentMaxMinutes}분</strong></span>
          <i aria-hidden="true">→</i>
          <span>제안 <strong>{response.proposal.proposedMaxMinutes}분</strong></span>
          <small>현재 조건 후보 {response.proposal.currentCandidateCount}편</small>
        </div>
        <div className="approval-actions">
          <button
            type="button"
            className="button button--primary"
            disabled={deciding !== null}
            onClick={() => onDecision("approve")}
          >
            {deciding === "approve"
              ? `${response.proposal.proposedMaxMinutes}분까지 다시 찾는 중…`
              : response.proposal.approveLabel}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={deciding !== null}
            onClick={() => onDecision("reject")}
          >
            {deciding === "reject"
              ? `${response.proposal.currentMaxMinutes}분 결과를 정리하는 중…`
              : response.proposal.rejectLabel}
          </button>
        </div>
        {error ? <p className="form-error approval-error" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}

function CompletedNaturalResults({
  response,
}: {
  response: MvpCompletedRecommendationResponse;
}) {
  const alternatives = response.recommendations
    .filter((item) => item.content.id !== response.topPick?.content.id)
    .slice(0, 4);
  const approvedRuntimeRelaxation = response.trace.some(
    (event) =>
      event.action === "approval_decision" &&
      event.metrics?.effectiveRuntimeMinutes === 45,
  );

  return (
    <>
      {approvedRuntimeRelaxation ? (
        <aside className="result-notice result-notice--neutral">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>승인한 범위로 시간 조건을 완화했어요.</strong>
            <p>러닝타임만 45분까지 넓혔고 나머지 조건은 그대로 지켰어요.</p>
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
          <h2 className="mt-4 text-2xl font-black text-white">조건에 맞는 안전한 작품이 없어요.</h2>
          <p className="mt-2 text-sm text-slate-400">조건을 자동으로 바꾸지 않았어요. 아래에서 조건을 직접 확인해 주세요.</p>
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
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-400">{alternatives.length}편</span>
          </div>
          <div className="content-grid content-grid--four mt-4">
            {alternatives.map((item, index) => (
              <ContentCard item={item} rank={index + 2} key={item.content.id} />
            ))}
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
          <small className="mt-1 font-semibold text-orange-100">현재 조건 유지 →</small>
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
      step.source === "USER"
        ? ("user" as const)
        : step.source === "DEFAULT"
          ? ("default" as const)
          : ("disclosure" as const),
  }));

  return (
    <main
      className="mx-auto w-full max-w-[75rem] px-5 py-10 pb-20 sm:px-6 sm:py-14 lg:px-8"
      data-natural-result="true"
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="choice-stepper__eyebrow">한마디 추천 결과</p>
          <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            {response.status === "awaiting_approval"
              ? "조건을 그대로 지킨 후보가 부족해요."
              : `조건에 맞는 ${displayedCount}편을 찾았어요.`}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
            직접 말한 조건과 시스템 기본값을 구분하고, 왜 골랐는지 함께 보여드려요.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
          조건·안전 확인
        </span>
      </header>

      <ConditionTags interpretation={interpretation} />

      {response.status === "awaiting_approval" ? (
        <>
          <RuntimeApprovalBanner
            response={response}
            deciding={deciding}
            error={decisionError}
            onDecision={onDecision}
          />
          {response.partialRecommendations.length ? (
            <section className="mb-7" aria-labelledby="partial-result-title">
              <h2 id="partial-result-title" className="mb-4 text-xl font-black text-white">
                현재 조건을 지킨 후보 {response.partialRecommendations.length}편
              </h2>
              <div className="content-grid">
                {response.partialRecommendations.map((item, index) => (
                  <ContentCard item={item} rank={index + 1} key={item.content.id} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <CompletedNaturalResults response={response} />
      )}

      <div className="mt-7">
        <RecommendationTimeline response={response} interpretationSteps={timelineSteps} />
      </div>

      <ResultActions
        interpretation={interpretation}
        onSameConditions={onSameConditions}
        onEditInput={onEditInput}
        onReset={onReset}
      />
    </main>
  );
}
