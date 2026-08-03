import type {
  RecommendationSearchAdapter,
  RecommendationSelectorAdapter,
} from "../../../contracts/mvp-ports";
import type {
  ExecutionMode,
  FallbackReason,
  RuleBasedFallbackInput,
  SelectorOutput,
} from "../../../contracts/mvp-recommendation";
import type {
  RecommendationSearchContinuation,
  RecommendationSearchOutput,
  SanitizedRecommendationSearchInput,
} from "../../../contracts/mvp-search";
import type { CatalogRepository } from "../../../contracts/ports";
import type { RecommendationItem } from "../../../contracts/recommendation";
import { RESULT_LIMIT } from "../../../config/recommendation";
import { filterMvpCatalog } from "../../catalog/filtering";
import {
  BudgetExceededError,
} from "../budget";
import { ensureRecommendationReasons } from "../reasons";
import { scoreMvpSearchResults } from "../scoring";
import type {
  ExecutionAttempt,
  MvpRecommendationExecutionContext,
  MvpRecommendationExecutor,
} from "./types";

type ActiveExecutionMode = Exclude<ExecutionMode, "FALLBACK">;

export interface PipelineRecommendationExecutorOptions {
  executionMode?: ActiveExecutionMode;
  resultLimit?: number;
  now?: () => number;
}

const SELECTOR_TIMEOUT_ERROR_NAME =
  "RecommendationSelectorTimeoutError";
const SELECTOR_INVALID_OUTPUT_ERROR_NAME =
  "RecommendationSelectorInvalidOutputError";

class SelectorOutputValidationError extends Error {
  constructor() {
    super("The recommendation selector output failed validation.");
    this.name = SELECTOR_INVALID_OUTPUT_ERROR_NAME;
  }
}

const normalizeLimit = (limit: number): number =>
  Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

const sanitizeSearchInput = (
  input: MvpRecommendationExecutionContext["searchInvocation"]["input"],
): SanitizedRecommendationSearchInput => ({
  selectedProviders: [...input.selectedProviders],
  companions: [...input.companions],
  moods: [...input.moods],
  desiredGenres: [...input.desiredGenres],
  companionAvoidGenres: [...input.companionAvoidGenres],
  requiredGenres: [...(input.requiredGenres ?? [])],
  excludedGenres: [...(input.excludedGenres ?? [])],
  mediaType: input.mediaType ?? "ANY",
  maxRuntimeMinutes: input.maxRuntimeMinutes,
  childAgeRatingLimit: input.childAgeRatingLimit ?? null,
  originPreference: input.originPreference,
  hasNaturalLanguage: input.hasNaturalLanguage,
});

const uniqueItems = (
  items: readonly RecommendationItem[],
): RecommendationItem[] => [
  ...new Map(items.map((item) => [item.content.id, item])).values(),
];

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
  if (error instanceof BudgetExceededError) {
    return "BUDGET_EXCEEDED";
  }

  const name = readErrorName(error);
  if (name === SELECTOR_TIMEOUT_ERROR_NAME) {
    return "MODEL_TIMEOUT";
  }
  if (name === SELECTOR_INVALID_OUTPUT_ERROR_NAME) {
    return "MODEL_INVALID_OUTPUT";
  }
  return "MODEL_ERROR";
};

function consumeSearchModelUsage(
  output: RecommendationSearchOutput,
  context: MvpRecommendationExecutionContext,
): void {
  if (
    (output.modelCallCount !== 0 && output.modelCallCount !== 1) ||
    !Number.isInteger(output.tokenUsage) ||
    output.tokenUsage < 0 ||
    (output.modelCallCount === 0 && output.tokenUsage !== 0)
  ) {
    throw new Error("Recommendation search model usage is malformed.");
  }
  if (output.modelCallCount === 1) {
    context.budget.consumeModel(output.tokenUsage);
  }
}

function validateSelectorOutput(
  output: SelectorOutput,
  candidates: readonly RecommendationItem[],
  limit: number,
): void {
  if (
    !Number.isFinite(output.tokenUsage) ||
    output.tokenUsage < 0 ||
    !Number.isInteger(output.tokenUsage)
  ) {
    throw new SelectorOutputValidationError();
  }

  const allowedIds = new Set(
    candidates.map(({ content }) => content.id),
  );
  if (
    !Array.isArray(output.selectedIds) ||
    output.selectedIds.length > limit ||
    (candidates.length > 0 &&
      limit > 0 &&
      output.selectedIds.length === 0) ||
    output.selectedIds.some(
      (id) => typeof id !== "string" || !allowedIds.has(id),
    ) ||
    new Set(output.selectedIds).size !== output.selectedIds.length
  ) {
    throw new SelectorOutputValidationError();
  }

  if (
    output.topPickReason !== undefined &&
    (typeof output.topPickReason !== "string" ||
      output.topPickReason.trim().length === 0 ||
      output.topPickReason.length > 180)
  ) {
    throw new SelectorOutputValidationError();
  }
}

