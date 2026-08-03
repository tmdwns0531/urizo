import type {
  RecommendationItem,
  ScoreBreakdown,
} from "../../contracts/recommendation";
import type {
  RecommendationSearchResult,
  SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";
import type { SearchInput, SearchResult } from "../../contracts/search";
import {
  DIVERSITY_PENALTY_PER_REPEAT,
  RECOMMENDATION_WEIGHTS,
  type RecommendationWeights,
} from "../../config/recommendation";
import { ensureRecommendationReasons } from "./reasons";

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

const hasTasteSignals = (input: SanitizedRecommendationSearchInput): boolean =>
  input.moods.length > 0 ||
  input.desiredGenres.length > 0 ||
  input.hasNaturalLanguage ||
  input.originPreference !== "ANY" ||
  input.companions.some((companion) => companion !== "ANY");

const matchRatio = (
  actual: readonly string[],
  desired: readonly string[],
  emptyScore: number,
): number => {
  if (desired.length === 0) {
    return emptyScore;
  }
  const matches = desired.filter((item) => actual.includes(item)).length;
  return clamp(matches / desired.length);
};

interface ScorableSearchResult {
  content: RecommendationSearchResult["content"];
  semanticScore: number;
}

const qualityRaw = (result: ScorableSearchResult): number =>
  result.content.voteAverage * Math.log1p(result.content.voteCount);

/**
 * Candidate-relative min-max normalization keeps the unbounded
 * `rating × log1p(voteCount)` quality signal in [0, 1]. If every candidate has
 * the same value, each receives the neutral 0.5 rather than dividing by zero.
 */
function normalizeQuality(
  results: readonly ScorableSearchResult[],
): Map<string, number> {
  const rawValues = results.map(qualityRaw);
  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const range = max - min;
  return new Map(
    results.map((result, index) => [
      result.content.id,
      range === 0 ? 0.5 : clamp((rawValues[index] - min) / range),
    ]),
  );
}

function withoutGenreWeight(
  weights: RecommendationWeights,
): RecommendationWeights {
  const remaining = 1 - weights.genre;
  return {
    semantic: weights.semantic / remaining,
    mood: weights.mood / remaining,
    genre: 0,
    runtime: weights.runtime / remaining,
    quality: weights.quality / remaining,
    companion: weights.companion / remaining,
  };
}

function applyDiversityPenalty(
  initial: RecommendationItem[],
): RecommendationItem[] {
  initial.sort(
    (left, right) =>
      right.score - left.score ||
      left.content.title.localeCompare(right.content.title, "ko"),
  );

  const collectionOccurrences = new Map<string, number>();
  const diversified = initial.map((item): RecommendationItem => {
    const collectionId = item.content.collectionId;
    if (!collectionId) {
      return item;
    }
    const occurrence = collectionOccurrences.get(collectionId) ?? 0;
    collectionOccurrences.set(collectionId, occurrence + 1);
    const diversityPenalty = occurrence * DIVERSITY_PENALTY_PER_REPEAT;
    const total = clamp(item.score - diversityPenalty);
    return {
      ...item,
      score: total,
      matchPercent:
        item.matchPercent === null ? null : Math.round(total * 100),
      scoreBreakdown: {
        ...item.scoreBreakdown,
        diversityPenalty,
        total,
      },
    };
  });

  return diversified.sort(
    (left, right) =>
      right.score - left.score ||
      left.content.title.localeCompare(right.content.title, "ko"),
  );
}

function buildMvpReasons(
  result: RecommendationSearchResult,
  input: SanitizedRecommendationSearchInput,
  breakdown: ScoreBreakdown,
): string[] {
  const reasons: string[] = [];
  const content = result.content;
  const provider = content.providers.find(({ provider: name }) =>
    input.selectedProviders.includes(name),
  );
  if (provider) {
    reasons.push(`${provider.provider}에서 바로 찾아볼 수 있어요`);
  }

  const matchedMood = input.moods.find((mood) =>
    content.moodTags.includes(mood),
  );
  if (matchedMood) {
    reasons.push(`선택한 ‘${matchedMood}’ 분위기와 잘 맞아요`);
  } else {
    const matchedGenre = input.desiredGenres.find((genre) =>
      content.genres.includes(genre),
    );
    if (matchedGenre) {
      reasons.push(`선택한 ${matchedGenre} 장르예요`);
    }
  }

  if (
    input.maxRuntimeMinutes !== null &&
    content.runtimeMinutes <= input.maxRuntimeMinutes
  ) {
    reasons.push(
      `${content.runtimeMinutes}분으로 선택한 시간 안에 볼 수 있어요`,
    );
  } else if (breakdown.quality >= 0.72) {
    reasons.push("평점과 평가 수를 함께 본 작품 품질이 높아요");
  }

  return ensureRecommendationReasons(content, reasons);
}

/**
 * Active anonymous scoring has no UserContext. When no positive genre was
 * selected, the genre component is removed and all remaining weights are
 * proportionally renormalized to sum to one.
 */
export function scoreMvpSearchResults(
  results: readonly RecommendationSearchResult[],
  input: SanitizedRecommendationSearchInput,
): RecommendationItem[] {
  if (results.length === 0) {
    return [];
  }

  const configuredWeights = input.hasNaturalLanguage
    ? RECOMMENDATION_WEIGHTS.withNaturalLanguage
    : RECOMMENDATION_WEIGHTS.withoutNaturalLanguage;
  const weights =
    input.desiredGenres.length === 0
      ? withoutGenreWeight(configuredWeights)
      : configuredWeights;
  const qualityScores = normalizeQuality(results);
  const showMatchPercent = hasTasteSignals(input);

  const initial = results.map((result): RecommendationItem => {
    const content = result.content;
    const semantic = clamp(result.semanticScore);
    const mood = matchRatio(content.moodTags, input.moods, 0.5);
    const genre =
      input.desiredGenres.length === 0
        ? 0
        : matchRatio(content.genres, input.desiredGenres, 0);
    const runtime =
      input.maxRuntimeMinutes === null
        ? 0.7
        : clamp(0.5 + content.runtimeMinutes / input.maxRuntimeMinutes / 2);
    const quality = qualityScores.get(content.id) ?? 0.5;
    const companions = input.companions.filter((item) => item !== "ANY");
    const companion = matchRatio(content.companionTags, companions, 0.7);
    const total =
      semantic * weights.semantic +
      mood * weights.mood +
      genre * weights.genre +
      runtime * weights.runtime +
      quality * weights.quality +
      companion * weights.companion;
    const scoreBreakdown: ScoreBreakdown = {
      semantic,
      mood,
      genre,
      runtime,
      quality,
      companion,
      diversityPenalty: 0,
      total: clamp(total),
    };

    return {
      content,
      score: scoreBreakdown.total,
      matchPercent: showMatchPercent
        ? Math.round(scoreBreakdown.total * 100)
        : null,
      scoreBreakdown,
      reasons: buildMvpReasons(result, input, scoreBreakdown),
    };
  });

  return applyDiversityPenalty(initial);
}

function buildReasons(
  result: SearchResult,
  input: SearchInput,
  breakdown: ScoreBreakdown,
): string[] {
  const reasons: string[] = [];
  const content = result.content;
  const provider = content.providers.find(({ provider: name }) =>
    input.user.subscribedProviders.includes(name),
  ) ?? content.providers[0];
  if (provider) {
    reasons.push(`${provider.provider}에서 바로 찾아볼 수 있어요`);
  }

  const matchedMood = input.moods.find((mood) =>
    content.moodTags.includes(mood),
  );
  if (matchedMood) {
    reasons.push(`선택한 ‘${matchedMood}’ 분위기와 잘 맞아요`);
  } else {
    const matchedGenre = [
      ...input.desiredGenres,
      ...input.user.preferredGenres,
    ].find((genre) => content.genres.includes(genre));
    if (matchedGenre) {
      reasons.push(`선호하는 ${matchedGenre} 장르예요`);
    }
  }

  if (
    input.maxRuntimeMinutes !== null &&
    content.runtimeMinutes <= input.maxRuntimeMinutes
  ) {
    reasons.push(
      `${content.runtimeMinutes}분으로 선택한 시간 안에 볼 수 있어요`,
    );
  } else if (breakdown.quality >= 0.72) {
    reasons.push("평점과 평가 수를 함께 본 작품 품질이 높아요");
  }

  return ensureRecommendationReasons(content, reasons);
}

/** @deprecated Use scoreMvpSearchResults for anonymous MVP code. */
export function scoreSearchResults(
  results: readonly SearchResult[],
  input: SearchInput,
): RecommendationItem[] {
  if (results.length === 0) {
    return [];
  }

  const weights = input.naturalLanguage.trim()
    ? RECOMMENDATION_WEIGHTS.withNaturalLanguage
    : RECOMMENDATION_WEIGHTS.withoutNaturalLanguage;
  const qualityScores = normalizeQuality(results);
  const preferredGenres = [
    ...new Set([...input.desiredGenres, ...input.user.preferredGenres]),
  ];

  const initial = results.map((result): RecommendationItem => {
    const content = result.content;
    const semantic = clamp(result.semanticScore);
    const mood = matchRatio(content.moodTags, input.moods, 0.5);
    const genre = matchRatio(content.genres, preferredGenres, 0.45);
    const runtime =
      input.maxRuntimeMinutes === null
        ? 0.7
        : clamp(0.5 + content.runtimeMinutes / input.maxRuntimeMinutes / 2);
    const quality = qualityScores.get(content.id) ?? 0.5;
    const companions = input.companions.filter((item) => item !== "ANY");
    const companion = matchRatio(content.companionTags, companions, 0.7);
    const total =
      semantic * weights.semantic +
      mood * weights.mood +
      genre * weights.genre +
      runtime * weights.runtime +
      quality * weights.quality +
      companion * weights.companion;
    const scoreBreakdown: ScoreBreakdown = {
      semantic,
      mood,
      genre,
      runtime,
      quality,
      companion,
      diversityPenalty: 0,
      total: clamp(total),
    };

    return {
      content,
      score: scoreBreakdown.total,
      matchPercent: Math.round(scoreBreakdown.total * 100),
      scoreBreakdown,
      reasons: buildReasons(result, input, scoreBreakdown),
    };
  });

  return applyDiversityPenalty(initial);
}
