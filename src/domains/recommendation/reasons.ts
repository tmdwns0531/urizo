import type { CatalogContent } from "../../contracts/catalog";

export const MIN_RECOMMENDATION_REASON_COUNT = 2;
export const MAX_RECOMMENDATION_REASON_COUNT = 3;

export function mergeRecommendationReasons(
  ...reasonGroups: readonly (readonly string[])[]
): string[] {
  const merged: string[] = [];

  for (const reason of reasonGroups.flat()) {
    const normalized = reason.trim();
    if (normalized.length > 0 && !merged.includes(normalized)) {
      merged.push(normalized);
    }
  }

  return merged.slice(0, MAX_RECOMMENDATION_REASON_COUNT);
}

/**
 * Recommendation reasons must stay grounded in catalog facts even when the
 * request has no mood, genre, or runtime preference. These deterministic
 * facts fill only the missing slots and never replace stronger match reasons.
 */
export function ensureRecommendationReasons(
  content: CatalogContent,
  reasons: readonly string[],
): string[] {
  const genre = content.genres.find((value) => value.trim().length > 0);
  const factualFallbacks = [
    ...(genre ? [`${genre} 장르의 작품이에요.`] : []),
    `러닝타임은 ${content.runtimeMinutes}분이에요.`,
    `평점 ${content.voteAverage.toFixed(1)}점, 평가 ${content.voteCount.toLocaleString("ko-KR")}개의 작품이에요.`,
  ];

  const merged = mergeRecommendationReasons(reasons, factualFallbacks);
  if (merged.length < MIN_RECOMMENDATION_REASON_COUNT) {
    throw new Error("Recommendation reasons could not be guaranteed.");
  }
  return merged;
}