function selectItems(
  output: SelectorOutput,
  candidates: readonly RecommendationItem[],
): RecommendationItem[] {
  const byId = new Map(
    candidates.map((item) => [item.content.id, item]),
  );
  return output.selectedIds.map((id, index) => {
    const item = byId.get(id);
    if (!item) {
      throw new SelectorOutputValidationError();
    }
    if (index !== 0) {
      return item;
    }

    const openAiReasons =
      output.topPickReason === undefined
        ? []
        : [output.topPickReason];
    return {
      ...item,
      reasons: ensureRecommendationReasons(item.content, [
        ...openAiReasons,
        ...item.reasons,
      ]),
    };
  });
}

function createFallbackAttempt(
  reason: FallbackReason,
  context: MvpRecommendationExecutionContext,
  startedAt: number,
  now: () => number,
  eligibleCatalog: RuleBasedFallbackInput["eligibleCatalog"],
  searchInput: SanitizedRecommendationSearchInput,
  continuation: RecommendationSearchContinuation,
  excludedContentIds: string[],
): ExecutionAttempt {
  return {
    kind: "fallback_required",
    reason,
    budgetSnapshot: context.budget.snapshot(),
    durationMs: Math.max(0, now() - startedAt),
    fallbackInput: {
      eligibleCatalog: [...eligibleCatalog],
      searchInput,
      continuation,
      excludedContentIds: [...excludedContentIds],
    },
  };
}

export class PipelineRecommendationExecutor
  implements MvpRecommendationExecutor
{
  private readonly executionMode: ActiveExecutionMode;
  private readonly resultLimit: number;
  private readonly now: () => number;

  constructor(
    private readonly catalog: CatalogRepository,
    private readonly search: RecommendationSearchAdapter,
    private readonly selector: RecommendationSelectorAdapter,
    options: PipelineRecommendationExecutorOptions = {},
  ) {
    this.executionMode = options.executionMode ?? "DETERMINISTIC";
    this.resultLimit = normalizeLimit(
      options.resultLimit ?? RESULT_LIMIT,
    );
    this.now = options.now ?? Date.now;
  }

  async execute(
    context: MvpRecommendationExecutionContext,
  ): Promise<ExecutionAttempt> {
    const startedAt = this.now();
    const searchInput = sanitizeSearchInput(
      context.searchInvocation.input,
    );

    const allContents = await context.budget.runTool(() =>
      this.catalog.list(),
    );
    const filtered = filterMvpCatalog(allContents, searchInput);
    const excludedContentIds = filtered.excluded.map(
      ({ content }) => content.id,
    );

    const searchOutput = await context.budget.runTool((signal) =>
      this.search.search(
        context.searchInvocation,
        filtered.eligible,
        signal,
      ),
    );
    const ranked = uniqueItems(
      scoreMvpSearchResults(searchOutput.results, searchInput),
    );

    try {
      consumeSearchModelUsage(searchOutput, context);
      const selectorOutput =
        context.selectionMode === "ranked"
          ? {
              selectedIds: ranked
                .slice(0, this.resultLimit)
                .map(({ content }) => content.id),
              tokenUsage: 0,
            }
          : this.executionMode === "OPENAI"
            ? await context.budget.runModel(
                (signal) =>
                  this.selector.select(
                    ranked,
                    this.resultLimit,
                    signal,
                  ),
                (output) => output.tokenUsage,
                readErrorTokenUsage,
              )
            : await this.selector.select(ranked, this.resultLimit);

      validateSelectorOutput(
        selectorOutput,
        ranked,
        this.resultLimit,
      );
      context.budget.assertWithinLimits();

      const durationMs = Math.max(0, this.now() - startedAt);
      return {
        kind: "success",
        result: {
          ranked,
          selected: selectItems(selectorOutput, ranked),
          excludedContentIds,
          eligibleCount: filtered.eligible.length,
          continuation: searchOutput.continuation,
          executionMode: this.executionMode,
          fallbackUsed: false,
          fallbackReason: null,
          budgetSnapshot: context.budget.snapshot(),
          durationMs,
        },
      };
    } catch (error) {
      return createFallbackAttempt(
        toFallbackReason(error),
        context,
        startedAt,
        this.now,
        filtered.eligible,
        searchInput,
        searchOutput.continuation,
        excludedContentIds,
      );
    }
  }
}
