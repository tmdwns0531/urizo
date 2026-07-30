import type { CatalogContent } from "./catalog";
import type { UserContext } from "./user";

export const COMPANIONS = [
  "ALONE",
  "PARTNER",
  "FRIENDS",
  "FAMILY",
  "WITH_CHILDREN",
  "ANY",
] as const;
export type Companion = (typeof COMPANIONS)[number];

export const ORIGIN_PREFERENCES = ["KR", "NON_KR", "ANY"] as const;
export type OriginPreference = (typeof ORIGIN_PREFERENCES)[number];

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

export interface SearchResult {
  content: CatalogContent;
  semanticScore: number;
  matchedTerms: string[];
}
