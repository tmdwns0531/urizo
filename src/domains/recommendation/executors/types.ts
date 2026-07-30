import type { RecommendationItem } from "../../../contracts/recommendation";
import type { SearchInput } from "../../../contracts/search";
import type { UserContext } from "../../../contracts/user";
import type { BudgetCounter } from "../budget";
import type { ResolvedRecommendationRequest } from "../request";
import type { PublicTraceWriter } from "../trace";

export interface RecommendationExecutionContext {
  runId: string;
  user: UserContext;
  request: ResolvedRecommendationRequest;
  searchInput: SearchInput;
  budget: BudgetCounter;
  trace: PublicTraceWriter;
}

export interface RecommendationExecutionResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
}

export interface RecommendationExecutor {
  execute(
    context: RecommendationExecutionContext,
  ): Promise<RecommendationExecutionResult>;
}
