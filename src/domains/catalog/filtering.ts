import type { CatalogContent } from "../../contracts/catalog";
import type { SanitizedRecommendationSearchInput } from "../../contracts/mvp-search";
import type { SearchInput } from "../../contracts/search";

export const FILTER_REASONS = [
  "AGE_RESTRICTED",
  "RATING_UNKNOWN_FOR_MINOR",
  "NOT_AVAILABLE_IN_KOREA",
  "RUNTIME_EXCEEDED",
  "ALREADY_WATCHED",
  "UNSUBSCRIBED_PROVIDER",
  "ORIGIN_MISMATCH",
  "MEDIA_TYPE_MISMATCH",
  "REQUIRED_GENRE_MISMATCH",
  "EXCLUDED_GENRE",
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

const isKoreanContent = (content: CatalogContent): boolean =>
  content.originCountries.includes("KR") ||
  content.productionCountries.includes("KR");

const CHILD_RATING_RANK = { ALL: 0, "7": 1, "12": 2, "15": 3 } as const;

/**
 * Anonymous eligibility is intentionally independent of UserContext. `18` and
 * `UNKNOWN` are always unsafe; WITH_CHILDREN further limits results to the
 * user-approved viewing-rating threshold. A missing child threshold fails
 * closed. Natural language is not consulted for any mandatory filter.
 */
export function getMvpFilterReasons(
  content: CatalogContent,
  input: SanitizedRecommendationSearchInput,
): FilterReason[] {
  const reasons: FilterReason[] = [];

  if (content.ageRating === "18") {
    reasons.push("AGE_RESTRICTED");
  }
  if (content.ageRating === "UNKNOWN") {
    reasons.push("RATING_UNKNOWN_FOR_MINOR");
  }
  const childAgeRatingLimit = input.childAgeRatingLimit ?? null;
  if (
    input.companions.includes("WITH_CHILDREN") &&
    (childAgeRatingLimit === null ||
      (CHILD_RATING_RANK[
        content.ageRating as keyof typeof CHILD_RATING_RANK
      ] ?? Number.POSITIVE_INFINITY) >
        CHILD_RATING_RANK[childAgeRatingLimit]) &&
    !reasons.includes("AGE_RESTRICTED") &&
    !reasons.includes("RATING_UNKNOWN_FOR_MINOR")
  ) {
    reasons.push("AGE_RESTRICTED");
  }

  if (content.providers.length === 0) {
    reasons.push("NOT_AVAILABLE_IN_KOREA");
  } else if (
    !content.providers.some(({ provider }) =>
      input.selectedProviders.includes(provider),
    )
  ) {
    reasons.push("UNSUBSCRIBED_PROVIDER");
  }

  if (
    input.maxRuntimeMinutes !== null &&
    content.runtimeMinutes > input.maxRuntimeMinutes
  ) {
    reasons.push("RUNTIME_EXCEEDED");
  }

  const isKorean = isKoreanContent(content);
  if (
    (input.originPreference === "KR" && !isKorean) ||
    (input.originPreference === "NON_KR" && isKorean)
  ) {
    reasons.push("ORIGIN_MISMATCH");
  }

  const mediaType = input.mediaType ?? "ANY";
  if (mediaType !== "ANY" && content.mediaType !== mediaType) {
    reasons.push("MEDIA_TYPE_MISMATCH");
  }

  const requiredGenres = input.requiredGenres ?? [];
  if (
    requiredGenres.length > 0 &&
    !intersects(content.genres, requiredGenres)
  ) {
    reasons.push("REQUIRED_GENRE_MISMATCH");
  }
  if (intersects(content.genres, input.excludedGenres ?? [])) {
    reasons.push("EXCLUDED_GENRE");
  }

  const explicitlyRequested = intersects(
    content.genres,
    input.desiredGenres,
  );
  if (
    !explicitlyRequested &&
    intersects(content.genres, input.companionAvoidGenres)
  ) {
    reasons.push("COMPANION_AVOID_GENRE");
  }

  return reasons;
}

export function filterMvpCatalog(
  contents: readonly CatalogContent[],
  input: SanitizedRecommendationSearchInput,
): FilterResult {
  const eligible: CatalogContent[] = [];
  const excluded: ExcludedContent[] = [];

  for (const content of contents) {
    const reasons = getMvpFilterReasons(content, input);
    if (reasons.length === 0) {
      eligible.push(content);
    } else {
      excluded.push({ content, reasons });
    }
  }

  return { eligible, excluded };
}

const isExplicitlyOverridden = (
  content: CatalogContent,
  input: SearchInput,
): boolean => intersects(content.genres, input.explicitlyRequestedGenres);

function getLegacyFilterReasons(
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

  const isKorean = isKoreanContent(content);
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

export function getFilterReasons(
  content: CatalogContent,
  input: SanitizedRecommendationSearchInput,
): FilterReason[];
/** @deprecated Transitional authenticated Demo overload. */
export function getFilterReasons(
  content: CatalogContent,
  input: SearchInput,
): FilterReason[];
export function getFilterReasons(
  content: CatalogContent,
  input: SanitizedRecommendationSearchInput | SearchInput,
): FilterReason[] {
  return "user" in input
    ? getLegacyFilterReasons(content, input)
    : getMvpFilterReasons(content, input);
}

export function filterCatalog(
  contents: readonly CatalogContent[],
  input: SanitizedRecommendationSearchInput,
): FilterResult;
/** @deprecated Transitional authenticated Demo overload. */
export function filterCatalog(
  contents: readonly CatalogContent[],
  input: SearchInput,
): FilterResult;
export function filterCatalog(
  contents: readonly CatalogContent[],
  input: SanitizedRecommendationSearchInput | SearchInput,
): FilterResult {
  const eligible: CatalogContent[] = [];
  const excluded: ExcludedContent[] = [];

  for (const content of contents) {
    const reasons = "user" in input
      ? getLegacyFilterReasons(content, input)
      : getMvpFilterReasons(content, input);
    if (reasons.length === 0) {
      eligible.push(content);
    } else {
      excluded.push({ content, reasons });
    }
  }

  return { eligible, excluded };
}
