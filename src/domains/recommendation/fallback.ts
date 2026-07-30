import type { CatalogContent } from "../../contracts/catalog";
import type {
  RecommendationItem,
  ScoreBreakdown,
} from "../../contracts/recommendation";
import type { SearchInput } from "../../contracts/search";
import { RESULT_LIMIT } from "../../config/recommendation";
import { filterCatalog } from "../catalog/filtering";

const intersectionCount = (
  left: readonly string[],
  right: readonly string[],
): number => left.filter((item) => right.includes(item)).length;

export function ruleBasedFallback(
  catalog: readonly CatalogContent[],
  input: SearchInput,
): {
  ranked: RecommendationItem[];
  items: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
} {
  const filtered = filterCatalog(catalog, input);
  const desiredGenres = [
    ...new Set([...input.desiredGenres, ...input.user.preferredGenres]),
  ];
  const raw = filtered.eligible.map((content) => {
    const mood = intersectionCount(content.moodTags, input.moods);
    const genre = intersectionCount(content.genres, desiredGenres);
    const companion = intersectionCount(
      content.companionTags,
      input.companions,
    );
    const quality =
      content.voteAverage * Math.log1p(content.voteCount) / 130;
    const runtime =
      input.maxRuntimeMinutes === null
        ? 0.7
        : content.runtimeMinutes / input.maxRuntimeMinutes;
    const score = Math.max(
      0,
      Math.min(
        1,
        mood * 0.18 +
          genre * 0.15 +
          companion * 0.05 +
          quality * 0.47 +
          runtime * 0.15,
      ),
    );
    const scoreBreakdown: ScoreBreakdown = {
      semantic: 0,
      mood: Math.min(1, mood),
      genre: Math.min(1, genre),
      runtime: Math.min(1, runtime),
      quality: Math.min(1, quality),
      companion: Math.min(1, companion),
      diversityPenalty: 0,
      total: score,
    };
    const subscribedProvider = content.providers.find(({ provider }) =>
      input.user.subscribedProviders.includes(provider),
    );
    const reasons = [
      subscribedProvider
        ? `${subscribedProvider.provider}에서 볼 수 있어요`
        : "국내 시청 가능한 작품이에요",
      input.maxRuntimeMinutes !== null
        ? `${content.runtimeMinutes}분으로 선택한 시간 안에 볼 수 있어요`
        : "평점과 평가 수를 함께 확인했어요",
    ];
    return {
      content,
      score,
      matchPercent: Math.round(score * 100),
      scoreBreakdown,
      reasons,
    } satisfies RecommendationItem;
  });

  raw.sort(
    (left, right) =>
      right.score - left.score ||
      left.content.title.localeCompare(right.content.title, "ko"),
  );

  const collectionCount = new Map<string, number>();
  const diversified = raw.map((item) => {
    const collection = item.content.collectionId;
    if (!collection) {
      return item;
    }
    const seen = collectionCount.get(collection) ?? 0;
    collectionCount.set(collection, seen + 1);
    if (seen === 0) {
      return item;
    }
    const penalty = seen * 0.12;
    const total = Math.max(0, item.score - penalty);
    return {
      ...item,
      score: total,
      matchPercent: Math.round(total * 100),
      scoreBreakdown: {
        ...item.scoreBreakdown,
        diversityPenalty: penalty,
        total,
      },
    };
  });

  diversified.sort(
    (left, right) =>
      right.score - left.score ||
      left.content.id.localeCompare(right.content.id),
  );

  return {
    ranked: diversified,
    items: diversified.slice(0, RESULT_LIMIT),
    excludedContentIds: filtered.excluded.map(
      ({ content }) => content.id,
    ),
    eligibleCount: filtered.eligible.length,
  };
}