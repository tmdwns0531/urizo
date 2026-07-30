import type { CatalogRepository } from "../../contracts/ports";
import type {
  ApprovalProposal,
  RecommendationItem,
} from "../../contracts/recommendation";
import type { UserContext } from "../../contracts/user";
import {
  BUDGET_LIMITS,
  RESULT_LIMIT,
} from "../../config/recommendation";
import { getFilterReasons } from "../catalog/filtering";
import {
  BudgetCounter,
  BudgetExceededError,
} from "./budget";
import type {
  RecommendationExecutionResult,
  RecommendationExecutor,
} from "./executors/types";
import { ruleBasedFallback } from "./fallback";
import type { ResolvedRecommendationRequest } from "./request";
import { toSearchInput } from "./request";
import { PublicTraceWriter } from "./trace";

export type PolicyResult =
  | {
      status: "completed";
      recommendations: RecommendationItem[];
      fallbackUsed: boolean;
      policyBlockedCount: number;
      excludedContentIds: string[];
      notice?: string;
    }
  | {
      status: "awaiting_approval";
      proposal: ApprovalProposal;
      partialRecommendations: RecommendationItem[];
      fallbackUsed: false;
      policyBlockedCount: number;
      excludedContentIds: string[];
    };

export interface SafeReplacementResult {
  replacement: RecommendationItem;
  fallbackUsed: boolean;
  policyBlockedCount: number;
  excludedContentIds: string[];
}

interface BudgetedExecution {
  execution: RecommendationExecutionResult;
  fallbackUsed: boolean;
}

export class PolicyLayer {
  constructor(private readonly catalog: CatalogRepository) {}

  async execute(
    runId: string,
    user: UserContext,
    request: ResolvedRecommendationRequest,
    executor: RecommendationExecutor,
    trace: PublicTraceWriter,
  ): Promise<PolicyResult> {
    const searchInput = toSearchInput(request, user);
    const { execution, fallbackUsed } = await this.executeWithBudget(
      runId,
      user,
      request,
      executor,
      trace,
    );

    if (
      !fallbackUsed &&
      request.choice.maxRuntimeMinutes === 30 &&
      (request.scenario === "approval" ||
        execution.selected.length < RESULT_LIMIT)
    ) {
      const verified = execution.selected.filter(
        (item) => getFilterReasons(item.content, searchInput).length === 0,
      );
      const proposal: ApprovalProposal = {
        kind: "RUNTIME_RELAXATION",
        currentMaxMinutes: 30,
        proposedMaxMinutes: 45,
        currentCandidateCount: verified.length,
        question: `30분 이내로는 ${verified.length}편만 찾았어요. 45분까지 넓혀서 다시 찾아볼까요?`,
        approveLabel: "넓혀서 다시 찾기",
        rejectLabel: `${verified.length}편만 보기`,
      };
      await trace.emit("approval_request", {
        title: "조건을 바꾸기 전에 승인을 기다려요",
        description: proposal.question,
        metrics: {
          현재시간: 30,
          제안시간: 45,
          현재후보: verified.length,
        },
      });
      return {
        status: "awaiting_approval",
        proposal,
        partialRecommendations: verified,
        fallbackUsed: false,
        policyBlockedCount: 0,
        excludedContentIds: execution.excludedContentIds,
      };
    }

    let candidates = [...execution.selected];
    if (request.scenario === "policy_block") {
      const contents = await this.catalog.list();
      const unsafe = user.isMinor
        ? contents.find((content) => content.ageRating === "18")
        : contents.find(
            (content) =>
              getFilterReasons(content, searchInput).length > 0 &&
              !candidates.some((item) => item.content.id === content.id),
          );
      if (unsafe) {
        const source = execution.ranked[0] ?? candidates[0];
        if (source) {
          candidates = [
            {
              ...source,
              content: unsafe,
              score: 0.99,
              matchPercent: 99,
              scoreBreakdown: {
                ...source.scoreBreakdown,
                total: 0.99,
              },
              reasons: ["최종 정책 검사 전 선택기가 추가한 검증 대상이에요"],
            },
            ...candidates.slice(0, RESULT_LIMIT - 1),
          ];
        }
      }
    }

    const blocked = candidates.filter(
      (item) => getFilterReasons(item.content, searchInput).length > 0,
    );
    const safe = candidates.filter(
      (item) => getFilterReasons(item.content, searchInput).length === 0,
    );
    if (blocked.length > 0) {
      await this.emitPolicyBlock(trace, user, blocked);
    }

    for (const alternative of execution.ranked) {
      if (safe.length >= RESULT_LIMIT) {
        break;
      }
      if (
        safe.some((item) => item.content.id === alternative.content.id) ||
        getFilterReasons(alternative.content, searchInput).length > 0
      ) {
        continue;
      }
      safe.push(alternative);
    }

    const recommendations = safe.slice(0, RESULT_LIMIT);
    const notice =
      recommendations.length < RESULT_LIMIT
        ? `조건에 맞는 작품을 ${recommendations.length}편 찾았어요. 조건을 임의로 완화하지 않았습니다.`
        : undefined;
    await trace.emit("complete", {
      title: "최종 정책 검사를 통과했어요",
      description:
        notice ?? `안전 조건을 통과한 ${recommendations.length}편을 추천합니다.`,
      metrics: {
        결과: recommendations.length,
        정책차단: blocked.length,
        폴백: fallbackUsed,
      },
    });

    return {
      status: "completed",
      recommendations,
      fallbackUsed,
      policyBlockedCount: blocked.length,
      excludedContentIds: execution.excludedContentIds,
      notice,
    };
  }

