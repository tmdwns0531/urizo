import type { RecommendationSelectorAdapter } from "../../../contracts/mvp-ports";
import type {
  ExecutionMode,
  FallbackReason,
  SelectorOutput,
} from "../../../contracts/mvp-recommendation";
import type { RecommendationItem } from "../../../contracts/recommendation";
import type { TransientRecommendationSearchInput } from "../../../contracts/mvp-search";
import {
  RESULT_LIMIT,
  SELECTOR_CANDIDATE_LIMIT,
} from "../../../config/recommendation";
import { BudgetExceededError } from "../budget";
import type {
  ExecutionAttempt,
  MvpRecommendationExecutionContext,
  MvpRecommendationExecutor,
} from "../executors/types";
import { ensureRecommendationReasons } from "../reasons";
import {
  SEARCH_CATALOG_TOOL_NAME,
  type SearchCatalogToolOutput,
} from "../tools/search-catalog-tool";
import type { ToolRegistry } from "../tools/tool-registry";
import {
  applyFamilyClarification,
  createFamilyClarification,
  structureAgentInput,
} from "./conversation";

type ActiveExecutionMode = Exclude<ExecutionMode, "FALLBACK">;

export interface AgentRecommendationExecutorOptions {
  executionMode?: ActiveExecutionMode;
  resultLimit?: number;
  now?: () => number;
}

const SELECTOR_TIMEOUT_ERROR_NAME = "RecommendationSelectorTimeoutError";
const SELECTOR_INVALID_OUTPUT_ERROR_NAME =
  "RecommendationSelectorInvalidOutputError";

class AgentOutputValidationError extends Error {
  constructor() {
    super("The restricted agent output failed validation.");
    this.name = SELECTOR_INVALID_OUTPUT_ERROR_NAME;
  }
}

const normalizeLimit = (limit: number): number =>
  Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

const readErrorName = (error: unknown): string | null =>
  typeof error === "object" &&
  error !== null &&
  typeof (error as { name?: unknown }).name === "string"
    ? (error as { name: string }).name
    : null;

const readErrorTokenUsage = (error: unknown): number => {
  if (
    typeof error !== "object" ||
    error === null ||
    typeof (error as { tokenUsage?: unknown }).tokenUsage !== "number"
  ) {
    return 0;
  }
  const tokenUsage = (error as { tokenUsage: number }).tokenUsage;
  return Number.isFinite(tokenUsage) && tokenUsage > 0
    ? Math.floor(tokenUsage)
    : 0;
};

const toFallbackReason = (error: unknown): FallbackReason => {
  if (error instanceof BudgetExceededError) return "BUDGET_EXCEEDED";
  const name = readErrorName(error);
  if (name === SELECTOR_TIMEOUT_ERROR_NAME) return "MODEL_TIMEOUT";
  if (name === SELECTOR_INVALID_OUTPUT_ERROR_NAME) {
    return "MODEL_INVALID_OUTPUT";
  }
  return "MODEL_ERROR";
};

function consumeSearchModelUsage(
  output: SearchCatalogToolOutput,
  context: MvpRecommendationExecutionContext,
): void {
  if (
    (output.modelCallCount !== 0 && output.modelCallCount !== 1) ||
    !Number.isInteger(output.tokenUsage) ||
    output.tokenUsage < 0 ||
    (output.modelCallCount === 0 && output.tokenUsage !== 0)
  ) {
    throw new AgentOutputValidationError();
  }
  if (output.modelCallCount === 1) {
    context.budget.consumeModel(output.tokenUsage);
  }
}

function validateAgentSelection(
  output: SelectorOutput,
  candidates: readonly RecommendationItem[],
  limit: number,
): void {
  const allowedIds = new Set(candidates.map(({ content }) => content.id));
  if (
    !Number.isInteger(output.tokenUsage) ||
    output.tokenUsage < 0 ||
    !Array.isArray(output.selectedIds) ||
    output.selectedIds.length > limit ||
    (candidates.length > 0 && limit > 0 && output.selectedIds.length === 0) ||
    output.selectedIds.some(
      (id) => typeof id !== "string" || !allowedIds.has(id),
    ) ||
    new Set(output.selectedIds).size !== output.selectedIds.length ||
    (output.topPickReason !== undefined &&
      (typeof output.topPickReason !== "string" ||
        output.topPickReason.trim().length === 0 ||
        output.topPickReason.length > 180))
  ) {
    throw new AgentOutputValidationError();
  }
}

