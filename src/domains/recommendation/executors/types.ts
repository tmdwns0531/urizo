import type {
  BudgetSnapshot,
  FallbackReason,
  MvpRecommendationExecutionResult,
  RuleBasedFallbackInput,
} from "../../../contracts/mvp-recommendation";
import type { RecommendationSearchInvocation } from "../../../contracts/mvp-search";
import type { RecommendationItem } from "../../../contracts/recommendation";
import type { BudgetCounter } from "../budget";

/**
 * @deprecated Compile-only compatibility for the deferred agent extension
 * seam. Active runtime code must use MvpRecommendationExecutionContext.
 */
export interface RecommendationExecutionContext {
  runId: string;
  budget: BudgetCounter;
  readonly [key: string]: unknown;
}

/**
 * @deprecated Compile-only compatibility for the deferred agent extension
 * seam. Active runtime code must use MvpRecommendationExecutionResult.
 */
export interface RecommendationExecutionResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
}

/**
 * @deprecated Compile-only compatibility for the deferred agent extension
 * seam. Active runtime code must use MvpRecommendationExecutor.
 */
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

export type RecommendationSelectionMode = "configured" | "ranked";

export interface MvpRecommendationExecutionContext {
  runId: string;
  searchInvocation: RecommendationSearchInvocation;
  budget: BudgetCounter;
  selectionMode: RecommendationSelectionMode;
}

export interface MvpRecommendationExecutor {
  execute(
    context: MvpRecommendationExecutionContext,
  ): Promise<ExecutionAttempt>;
}
