import type { CatalogRepository } from "../../contracts/ports";
import type {
  MvpApprovalProposal,
  MvpRecommendationExecutionResult,
  NewTraceEvent,
} from "../../contracts/mvp-recommendation";
import type {
  MvpDemoScenario,
  RecommendationSearchInvocation,
  SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";
import { MVP_BUDGET_LIMITS } from "../../contracts/mvp-recommendation";
import { RESULT_LIMIT } from "../../config/recommendation";
import { getMvpFilterReasons } from "../catalog/filtering";
import { BudgetCounter, BudgetExceededError } from "./budget";
import type {
  MvpRecommendationExecutor,
  RecommendationSelectionMode,
} from "./executors/types";
import { ruleBasedFallback } from "./fallback";

export type MvpPolicyResult =
  | {
      status: "completed";
      recommendations: MvpRecommendationExecutionResult["selected"];
      execution: MvpRecommendationExecutionResult;
      policyBlockedCount: number;
      notice?: string;
      traceEvents: NewTraceEvent[];
    }
  | {
      status: "awaiting_approval";
      proposal: MvpApprovalProposal;
      partialRecommendations: MvpRecommendationExecutionResult["selected"];
      execution: MvpRecommendationExecutionResult;
      policyBlockedCount: number;
      traceEvents: NewTraceEvent[];
    };

function publicTrace(
  action: NewTraceEvent["action"],
  title: string,
  publicMessage: string,
  metrics?: NewTraceEvent["detail"]["metrics"],
): NewTraceEvent {
  return {
    action,
    visibility: "PUBLIC",
    publicMessage,
    detail: {
      title,
      description: publicMessage,
      ...(metrics ? { metrics } : {}),
    },
    durationMs: null,
  };
}

function sanitizedInput(
  invocation: RecommendationSearchInvocation,
): SanitizedRecommendationSearchInput {
  if (invocation.kind === "continuation") {
    return invocation.input;
  }
  const { naturalLanguage, ...input } = invocation.input;
  void naturalLanguage;
  return input;
}

export class PolicyLayer {
  constructor(private readonly catalog: CatalogRepository) {}

  async execute(
    runId: string,
    invocation: RecommendationSearchInvocation,
    executor: MvpRecommendationExecutor,
    scenario: MvpDemoScenario,
    selectionMode: RecommendationSelectionMode,
  ): Promise<MvpPolicyResult> {
    const input = sanitizedInput(invocation);
    const budget = new BudgetCounter(MVP_BUDGET_LIMITS);
    let attempt = await executor.execute({
      runId,
      searchInvocation: invocation,
      budget,
      selectionMode,
    });

    // Demo-only fault injection occurs after catalog/search created a safe,
    // persistence-ready continuation. LIVE requests cannot select scenarios.
    if (scenario === "budget_fallback" && attempt.kind === "success") {
      try {
        budget.consumeTokens(MVP_BUDGET_LIMITS.tokens + 1);
      } catch (error) {
        if (!(error instanceof BudgetExceededError)) throw error;
        attempt = {
          kind: "fallback_required",
          reason: "BUDGET_EXCEEDED",
          budgetSnapshot: error.snapshot,
          durationMs: attempt.result.durationMs,
          fallbackInput: {
            eligibleCatalog: attempt.result.ranked.map(
              ({ content }) => content,
            ),
            searchInput: input,
            continuation: attempt.result.continuation,
            excludedContentIds: attempt.result.excludedContentIds,
          },
        };
      }
    }
    let execution: MvpRecommendationExecutionResult;
    const traceEvents: NewTraceEvent[] = [];

    if (attempt.kind === "fallback_required") {
      const fallback = ruleBasedFallback(attempt.fallbackInput);
      execution = {
        ...fallback,
        continuation: attempt.fallbackInput.continuation,
        executionMode: "FALLBACK",
        fallbackUsed: true,
        fallbackReason: attempt.reason,
        budgetSnapshot: attempt.budgetSnapshot,
        durationMs: attempt.durationMs,
        notice: "응답 시간을 지키기 위해 기본 추천으로 보여드려요.",
      };
      traceEvents.push(
        publicTrace(
          "fallback",
          "안전한 규칙 추천으로 전환했어요",
          "외부 호출을 더 진행하지 않고 같은 필수 조건의 고정 점수 규칙을 사용했습니다.",
          {
            modelCalls: attempt.budgetSnapshot.modelCalls,
            toolCalls: attempt.budgetSnapshot.toolCalls,
            tokens: attempt.budgetSnapshot.tokens,
            durationMs: attempt.durationMs,
          },
        ),
      );
    } else {
      execution = attempt.result;
    }

    traceEvents.unshift(
      publicTrace(
        "filter",
        "필수 조건을 먼저 확인했어요",
        "익명 연령, 국내 OTT, 선택 OTT, 시간, 제작 국가와 제외 장르를 코드로 검사했습니다.",
        { eligibleCount: execution.eligibleCount },
      ),
      publicTrace(
        "vector_search",
        "현재 요청과 가까운 작품을 찾았어요",
        invocation.kind === "initial" && invocation.input.hasNaturalLanguage
          ? "자연어 원문은 저장하지 않고 vector로 변환해 후보를 찾았습니다."
          : "정제된 CHOICE와 저장 vector를 사용해 후보를 찾았습니다.",
        { candidateCount: execution.ranked.length },
      ),
      publicTrace(
        "score",
        "후보 점수를 계산했어요",
        "의미, 분위기, 장르, 시간, 작품 품질, 동반자 적합도와 다양성을 계산했습니다.",
        { candidateCount: execution.ranked.length },
      ),
      publicTrace(
        "select",
        "최종 후보를 선택했어요",
        "후보 allowlist 안에서 예산을 지키며 최종 작품을 선택했습니다.",
        {
          resultCount: execution.selected.length,
          modelCalls: execution.budgetSnapshot.modelCalls,
          toolCalls: execution.budgetSnapshot.toolCalls,
          tokens: execution.budgetSnapshot.tokens,
        },
      ),
    );

    let candidates = [...execution.selected];
    if (scenario === "policy_block") {
      const allContents = await this.catalog.list();
      const unsafe = allContents.find(
        (content) => getMvpFilterReasons(content, input).length > 0,
      );
      const source = execution.ranked[0] ?? candidates[0];
      if (unsafe && source) {
        candidates = [
          { ...source, content: unsafe },
          ...candidates.slice(0, RESULT_LIMIT - 1),
        ];
      }
    }

    const blocked = candidates.filter(
      (item) => getMvpFilterReasons(item.content, input).length > 0,
    );
    const safe = candidates.filter(
      (item) => getMvpFilterReasons(item.content, input).length === 0,
    );
    if (blocked.length > 0) {
      traceEvents.push(
        publicTrace(
          "policy_block",
          "응답 직전에 안전하지 않은 후보를 제외했어요",
          "선택 결과를 다시 검사해 필수 조건을 위반한 작품을 노출하지 않았습니다.",
          { blockedCount: blocked.length },
        ),
      );
    }

    for (const candidate of execution.ranked) {
      if (safe.length >= RESULT_LIMIT) break;
      if (
        safe.some((item) => item.content.id === candidate.content.id) ||
        getMvpFilterReasons(candidate.content, input).length > 0
      ) {
        continue;
      }
      safe.push(candidate);
    }

    const recommendations = safe.slice(0, RESULT_LIMIT);
    execution = {
      ...execution,
      selected: recommendations,
    };

    if (
      !execution.fallbackUsed &&
      input.maxRuntimeMinutes === 30 &&
      (scenario === "approval" || recommendations.length < RESULT_LIMIT)
    ) {
      const proposal: MvpApprovalProposal = {
        kind: "RUNTIME_RELAXATION",
        currentMaxMinutes: 30,
        proposedMaxMinutes: 45,
        currentCandidateCount: recommendations.length,
        question: `30분 이내로는 ${recommendations.length}편만 찾았어요. 45분까지 넓혀서 다시 찾아볼까요?`,
        approveLabel: "넓혀서 다시 찾기",
        rejectLabel: `${recommendations.length}편만 보기`,
      };
      traceEvents.push(
        publicTrace(
          "approval_request",
          "조건을 바꾸기 전에 승인을 기다려요",
          proposal.question,
          {
            effectiveRuntimeMinutes: 30,
            resultCount: recommendations.length,
          },
        ),
      );
      return {
        status: "awaiting_approval",
        proposal,
        partialRecommendations: recommendations,
        execution,
        policyBlockedCount: blocked.length,
        traceEvents,
      };
    }

    const notice =
      execution.notice ??
      (recommendations.length < RESULT_LIMIT
        ? `조건에 맞는 작품을 ${recommendations.length}편 찾았어요. 조건을 임의로 완화하지 않았습니다.`
        : undefined);
    traceEvents.push(
      publicTrace(
        "complete",
        "최종 정책 검사를 통과했어요",
        notice ?? `안전 조건을 통과한 ${recommendations.length}편을 추천합니다.`,
        {
          resultCount: recommendations.length,
          blockedCount: blocked.length,
          durationMs: execution.durationMs,
        },
      ),
    );
    return {
      status: "completed",
      recommendations,
      execution,
      policyBlockedCount: blocked.length,
      ...(notice ? { notice } : {}),
      traceEvents,
    };
  }
}