function materializeSelection(
  output: SelectorOutput,
  candidates: readonly RecommendationItem[],
): RecommendationItem[] {
  const byId = new Map(candidates.map((item) => [item.content.id, item]));
  return output.selectedIds.map((id, index) => {
    const item = byId.get(id);
    if (!item) throw new AgentOutputValidationError();
    if (index !== 0) return item;

    return {
      ...item,
      reasons: ensureRecommendationReasons(item.content, [
        ...(output.topPickReason ? [output.topPickReason] : []),
        ...item.reasons,
      ]),
    };
  });
}

/**
 * A bounded state-machine agent: exactly one searchCatalog call, one allowlist
 * selection, and no authority to alter mandatory conditions.
 */
export class AgentRecommendationExecutor implements MvpRecommendationExecutor {
  private readonly executionMode: ActiveExecutionMode;
  private readonly resultLimit: number;
  private readonly now: () => number;

  constructor(
    private readonly selector: RecommendationSelectorAdapter,
    private readonly toolRegistry: ToolRegistry,
    options: AgentRecommendationExecutorOptions = {},
  ) {
    this.executionMode = options.executionMode ?? "DETERMINISTIC";
    this.resultLimit = normalizeLimit(options.resultLimit ?? RESULT_LIMIT);
    this.now = options.now ?? Date.now;
  }

  prepareInitial(input: TransientRecommendationSearchInput) {
    const structuredInput = structureAgentInput(input);
    return {
      input: structuredInput,
      clarification: createFamilyClarification(structuredInput),
    };
  }

  resolveFamilyClarification(
    input: TransientRecommendationSearchInput,
    answer: import("../../../contracts/mvp-recommendation").MvpClarificationAnswer,
  ): TransientRecommendationSearchInput {
    return applyFamilyClarification(input, answer);
  }

  async execute(
    context: MvpRecommendationExecutionContext,
  ): Promise<ExecutionAttempt> {
    const startedAt = this.now();
    const tools = this.toolRegistry.bind(context.budget);
    const searchResult = await tools.execute<SearchCatalogToolOutput>(
      SEARCH_CATALOG_TOOL_NAME,
      { invocation: context.searchInvocation },
    );

    try {
      consumeSearchModelUsage(searchResult, context);
      // 교체용 깊이는 ranked 전체로 남기고, 모델에는 상위 일부만 보낸다.
      const selectorCandidates = searchResult.ranked.slice(
        0,
        SELECTOR_CANDIDATE_LIMIT,
      );
      const selectorOutput =
        context.selectionMode === "ranked"
          ? {
              selectedIds: searchResult.ranked
                .slice(0, this.resultLimit)
                .map(({ content }) => content.id),
              tokenUsage: 0,
            }
          : this.executionMode === "OPENAI"
            ? await context.budget.runModel(
                (signal) =>
                  this.selector.select(
                    selectorCandidates,
                    this.resultLimit,
                    signal,
                  ),
                (output) => output.tokenUsage,
                readErrorTokenUsage,
              )
            : await this.selector.select(
                selectorCandidates,
                this.resultLimit,
              );

      validateAgentSelection(
        selectorOutput,
        searchResult.ranked,
        this.resultLimit,
      );
      context.budget.assertWithinLimits();
      return {
        kind: "success",
        result: {
          ranked: searchResult.ranked,
          selected: materializeSelection(
            selectorOutput,
            searchResult.ranked,
          ),
          excludedContentIds: searchResult.excludedContentIds,
          eligibleCount: searchResult.eligibleCount,
          continuation: searchResult.continuation,
          executionMode: this.executionMode,
          fallbackUsed: false,
          fallbackReason: null,
          budgetSnapshot: context.budget.snapshot(),
          durationMs: Math.max(0, this.now() - startedAt),
        },
      };
    } catch (error) {
      return {
        kind: "fallback_required",
        reason: toFallbackReason(error),
        budgetSnapshot: context.budget.snapshot(),
        durationMs: Math.max(0, this.now() - startedAt),
        fallbackInput: {
          eligibleCatalog: searchResult.eligibleCatalog,
          searchInput: searchResult.searchInput,
          continuation: searchResult.continuation,
          excludedContentIds: searchResult.excludedContentIds,
        },
      };
    }
  }
}
