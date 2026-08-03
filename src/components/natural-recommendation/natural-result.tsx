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
import { useChoiceHandoff } from "../choice-handoff/choice-handoff-provider";
import { CompletedRecommendationResult } from "../completed-recommendation-result";
import { ContentCard } from "../content-card";
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
  onResponseChange: (response: MvpCompletedRecommendationResponse) => void;
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
          <i className="not-italic text-orange-400" aria-hidden="true">
            →
          </i>
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

function FamilyClarification({
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
      aria-labelledby="family-clarification-title"
      data-agent-chat="clarification"
    >
      <p className="choice-stepper__eyebrow">추가 질문</p>
      <div className="mt-5 flex gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-500 font-black text-white"
          aria-hidden="true"
        >
          A
        </span>
        <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-white px-5 py-4 text-[#0b1f52]">
          <h2
            id="family-clarification-title"
            className="text-lg font-black sm:text-xl"
          >
            {response.proposal.question}
          </h2>
        </div>
      </div>
      <div
        className="mt-5 flex flex-wrap gap-3 pl-0 sm:pl-13"
        aria-label="추가 질문 답변"
      >
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
      {error ? (
        <p className="form-error mt-4" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function NaturalRecommendationResult({
  response,
  interpretation,
  deciding,
  decisionError,
  onDecision,
  onResponseChange,
  onAllowAnyMediaType,
  onEditInput,
  onReset,
}: NaturalResultProps) {
  const router = useRouter();
  const { publishChoiceHandoff } = useChoiceHandoff();

  function continueInChoice() {
    publishChoiceHandoff(interpretation.draft);
    router.push("/choice");
  }

  if (response.status === "completed") {
    return (
      <main
        className="app-container results-page overflow-x-clip py-8 pb-20 sm:py-12"
        data-natural-result="true"
      >
        <CompletedRecommendationResult
          source="natural"
          response={response}
          conditionSummary={
            <NaturalConditionSummary interpretation={interpretation} />
          }
          onResponseChange={onResponseChange}
          onEditConditions={onEditInput}
          onReset={onReset}
          onContinueInChoice={continueInChoice}
          onAllowAnyMediaType={onAllowAnyMediaType}
        />
      </main>
    );
  }

  return (
    <main className="app-container py-10 pb-20 sm:py-14" data-natural-result="true">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="choice-stepper__eyebrow">한마디 추천 결과</p>
          <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            {response.proposal.kind === "FAMILY_COMPOSITION"
              ? "한 가지만 더 알려주세요."
              : "조건을 그대로 지킨 후보가 부족해요."}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            선택한 조건과 안전 기준을 바꾸지 않고 필요한 내용만 확인할게요.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">
          조건·안전 확인
        </span>
      </header>

      <NaturalConditionSummary interpretation={interpretation} className="mb-7" />

      {response.proposal.kind === "FAMILY_COMPOSITION" ? (
        <FamilyClarification
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
    </main>
  );
}
