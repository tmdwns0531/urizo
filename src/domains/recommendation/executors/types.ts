import type { RecommendationItem } from "../../../contracts/recommendation";
import type {
  BudgetSnapshot,
  FallbackReason,
  MvpRecommendationExecutionResult,
  RuleBasedFallbackInput,
} from "../../../contracts/mvp-recommendation";
import type { RecommendationSearchInvocation } from "../../../contracts/mvp-search";
import type { SearchInput } from "../../../contracts/search";
import type { UserContext } from "../../../contracts/user";
import type { BudgetCounter } from "../budget";
import type { ResolvedRecommendationRequest } from "../request";
import type { PublicTraceWriter } from "../trace";

/** @deprecated Use MvpRecommendationExecutionContext. */
export interface RecommendationExecutionContext {
  runId: string;
  user: UserContext;
  request: ResolvedRecommendationRequest;
  searchInput: SearchInput;
  budget: BudgetCounter;
  trace: PublicTraceWriter;
}

/** @deprecated Use MvpRecommendationExecutionResult. */
export interface RecommendationExecutionResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
}

/** @deprecated Use MvpRecommendationExecutor. */
export interface RecommendationExecutor {
  execute(
    context: RecommendationExecutionContext,
  ): Promise<RecommendationExecutionResult>;
}

export type ExecutionAttempt =
  | {
      kind: "success";
      result: MvpRecommendationExecutionResult;
    }
  | {
      kind: "fallback_required";
      reason: FallbackReason;
      budgetSnapshot: BudgetSnapshot;
      durationMs: number;
      fallbackInput: RuleBasedFallbackInput;
    };

export interface MvpRecommendationExecutionContext {
  runId: string;
  searchInvocation: RecommendationSearchInvocation;
  budget: BudgetCounter;
}

export interface MvpRecommendationExecutor {
  execute(
    context: MvpRecommendationExecutionContext,
  ): Promise<ExecutionAttempt>;
}
