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
  ): Promise<RecommendationSearchOutput>;
}

export interface RecommendationSelectorAdapter {
  select(
    items: RecommendationItem[],
    limit: number,
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

export interface DemoResettable {
  clearForDemo(): Promise<void>;
}
