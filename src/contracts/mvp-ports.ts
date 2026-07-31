import type { CatalogContent } from "./catalog";
import type { RecommendationItem } from "./recommendation";
import type {
  NewTraceEvent,
  RunUpdateResult,
  SelectorOutput,
  StoredRecommendationRun,
  StoredRecommendationRunPatch,
  StoredTraceEvent,
} from "./mvp-recommendation";
import type {
  RecommendationSearchInvocation,
  RecommendationSearchOutput,
} from "./mvp-search";

export interface RecommendationSearchAdapter {
  search(
    invocation: RecommendationSearchInvocation,
    candidates: CatalogContent[],
    signal?: AbortSignal,
  ): Promise<RecommendationSearchOutput>;
}

export interface RecommendationSelectorAdapter {
  select(
    items: RecommendationItem[],
    limit: number,
    signal?: AbortSignal,
  ): Promise<SelectorOutput>;
}

export interface RecommendationRunRepository {
  create(run: StoredRecommendationRun): Promise<void>;
  get(runId: string): Promise<StoredRecommendationRun | null>;
  update(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
  ): Promise<RunUpdateResult>;
}

export interface AgentTraceRepository {
  append(
    runId: string,
    event: NewTraceEvent,
  ): Promise<StoredTraceEvent>;
  listStored(runId: string): Promise<StoredTraceEvent[]>;
}

/**
 * Atomic state/Trace boundary. Production adapters must commit the Run CAS and
 * its complete Trace batch in one transaction (or not commit either).
 */
export interface RecommendationPersistenceUnitOfWork {
  createRunWithTraceEvents(
    run: StoredRecommendationRun,
    events: readonly NewTraceEvent[],
  ): Promise<void>;
  updateRunWithTraceEvents(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
    events: readonly NewTraceEvent[],
  ): Promise<RunUpdateResult>;
}

export interface DemoResettable {
  clearForDemo(): Promise<void>;
}
