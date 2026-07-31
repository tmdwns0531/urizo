import {
  OTT_PROVIDERS,
  type CatalogContent,
  type OttProvider,
} from "./catalog";

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

export const MVP_MOODS = [
  "밝은",
  "따뜻한",
  "감성적인",
  "어두운",
  "긴장감 있는",
  "잔잔한",
  "생각할 거리가 있는",
  "자극적인",
] as const;

export type Mood = (typeof MVP_MOODS)[number];

export const CHOICE_RUNTIME_MINUTES = [30, 60, 120, 180, null] as const;
export type ChoiceRuntimeMinutes = (typeof CHOICE_RUNTIME_MINUTES)[number];
export type EffectiveRuntimeMinutes = ChoiceRuntimeMinutes | 45;

export const NATURAL_LANGUAGE_MAX_CODE_POINTS = 140;

/**
 * Natural-language text is a transient public DTO value. The request parser
 * must enforce NATURAL_LANGUAGE_MAX_CODE_POINTS before creating a search
 * invocation; persistence DTOs deliberately do not reference this alias.
 */
export type NaturalLanguage140 = string;

/**
 * The v0.7 public CHOICE DTO. This name is intentionally distinct from the
 * deprecated RecommendationChoice used by the current Demo.
 */
export interface MvpRecommendationChoice {
  selectedProviders?: OttProvider[];
  companions?: Companion[];
  moods?: Mood[];
  desiredGenres?: string[];
  companionAvoidGenres?: string[];
  maxRuntimeMinutes?: ChoiceRuntimeMinutes;
  originPreference?: OriginPreference;
  naturalLanguage?: string;
  explicitlyRequestedGenres?: string[];
}

export interface MvpRecommendationRequest {
  choice?: MvpRecommendationChoice;
}

export const MVP_DEMO_SCENARIOS = [
  "normal",
  "approval",
  "policy_block",
  "budget_fallback",
] as const;

export type MvpDemoScenario = (typeof MVP_DEMO_SCENARIOS)[number];

export interface MvpDemoRecommendationRequest
  extends MvpRecommendationRequest {
  scenario?: MvpDemoScenario;
}

export interface QueryVectorSnapshot {
  algorithm: "local-hash-cosine-v1";
  version: 1;
  dimensions: 64;
  values: number[];
}

export type InputFingerprint = `sha256:${string}`;

export interface RecommendationSearchContinuation {
  queryVector: QueryVectorSnapshot;
  inputFingerprint: InputFingerprint;
}

/**
 * Persistence-safe CHOICE/search input. It deliberately has no user identity,
 * natural-language text, tokens, or matched terms.
 */
export interface SanitizedRecommendationSearchInput {
  selectedProviders: OttProvider[];
  companions: Companion[];
  moods: Mood[];
  desiredGenres: string[];
  companionAvoidGenres: string[];
  maxRuntimeMinutes: EffectiveRuntimeMinutes;
  originPreference: OriginPreference;
  hasNaturalLanguage: boolean;
}

export interface TransientRecommendationSearchInput
  extends SanitizedRecommendationSearchInput {
  naturalLanguage: NaturalLanguage140;
}

export type RecommendationSearchInvocation =
  | {
      kind: "initial";
      input: TransientRecommendationSearchInput;
    }
  | {
      kind: "continuation";
      input: SanitizedRecommendationSearchInput;
      continuation: RecommendationSearchContinuation;
    };

export interface RecommendationSearchResult {
  content: CatalogContent;
  semanticScore: number;
}

export interface RecommendationSearchOutput {
  results: RecommendationSearchResult[];
  continuation: RecommendationSearchContinuation;
}

export const MVP_NEUTRAL_CHOICE = {
  selectedProviders: [...OTT_PROVIDERS],
  companions: ["ANY"],
  moods: [],
  desiredGenres: [],
  companionAvoidGenres: [],
  maxRuntimeMinutes: null,
  originPreference: "ANY",
  naturalLanguage: "",
  explicitlyRequestedGenres: [],
} as const satisfies Required<MvpRecommendationChoice>;

export const MVP_NEUTRAL_SANITIZED_SEARCH_INPUT = {
  selectedProviders: [...OTT_PROVIDERS],
  companions: ["ANY"],
  moods: [],
  desiredGenres: [],
  companionAvoidGenres: [],
  maxRuntimeMinutes: null,
  originPreference: "ANY",
  hasNaturalLanguage: false,
} as const satisfies SanitizedRecommendationSearchInput;