  async selectSafeReplacement(
    runId: string,
    user: UserContext,
    request: ResolvedRecommendationRequest,
    executor: RecommendationExecutor,
    trace: PublicTraceWriter,
    currentRecommendations: readonly RecommendationItem[],
    replacedContentIds: readonly string[],
    contentId: string,
  ): Promise<SafeReplacementResult> {
    const searchInput = toSearchInput(request, user);
    const { execution, fallbackUsed } = await this.executeWithBudget(
      runId,
      user,
      request,
      executor,
      trace,
    );
    const unavailable = new Set([
      ...currentRecommendations.map(({ content }) => content.id),
      ...replacedContentIds,
    ]);
    const blocked: RecommendationItem[] = [];
    let replacement: RecommendationItem | undefined;

    for (const candidate of execution.ranked) {
      if (unavailable.has(candidate.content.id)) {
        continue;
      }
      if (getFilterReasons(candidate.content, searchInput).length > 0) {
        blocked.push(candidate);
        continue;
      }
      replacement = candidate;
      break;
    }

    if (blocked.length > 0) {
      await this.emitPolicyBlock(trace, user, blocked);
    }
    if (!replacement) {
      throw new Error("No safe replacement is available for this run.");
    }

    const previous = currentRecommendations.find(
      ({ content }) => content.id === contentId,
    );
    await trace.emit("replacement", {
      title: "안전 조건을 유지한 새 작품으로 교체했어요",
      description: previous
        ? `‘${previous.content.title}’ 대신 ‘${replacement.content.title}’을 추천합니다.`
        : `‘${replacement.content.title}’을 새 후보로 추천합니다.`,
      metrics: {
        정책차단: blocked.length,
        폴백: fallbackUsed,
      },
    });

    return {
      replacement,
      fallbackUsed,
      policyBlockedCount: blocked.length,
      excludedContentIds: execution.excludedContentIds,
    };
  }

  private async executeWithBudget(
    runId: string,
    user: UserContext,
    request: ResolvedRecommendationRequest,
    executor: RecommendationExecutor,
    trace: PublicTraceWriter,
  ): Promise<BudgetedExecution> {
    const searchInput = toSearchInput(request, user);
    const budget = new BudgetCounter(BUDGET_LIMITS);

    try {
      if (request.scenario === "budget_fallback") {
        budget.consumeTool();
        budget.consumeTool();
        budget.consumeTool();
      }
      return {
        execution: await executor.execute({
          runId,
          user,
          request,
          searchInput,
          budget,
          trace,
        }),
        fallbackUsed: false,
      };
    } catch (error) {
      if (!(error instanceof BudgetExceededError)) {
        throw error;
      }
      const contents = await this.catalog.list();
      const fallback = ruleBasedFallback(contents, searchInput);
      await trace.emit("fallback", {
        title: "예산 상한을 지켜 룰 기반 추천으로 전환했어요",
        description:
          "외부 호출을 더 진행하지 않고 필수 조건과 고정 점수 규칙만으로 결과를 만들었습니다.",
        metrics: {
          도구호출: error.snapshot.toolCalls,
          모델호출: error.snapshot.modelCalls,
          토큰: error.snapshot.tokens,
        },
      });
      return {
        execution: {
          ranked: fallback.ranked,
          selected: fallback.items,
          excludedContentIds: fallback.excludedContentIds,
          eligibleCount: fallback.eligibleCount,
        },
        fallbackUsed: true,
      };
    }
  }

  private async emitPolicyBlock(
    trace: PublicTraceWriter,
    user: UserContext,
    blocked: readonly RecommendationItem[],
  ): Promise<void> {
    await trace.emit("policy_block", {
      title: `${blocked.length}편을 응답 직전에 안전하게 제외했어요`,
      description:
        "선택기가 만든 결과를 신뢰하지 않고 연령, 구독 OTT, 시간, 시청 이력을 다시 강제 검사했습니다.",
      metrics: {
        차단: blocked.length,
        미성년보호: blocked.some(
          ({ content }) =>
            user.isMinor &&
            (content.ageRating === "18" ||
              content.ageRating === "UNKNOWN"),
        ),
      },
    });
  }
}