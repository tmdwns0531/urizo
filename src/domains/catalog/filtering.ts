import type { CatalogContent } from "../../contracts/catalog";
import type { SearchInput } from "../../contracts/search";

export const FILTER_REASONS = [
  "AGE_RESTRICTED",
  "RATING_UNKNOWN_FOR_MINOR",
  "NOT_AVAILABLE_IN_KOREA",
  "RUNTIME_EXCEEDED",
  "ALREADY_WATCHED",
  "UNSUBSCRIBED_PROVIDER",
  "ORIGIN_MISMATCH",
  "DISLIKED_GENRE",
  "COMPANION_AVOID_GENRE",
  "NOT_INTERESTED",
] as const;

export type FilterReason = (typeof FILTER_REASONS)[number];

export interface ExcludedContent {
  content: CatalogContent;
  reasons: FilterReason[];
}

export interface FilterResult {
  eligible: CatalogContent[];
  excluded: ExcludedContent[];
}

const intersects = (left: readonly string[], right: readonly string[]): boolean =>
  left.some((item) => right.includes(item));

const isExplicitlyOverridden = (
  content: CatalogContent,
  input: SearchInput,
): boolean => intersects(content.genres, input.explicitlyRequestedGenres);

export function getFilterReasons(
  content: CatalogContent,
  input: SearchInput,
): FilterReason[] {
  const reasons: FilterReason[] = [];
  const { user } = input;

  if (user.isMinor && content.ageRating === "18") {
    reasons.push("AGE_RESTRICTED");
  }
  if (user.isMinor && content.ageRating === "UNKNOWN") {
    reasons.push("RATING_UNKNOWN_FOR_MINOR");
  }
  if (content.providers.length === 0) {
    reasons.push("NOT_AVAILABLE_IN_KOREA");
  }
  if (
    input.maxRuntimeMinutes !== null &&
    content.runtimeMinutes > input.maxRuntimeMinutes
  ) {
    reasons.push("RUNTIME_EXCEEDED");
  }
  if (user.watchedContentIds.includes(content.id)) {
    reasons.push("ALREADY_WATCHED");
  }
  if (
    !user.allowUnsubscribedRecommendations &&
    !content.providers.some(({ provider }) =>
      user.subscribedProviders.includes(provider),
    )
  ) {
    reasons.push("UNSUBSCRIBED_PROVIDER");
  }

  const isKorean =
    content.originCountries.includes("KR") ||
    content.productionCountries.includes("KR");
  if (
    (input.originPreference === "KR" && !isKorean) ||
    (input.originPreference === "NON_KR" && isKorean)
  ) {
    reasons.push("ORIGIN_MISMATCH");
  }

  const explicitlyOverridden = isExplicitlyOverridden(content, input);
  if (
    !explicitlyOverridden &&
    intersects(content.genres, user.dislikedGenres)
  ) {
    reasons.push("DISLIKED_GENRE");
  }
  if (
    !explicitlyOverridden &&
    intersects(content.genres, input.companionAvoidGenres)
  ) {
    reasons.push("COMPANION_AVOID_GENRE");
  }
  if (
    !explicitlyOverridden &&
    user.notInterestedContentIds.includes(content.id)
  ) {
    reasons.push("NOT_INTERESTED");
  }

  return reasons;
}

export function filterCatalog(
  contents: readonly CatalogContent[],
  input: SearchInput,
): FilterResult {
  const eligible: CatalogContent[] = [];
  const excluded: ExcludedContent[] = [];

  for (const content of contents) {
    const reasons = getFilterReasons(content, input);
    if (reasons.length === 0) {
      eligible.push(content);
    } else {
      excluded.push({ content, reasons });
    }
  }

  return { eligible, excluded };
}
