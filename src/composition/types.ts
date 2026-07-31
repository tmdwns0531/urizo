import type {
  AgentTraceRepository,
  RecommendationPersistenceUnitOfWork,
  RecommendationRunRepository,
  RecommendationSearchAdapter,
  RecommendationSelectorAdapter,
} from "../contracts/mvp-ports";
import type { AnonymousRecommendationServices } from "../contracts/mvp-recommendation";
import type { CatalogRepository } from "../contracts/ports";

export interface MvpAdapterSet {
  catalog: CatalogRepository;
  search: RecommendationSearchAdapter;
  selector: RecommendationSelectorAdapter;
  runs: RecommendationRunRepository;
  traces: AgentTraceRepository;
}

export type MvpAdapterOverrides = Partial<MvpAdapterSet> & {
  persistence?: RecommendationPersistenceUnitOfWork;
};

export interface MvpComposition {
  adapters: MvpAdapterSet;
  services: AnonymousRecommendationServices;
  dispose(): Promise<void>;
}