export interface RecommendationWeights {
  semantic: number;
  mood: number;
  genre: number;
  runtime: number;
  quality: number;
  companion: number;
}

/**
 * v0.5 §8.5 initial weights. Keeping them here, rather than in the scoring
 * implementation, lets the team tune reviewed cases without changing logic.
 */
export const RECOMMENDATION_WEIGHTS = {
  withNaturalLanguage: {
    semantic: 0.3,
    mood: 0.22,
    genre: 0.2,
    runtime: 0.13,
    quality: 0.1,
    companion: 0.05,
  },
  withoutNaturalLanguage: {
    semantic: 0.15,
    mood: 0.29,
    genre: 0.26,
    runtime: 0.15,
    quality: 0.1,
    companion: 0.05,
  },
} as const satisfies Record<string, RecommendationWeights>;

export const DIVERSITY_PENALTY_PER_REPEAT = 0.12;

export const BUDGET_LIMITS = {
  modelCalls: 3,
  toolCalls: 2,
  tokens: 8_000,
  elapsedMs: 25_000,
} as const;

export const RESULT_LIMIT = 5;
export const SEARCH_LIMIT = 30;
