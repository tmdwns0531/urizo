import type { CatalogContent } from "./catalog";
import type {
  EngagementEvent,
  EngagementEventInput,
} from "./engagement";
import type {
  RecommendationItem,
  RecommendationRun,
} from "./recommendation";
import type { SearchInput, SearchResult } from "./search";
import type { UserContext, UserProfilePatch } from "./user";

export interface AuthAdapter {
  getUser(userId?: string): Promise<UserContext>;
}

export interface CatalogRepository {
  list(): Promise<CatalogContent[]>;
  getById(contentId: string): Promise<CatalogContent | null>;
}

export interface SearchAdapter {
  search(
    input: SearchInput,
    candidates: CatalogContent[],
  ): Promise<SearchResult[]>;
}

export interface SelectorAdapter {
  select(items: RecommendationItem[], limit: number): RecommendationItem[];
}

export interface RunRepository {
  save(run: RecommendationRun): Promise<void>;
  get(runId: string): Promise<RecommendationRun | null>;
  list(userId?: string): Promise<RecommendationRun[]>;
  clear(): Promise<void>;
}

export interface TraceRepository {
  append(runId: string, event: Omit<import("./recommendation").PublicTraceEvent, "id">): Promise<import("./recommendation").PublicTraceEvent>;
  list(runId: string): Promise<import("./recommendation").PublicTraceEvent[]>;
  clear(): Promise<void>;
}

export interface EngagementRepository {
  record(input: EngagementEventInput): Promise<EngagementEvent>;
  list(userId?: string): Promise<EngagementEvent[]>;
  clear(): Promise<void>;
}

export interface ProfileRepository {
  get(userId: string): Promise<UserContext | null>;
  save(profile: UserContext): Promise<UserContext>;
  update(userId: string, patch: UserProfilePatch): Promise<UserContext>;
  clear(): Promise<void>;
}
