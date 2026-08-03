import {
  MEDIA_TYPES,
  OTT_PROVIDERS,
  type CatalogContent,
  type MediaType,
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

/**
 * Request-side media preference. Catalog rows can only be MOVIE or SERIES;
 * ANY is deliberately confined to recommendation input.
 */
export const MEDIA_TYPE_PREFERENCES = [...MEDIA_TYPES, "ANY"] as const;
export type MediaTypePreference = MediaType | "ANY";

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
/**
 * Persisted runtime limit after the bounded Agent has structured a natural
 * language expression. The public CHOICE DTO remains limited to its fixed
 * presets, while natural-language requests may preserve an exact minute value.
 */
export type AgentStructuredRuntimeMinutes = number | null;

/**
 * Maximum Korean viewing rating approved for a child who is watching along.
 * This is a policy threshold, not the child's exact age.
 */
export const CHILD_AGE_RATING_LIMITS = ["ALL", "7", "12", "15"] as const;
export type ChildAgeRatingLimit = (typeof CHILD_AGE_RATING_LIMITS)[number];

export const NATURAL_LANGUAGE_MAX_CODE_POINTS = 140;
export const MVP_GENRE_MAX_ITEMS = 20;
export const MVP_GENRE_MAX_CODE_POINTS = 40;
export const MVP_RECOMMENDATION_REQUEST_MAX_BYTES = 16_384;

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

/** v0.9 bounded-Agent extension of the accepted anonymous CHOICE DTO. */
export interface MvpAgentRecommendationChoice extends MvpRecommendationChoice {
  childAgeRatingLimit?: ChildAgeRatingLimit | null;
  mediaType?: MediaTypePreference;
  naturalRuntimeMinutes?: AgentStructuredRuntimeMinutes;
  requiredGenres?: string[];
  excludedGenres?: string[];
}

export interface MvpRecommendationRequest {
  choice?: MvpAgentRecommendationChoice;
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

export const LOCAL_QUERY_VECTOR_ALGORITHM = "local-hash-cosine-v1";
export const LOCAL_QUERY_VECTOR_DIMENSIONS = 64;
export const OPENAI_QUERY_VECTOR_ALGORITHM =
  "openai-text-embedding-3-small-v1";
export const OPENAI_QUERY_VECTOR_MODEL = "text-embedding-3-small";
export const OPENAI_QUERY_VECTOR_DIMENSIONS = 1536;

export interface LocalQueryVectorSnapshot {
  algorithm: "local-hash-cosine-v1";
  version: 1;
  dimensions: 64;
  values: number[];
}

export interface OpenAiQueryVectorSnapshot {
  algorithm: "openai-text-embedding-3-small-v1";
  version: 1;
  dimensions: 1536;
  values: number[];
}

/**
 * Persistence-safe vector continuation. The algorithm discriminator prevents
 * a local 64-dimensional vector from being sent to pgvector (and vice versa).
 */
export type QueryVectorSnapshot =
  | LocalQueryVectorSnapshot
  | OpenAiQueryVectorSnapshot;

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
  requiredGenres: string[];
  excludedGenres: string[];
  mediaType: MediaTypePreference;
  maxRuntimeMinutes: AgentStructuredRuntimeMinutes;
  childAgeRatingLimit: ChildAgeRatingLimit | null;
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
  modelCallCount: 0 | 1;
  tokenUsage: number;
}

export const MVP_NEUTRAL_CHOICE = {
  selectedProviders: [...OTT_PROVIDERS],
  companions: ["ANY"],
  moods: [],
  desiredGenres: [],
  companionAvoidGenres: [],
  requiredGenres: [],
  excludedGenres: [],
  mediaType: "ANY",
  maxRuntimeMinutes: null,
  naturalRuntimeMinutes: null,
  childAgeRatingLimit: null,
  originPreference: "ANY",
  naturalLanguage: "",
  explicitlyRequestedGenres: [],
} as const satisfies Required<MvpAgentRecommendationChoice>;

export const MVP_NEUTRAL_SANITIZED_SEARCH_INPUT = {
  selectedProviders: [...OTT_PROVIDERS],
  companions: ["ANY"],
  moods: [],
  desiredGenres: [],
  companionAvoidGenres: [],
  requiredGenres: [],
  excludedGenres: [],
  mediaType: "ANY",
  maxRuntimeMinutes: null,
  childAgeRatingLimit: null,
  originPreference: "ANY",
  hasNaturalLanguage: false,
} as const satisfies SanitizedRecommendationSearchInput;
