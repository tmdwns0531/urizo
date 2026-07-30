import type {
  RecommendationExecutionContext,
  RecommendationExecutionResult,
  RecommendationExecutor,
} from "../executors/types";
import type {
  ToolFacade,
  ToolRegistry,
} from "../tools/tool-registry";

export type AgentPlanningContext = Readonly<
  Omit<RecommendationExecutionContext, "budget">
>;

export interface AgentPlanner {
  plan(
    context: AgentPlanningContext,
    tools: ToolFacade,
  ): Promise<RecommendationExecutionResult>;
}

/**
 * Extension seam only. A future planner receives a read-only, budget-bound
 * tool facade. It cannot register tools or access the raw BudgetCounter, while
 * PolicyLayer still enforces approval, fallback, final policy, and tracing.
 */
export class AgentRecommendationExecutor
  implements RecommendationExecutor
{
  constructor(
    private readonly planner: AgentPlanner,
    private readonly tools: ToolRegistry,
  ) {}

  execute(
    context: RecommendationExecutionContext,
  ): Promise<RecommendationExecutionResult> {
    const { budget, ...planningContext } = context;
    return this.planner.plan(
      Object.freeze(planningContext),
      this.tools.bind(budget),
    );
  }
}