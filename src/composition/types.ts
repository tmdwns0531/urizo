import type {
  AuthAdapter,
  CatalogRepository,
  EngagementRepository,
  ProfileRepository,
  RunRepository,
  SearchAdapter,
  SelectorAdapter,
  TraceRepository,
} from "../contracts/ports";
import type {
  AgentTraceRepository,
  RecommendationRunRepository,
  RecommendationSearchAdapter,
  RecommendationSelectorAdapter,
} from "../contracts/mvp-ports";
import type { AnonymousRecommendationServices } from "../contracts/mvp-recommendation";
import type { RecommendationServices } from "../domains/recommendation/orchestrator";

/** @deprecated Use MvpAdapterSet for new anonymous MVP code. */
export interface AdapterSet {
  auth: AuthAdapter;
  catalog: CatalogRepository;
  search: SearchAdapter;
  selector: SelectorAdapter;
  runs: RunRepository;
  traces: TraceRepository;
  engagements: EngagementRepository;
  profiles: ProfileRepository;
}

/** @deprecated Use Partial<MvpAdapterSet> where an override is needed. */
export type AdapterOverrides = Partial<AdapterSet>;

/** @deprecated Use MvpComposition for new anonymous MVP code. */
export interface Composition {
  adapters: AdapterSet;
  services: RecommendationServices;
}

export interface MvpAdapterSet {
  catalog: CatalogRepository;
  search: RecommendationSearchAdapter;
  selector: RecommendationSelectorAdapter;
  runs: RecommendationRunRepository;
  traces: AgentTraceRepository;
}

export interface MvpComposition {
  adapters: MvpAdapterSet;
  services: AnonymousRecommendationServices;
}
