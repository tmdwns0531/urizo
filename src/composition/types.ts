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
import type { RecommendationServices } from "../domains/recommendation/orchestrator";

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

export type AdapterOverrides = Partial<AdapterSet>;

export interface Composition {
  adapters: AdapterSet;
  services: RecommendationServices;
}
