import type { CatalogContent } from "./catalog";
import type {
  Companion,
  OriginPreference,
} from "./mvp-search";
import type { UserContext } from "./user";

/** @deprecated Import from "./mvp-search" in new anonymous-MVP code. */
export { COMPANIONS, ORIGIN_PREFERENCES } from "./mvp-search";
/** @deprecated Import from "./mvp-search" in new anonymous-MVP code. */
export type { Companion, OriginPreference } from "./mvp-search";

/** @deprecated Use SanitizedRecommendationSearchInput from "./mvp-search". */
export interface SearchInput {
  user: UserContext;
  companions: Companion[];
  moods: string[];
  desiredGenres: string[];
  companionAvoidGenres: string[];
  maxRuntimeMinutes: number | null;
  originPreference: OriginPreference;
  naturalLanguage: string;
  explicitlyRequestedGenres: string[];
}

/** @deprecated Use RecommendationSearchResult from "./mvp-search". */
export interface SearchResult {
  content: CatalogContent;
  semanticScore: number;
  matchedTerms: string[];
}
