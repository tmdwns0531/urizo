import type { CatalogContent } from "../../contracts/catalog";
import type {
  BudgetSnapshot,
  FallbackReason,
  MvpRecommendationExecutionResult,
  RuleBasedFallbackInput,
  RuleBasedFallbackResult,
} from "../../contracts/mvp-recommendation";
import type {
  SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";
import type {
  RecommendationItem,
  ScoreBreakdown,
} from "../../contracts/recommendation";
import { RESULT_LIMIT } from "../../config/recommendation";
import { filterMvpCatalog } from "../catalog/filtering";
import type { ExecutionAttempt } from "./executors/types";

const clamp = (value: number): number =>
  Math.max(0, Math.min(1, value));

const matchRatio = (
  actual: readonly string[],
  desired: readonly string[],
  emptyScore: number,
): number => {
  if (desired.length === 0) {
    return emptyScore;
  }
  const matches = desired.filter((item) =>
    actual.includes(item),
  ).length;
  return clamp(matches / desired.length);
};

const qualityRaw = (content: CatalogContent): number =>
  content.voteAverage * Math.log1p(content.voteCount);

function normalizeQuality(
  contents: readonly CatalogContent[],
): Map<string, number> {
  if (contents.length === 0) {
    return new Map();
  }

  const values = contents.map(qualityRaw);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return new Map(
    contents.map((content, index) => [
      content.id,
      range === 0 ? 0.5 : clamp((values[index] - min) / range),
    ]),
  );
}

function buildReasons(
  content: CatalogContent,
  input: SanitizedRecommendationSearchInput,
  quality: number,
): string[] {
  const reasons: string[] = [];
  const provider = content.providers.find(({ provider: name }) =>
    input.selectedProviders.includes(name),
  );
  if (provider) {
    reasons.push(`${provider.provider}에서 시청할 수 있어요.`);
  }

  const mood = input.moods.find((value) =>
    content.moodTags.includes(value),
  );
  if (mood) {
    reasons.push(`선택한 ${mood} 분위기와 잘 맞아요.`);
  } else {
    const genre = input.desiredGenres.find((value) =>
      content.genres.includes(value),
    );
    if (genre) {
      reasons.push(`선택한 ${genre} 장르에 해당해요.`);
    }
  }

  if (
    input.maxRuntimeMinutes !== null &&
    content.runtimeMinutes <= input.maxRuntimeMinutes
  ) {
    reasons.push(
      `${content.runtimeMinutes}분으로 선택한 시간 안에 볼 수 있어요.`,
    );
  } else if (quality >= 0.7) {
    reasons.push("평점과 평가 수를 함께 본 작품 기대치가 높아요.");
  }

  return reasons.slice(0, 3);
}

function scoreEligibleCatalog(
  contents: readonly CatalogContent[],
  input: SanitizedRecommendationSearchInput,
): RecommendationItem[] {
  const qualityScores = normalizeQuality(contents);
  const companions = input.companions.filter(
    (companion) => companion !== "ANY",
  );

  const scored = contents.map((content): RecommendationItem => {
    const mood = matchRatio(content.moodTags, input.moods, 0.5);
    const genre = matchRatio(
      content.genres,
      input.desiredGenres,
      0.5,
    );
    const companion = matchRatio(
      content.companionTags,
      companions,
      0.7,
    );
    const quality = qualityScores.get(content.id) ?? 0.5;
    const runtime =
      input.maxRuntimeMinutes === null
        ? 0.7
        : clamp(
            0.5 +
              content.runtimeMinutes /
                input.maxRuntimeMinutes /
                2,
          );
    const total = clamp(
      mood * 0.25 +
        genre * 0.25 +
        companion * 0.1 +
        quality * 0.25 +
        runtime * 0.15,
    );
    const scoreBreakdown: ScoreBreakdown = {
      semantic: 0,
      mood,
      genre,
      runtime,
      quality,
      companion,
      diversityPenalty: 0,
      total,
    };

    return {
      content,
      score: total,
      matchPercent: Math.round(total * 100),
      scoreBreakdown,
      reasons: buildReasons(content, input, quality),
    };
  });

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      left.content.title.localeCompare(
        right.content.title,
        "ko",
      ) ||
      left.content.id.localeCompare(right.content.id),
  );

  const collectionOccurrences = new Map<string, number>();
  const diversified = scored.map((item): RecommendationItem => {
    const collectionId = item.content.collectionId;
    if (!collectionId) {
      return item;
    }
    const occurrence =
      collectionOccurrences.get(collectionId) ?? 0;
    collectionOccurrences.set(collectionId, occurrence + 1);
    const diversityPenalty = occurrence * 0.12;
    const total = clamp(item.score - diversityPenalty);
    return {
      ...item,
      score: total,
      matchPercent: Math.round(total * 100),
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
      left.content.title.localeCompare(
        right.content.title,
        "ko",
      ) ||
      left.content.id.localeCompare(right.content.id),
  );
}

export function ruleBasedFallback(
  input: RuleBasedFallbackInput,
): RuleBasedFallbackResult {
  const uniqueEligibleCatalog = [
    ...new Map(
      input.eligibleCatalog.map((content) => [content.id, content]),
    ).values(),
  ];
  const rechecked = filterMvpCatalog(
    uniqueEligibleCatalog,
    input.searchInput,
  );
  const ranked = scoreEligibleCatalog(
    rechecked.eligible,
    input.searchInput,
  );
  const excludedContentIds = [
    ...new Set([
      ...input.excludedContentIds,
      ...rechecked.excluded.map(({ content }) => content.id),
    ]),
  ];

  return {
    ranked,
    selected: ranked.slice(0, RESULT_LIMIT),
    excludedContentIds,
    eligibleCount: rechecked.eligible.length,
  };
}

export interface FallbackExecutionMetadata {
  reason: FallbackReason;
  budgetSnapshot: BudgetSnapshot;
  durationMs: number;
}

export function completeRuleBasedFallback(
  fallbackInput: RuleBasedFallbackInput,
  metadata: FallbackExecutionMetadata,
): MvpRecommendationExecutionResult {
  const fallback = ruleBasedFallback(fallbackInput);
  return {
    ...fallback,
    continuation: fallbackInput.continuation,
    executionMode: "FALLBACK",
    fallbackUsed: true,
    fallbackReason: metadata.reason,
    budgetSnapshot: metadata.budgetSnapshot,
    durationMs: metadata.durationMs,
    notice:
      "응답 시간을 지키기 위해 기본 추천으로 보여드려요.",
  };
}

export function completeFallbackAttempt(
  attempt: Extract<
    ExecutionAttempt,
    { kind: "fallback_required" }
  >,
): MvpRecommendationExecutionResult {
  return completeRuleBasedFallback(attempt.fallbackInput, {
    reason: attempt.reason,
    budgetSnapshot: attempt.budgetSnapshot,
    durationMs: attempt.durationMs,
  });
}
