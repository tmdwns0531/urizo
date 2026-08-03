import {
  OTT_PROVIDERS,
  type AgeRating,
  type CatalogContent,
  type MediaType,
  type OttProvider,
} from "../../contracts/catalog";
import type {
  ComparisonCommonality,
  ComparisonDifference,
  ComparisonRecommendation,
  ComparisonRecommendationKey,
  ComparisonWinner,
  ContentComparisonResult,
} from "../../contracts/content-comparison";
import type { SanitizedRecommendationSearchInput } from "../../contracts/mvp-search";
import {
  filterMvpCatalog,
  getMvpFilterReasons,
} from "../catalog/filtering";

const COMPARISON_FILTER_INPUT: SanitizedRecommendationSearchInput = {
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
};

const PROVIDER_LABELS: Record<OttProvider, string> = {
  NETFLIX: "Netflix",
  TVING: "TVING",
  DISNEY_PLUS: "Disney+",
  WAVVE: "Wavve",
  WATCHA: "WATCHA",
  COUPANG_PLAY: "Coupang Play",
};

const COUNTRY_LABELS: Readonly<Record<string, string>> = {
  KR: "한국",
  US: "미국",
  JP: "일본",
  GB: "영국",
  FR: "프랑스",
  CA: "캐나다",
  ES: "스페인",
  DE: "독일",
  IT: "이탈리아",
  CN: "중국",
  TW: "대만",
  HK: "홍콩",
};

const AGE_RANK: Record<AgeRating, number> = {
  ALL: 0,
  "7": 1,
  "12": 2,
  "15": 3,
  "18": 4,
  UNKNOWN: 5,
};

const CALM_MOOD_TAG = "잔잔한";
const RATING_TIE_RATIO = 0.03;

export class ContentComparisonValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentComparisonValidationError";
  }
}

function stableTextSort(left: string, right: string): number {
  return left.localeCompare(right, "ko-KR");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(stableTextSort);
}

function intersection(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightSet = new Set(right);
  return unique(left.filter((value) => rightSet.has(value)));
}

function difference(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightSet = new Set(right);
  return unique(left.filter((value) => !rightSet.has(value)));
}

function cloneContent(content: CatalogContent): CatalogContent {
  return {
    ...content,
    genres: [...content.genres],
    moodTags: [...content.moodTags],
    companionTags: [...content.companionTags],
    originCountries: [...content.originCountries],
    productionCountries: [...content.productionCountries],
    providers: content.providers.map((provider) => ({ ...provider })),
  };
}

function joinLabels(values: readonly string[], emptyLabel: string): string {
  return values.length > 0 ? values.join(", ") : emptyLabel;
}

function formatMediaType(mediaType: MediaType): string {
  return mediaType === "MOVIE" ? "영화" : "시리즈";
}

function formatRuntime(content: CatalogContent): string {
  return content.mediaType === "MOVIE"
    ? `${content.runtimeMinutes}분`
    : `회당 ${content.runtimeMinutes}분`;
}

function formatAgeRating(ageRating: AgeRating): string {
  if (ageRating === "ALL") return "전체 관람가";
  if (ageRating === "UNKNOWN") return "등급 미상";
  return `${ageRating}세 관람가`;
}

function formatProviders(content: CatalogContent): string[] {
  return unique(
    content.providers.map(
      ({ provider }) => PROVIDER_LABELS[provider] ?? provider,
    ),
  );
}

function formatCountries(countries: readonly string[]): string[] {
  return unique(countries.map((country) => COUNTRY_LABELS[country] ?? country));
}

function formatRating(content: CatalogContent): string {
  return `★ ${content.voteAverage.toFixed(1)} · ${content.voteCount.toLocaleString("ko-KR")}개 평가`;
}

function qualityScore(content: CatalogContent): number {
  return content.voteAverage * Math.log1p(Math.max(0, content.voteCount));
}

function winnerForRating(
  left: CatalogContent,
  right: CatalogContent,
): ComparisonWinner {
  const leftScore = qualityScore(left);
  const rightScore = qualityScore(right);
  const tieThreshold = Math.max(leftScore, rightScore) * RATING_TIE_RATIO;
  return winnerForHigher(leftScore, rightScore, tieThreshold);
}

function hasCalmMood(content: CatalogContent): boolean {
  return content.moodTags.includes(CALM_MOOD_TAG);
}

function winnerForLower(
  leftValue: number,
  rightValue: number,
  tieThreshold = 0,
): ComparisonWinner {
  if (Math.abs(leftValue - rightValue) <= tieThreshold) return "TIE";
  return leftValue < rightValue ? "LEFT" : "RIGHT";
}

function winnerForHigher(
  leftValue: number,
  rightValue: number,
  tieThreshold = 0,
): ComparisonWinner {
  if (Math.abs(leftValue - rightValue) <= tieThreshold) return "TIE";
  return leftValue > rightValue ? "LEFT" : "RIGHT";
}

function recommendation(
  key: ComparisonRecommendationKey,
  label: string,
  winner: ComparisonWinner,
  left: CatalogContent,
  right: CatalogContent,
  description: string,
): ComparisonRecommendation {
  return {
    key,
    label,
    winner,
    winnerContentId:
      winner === "LEFT" ? left.id : winner === "RIGHT" ? right.id : null,
    description,
  };
}

function titleForWinner(
  winner: ComparisonWinner,
  left: CatalogContent,
  right: CatalogContent,
): string | null {
  if (winner === "LEFT") return left.title;
  if (winner === "RIGHT") return right.title;
  return null;
}

function buildCommonalities(
  left: CatalogContent,
  right: CatalogContent,
): ComparisonCommonality[] {
  const items: ComparisonCommonality[] = [];
  const sharedGenres = intersection(left.genres, right.genres);
  const sharedMoods = intersection(left.moodTags, right.moodTags);
  const sharedProviders = intersection(
    formatProviders(left),
    formatProviders(right),
  );
  const sharedCountries = intersection(
    formatCountries(left.productionCountries),
    formatCountries(right.productionCountries),
  );

  if (left.mediaType === right.mediaType) {
    items.push({
      key: "MEDIA_TYPE",
      title: "같은 작품 유형",
      description: `두 작품 모두 ${formatMediaType(left.mediaType)}예요.`,
    });
  }
  if (sharedGenres.length > 0) {
    items.push({
      key: "GENRES",
      title: "겹치는 장르",
      description: `두 작품 모두 ${sharedGenres.join(", ")} 장르를 포함해요.`,
    });
  }
  if (sharedMoods.length > 0) {
    items.push({
      key: "MOODS",
      title: "비슷한 분위기",
      description: `공통적으로 ${sharedMoods.join(", ")} 분위기가 있어요.`,
    });
  }
  if (sharedProviders.length > 0) {
    items.push({
      key: "PROVIDERS",
      title: "함께 제공되는 OTT",
      description: `두 작품 모두 ${sharedProviders.join(", ")}에서 볼 수 있어요.`,
    });
  }
  if (left.ageRating === right.ageRating) {
    items.push({
      key: "AGE_RATING",
      title: "같은 관람등급",
      description: `두 작품 모두 ${formatAgeRating(left.ageRating)}예요.`,
    });
  }
  if (sharedCountries.length > 0) {
    items.push({
      key: "COUNTRIES",
      title: "공통 제작 국가",
      description: `두 작품의 제작 국가에 ${sharedCountries.join(", ")}이 공통으로 포함돼요.`,
    });
  }
  if (left.mediaType === right.mediaType && left.runtimeMinutes === right.runtimeMinutes) {
    items.push({
      key: "RUNTIME",
      title: "같은 시청 시간",
      description: `두 작품 모두 ${formatRuntime(left)} 기준이에요.`,
    });
  }

  if (items.length === 0) {
    items.push({
      key: "SUMMARY",
      title: "뚜렷하게 갈리는 조합",
      description:
        "현재 카탈로그의 구조화 항목에서는 완전히 같은 조건이 확인되지 않았어요.",
    });
  }
  return items;
}

function buildDifferences(
  left: CatalogContent,
  right: CatalogContent,
): ComparisonDifference[] {
  const items: ComparisonDifference[] = [];

  if (left.mediaType !== right.mediaType) {
    items.push({
      key: "MEDIA_TYPE",
      label: "작품 유형",
      leftValue: formatMediaType(left.mediaType),
      rightValue: formatMediaType(right.mediaType),
      description: `${left.title}: ${formatMediaType(left.mediaType)} · ${right.title}: ${formatMediaType(right.mediaType)}예요.`,
    });
  }
  if (left.mediaType !== right.mediaType || left.runtimeMinutes !== right.runtimeMinutes) {
    const delta = Math.abs(left.runtimeMinutes - right.runtimeMinutes);
    items.push({
      key: "RUNTIME",
      label: "상영 시간",
      leftValue: formatRuntime(left),
      rightValue: formatRuntime(right),
      description:
        left.mediaType === right.mediaType
          ? `${left.runtimeMinutes < right.runtimeMinutes ? left.title : right.title} 쪽이 ${delta}분 더 짧아요.`
          : "영화는 총 상영시간, 시리즈는 회당 시간이라 짧고 긴 우열을 직접 판단하지 않아요.",
    });
  }
  if (left.releaseYear !== right.releaseYear) {
    const newer = left.releaseYear > right.releaseYear ? left : right;
    const delta = Math.abs(left.releaseYear - right.releaseYear);
    items.push({
      key: "RELEASE_YEAR",
      label: "공개 연도",
      leftValue: `${left.releaseYear}년`,
      rightValue: `${right.releaseYear}년`,
      description: `더 최근에 공개된 작품은 ${newer.title}이며, 공개 연도는 ${delta}년 차이예요.`,
    });
  }
  if (left.ageRating !== right.ageRating) {
    const safer =
      AGE_RANK[left.ageRating] < AGE_RANK[right.ageRating] ? left : right;
    items.push({
      key: "AGE_RATING",
      label: "관람등급",
      leftValue: formatAgeRating(left.ageRating),
      rightValue: formatAgeRating(right.ageRating),
      description: `더 낮은 관람등급은 ${safer.title} 쪽이에요.`,
    });
  }

  const leftOnlyGenres = difference(left.genres, right.genres);
  const rightOnlyGenres = difference(right.genres, left.genres);
  if (leftOnlyGenres.length > 0 || rightOnlyGenres.length > 0) {
    const genreDescription =
      leftOnlyGenres.length === 0
        ? `${left.title}에만 있는 장르는 없고, ${right.title}에는 ${rightOnlyGenres.join(", ")} 장르가 있어요.`
        : rightOnlyGenres.length === 0
          ? `${right.title}에만 있는 장르는 없고, ${left.title}에는 ${leftOnlyGenres.join(", ")} 장르가 있어요.`
          : `${left.title}에는 ${leftOnlyGenres.join(", ")}, ${right.title}에는 ${rightOnlyGenres.join(", ")} 장르가 각각 있어요.`;
    items.push({
      key: "GENRES",
      label: "서로 다른 장르",
      leftValue: joinLabels(leftOnlyGenres, "공통 장르만"),
      rightValue: joinLabels(rightOnlyGenres, "공통 장르만"),
      description: genreDescription,
    });
  }

  const leftOnlyMoods = difference(left.moodTags, right.moodTags);
  const rightOnlyMoods = difference(right.moodTags, left.moodTags);
  if (leftOnlyMoods.length > 0 || rightOnlyMoods.length > 0) {
    items.push({
      key: "MOODS",
      label: "서로 다른 분위기",
      leftValue: joinLabels(leftOnlyMoods, "공통 분위기만"),
      rightValue: joinLabels(rightOnlyMoods, "공통 분위기만"),
      description: `각 작품에만 있는 분위기 태그를 나눠 확인했어요.`,
    });
  }

  const leftProviders = formatProviders(left);
  const rightProviders = formatProviders(right);
  const leftOnlyProviders = difference(leftProviders, rightProviders);
  const rightOnlyProviders = difference(rightProviders, leftProviders);
  if (leftOnlyProviders.length > 0 || rightOnlyProviders.length > 0) {
    items.push({
      key: "PROVIDERS",
      label: "개별 제공 OTT",
      leftValue: joinLabels(leftOnlyProviders, "공통 OTT만"),
      rightValue: joinLabels(rightOnlyProviders, "공통 OTT만"),
      description: "한 작품에서만 이용할 수 있는 OTT를 구분했어요.",
    });
  }

  const leftCountries = formatCountries(left.productionCountries);
  const rightCountries = formatCountries(right.productionCountries);
  const leftOnlyCountries = difference(leftCountries, rightCountries);
  const rightOnlyCountries = difference(rightCountries, leftCountries);
  if (leftOnlyCountries.length > 0 || rightOnlyCountries.length > 0) {
    items.push({
      key: "COUNTRIES",
      label: "제작 국가",
      leftValue: joinLabels(leftOnlyCountries, "공통 국가만"),
      rightValue: joinLabels(rightOnlyCountries, "공통 국가만"),
      description: "두 작품의 고유 제작 국가를 나눠 표시했어요.",
    });
  }

  if (
    left.voteAverage !== right.voteAverage ||
    left.voteCount !== right.voteCount
  ) {
    const ratingWinner = winnerForRating(left, right);
    const stronger = ratingWinner === "LEFT"
      ? left
      : ratingWinner === "RIGHT"
        ? right
        : null;
    items.push({
      key: "RATING",
      label: "작품 평가",
      leftValue: formatRating(left),
      rightValue: formatRating(right),
      description: stronger
        ? `현재 추천과 같은 평점·평가 수 지표로 보면 ${stronger.title} 쪽이 앞서요.`
        : "현재 추천과 같은 평점·평가 수 지표로 보면 두 작품이 비슷해요.",
    });
  }

  if (items.length === 0) {
    items.push({
      key: "SUMMARY",
      label: "구조화 항목",
      leftValue: "동일",
      rightValue: "동일",
      description:
        "현재 비교하는 구조화 항목은 같아요. 줄거리 원문은 아래 작품 카드에서 따로 확인할 수 있어요.",
    });
  }
  return items;
}

function buildRecommendations(
  left: CatalogContent,
  right: CatalogContent,
): ComparisonRecommendation[] {
  const quickWinner =
    left.mediaType === right.mediaType
      ? winnerForLower(left.runtimeMinutes, right.runtimeMinutes, 9)
      : "TIE";
  const quickTitle = titleForWinner(quickWinner, left, right);

  const familyWinner = winnerForLower(
    AGE_RANK[left.ageRating],
    AGE_RANK[right.ageRating],
  );
  const familyTitle = titleForWinner(familyWinner, left, right);

  const ottWinner = winnerForHigher(
    new Set(left.providers.map(({ provider }) => provider)).size,
    new Set(right.providers.map(({ provider }) => provider)).size,
  );
  const ottTitle = titleForWinner(ottWinner, left, right);

  const ratingWinner = winnerForRating(left, right);
  const ratingTitle = titleForWinner(ratingWinner, left, right);

  const calmWinner = winnerForHigher(
    Number(hasCalmMood(left)),
    Number(hasCalmMood(right)),
  );
  const calmTitle = titleForWinner(calmWinner, left, right);

  return [
    recommendation(
      "QUICK_WATCH",
      "짧고 부담 없이",
      quickWinner,
      left,
      right,
      quickTitle
        ? `${quickTitle} 쪽이 시청 시간이 더 짧아 빠르게 보기 좋아요.`
        : left.mediaType === right.mediaType
          ? "두 작품의 시청 시간 차이가 10분 미만이라 비슷해요."
          : "영화의 총 상영시간과 시리즈의 회당 시간은 기준이 달라 직접 우열을 정하지 않아요.",
    ),
    recommendation(
      "FAMILY_VIEWING",
      "낮은 관람등급 우선",
      familyWinner,
      left,
      right,
      familyTitle
        ? `${familyTitle} 쪽의 관람등급이 더 낮아 함께 볼 사람의 연령을 고려하기 편해요.`
        : `두 작품 모두 ${formatAgeRating(left.ageRating)}예요.`,
    ),
    recommendation(
      "OTT_FLEXIBILITY",
      "OTT 선택 폭",
      ottWinner,
      left,
      right,
      ottTitle
        ? `${ottTitle} 쪽이 제공되는 OTT가 더 많아 선택 폭이 넓어요.`
        : "두 작품이 제공되는 OTT 수가 같아요.",
    ),
    recommendation(
      "RATING_CONFIDENCE",
      "평점·평가 수 지표",
      ratingWinner,
      left,
      right,
      ratingTitle
        ? `현재 추천과 같은 평점·평가 수 지표로 보면 ${ratingTitle} 쪽이 앞서요.`
        : "현재 추천과 같은 평점·평가 수 지표로 보면 두 작품이 비슷해요.",
    ),
    recommendation(
      "CALM_VIEWING",
      "잔잔한 분위기",
      calmWinner,
      left,
      right,
      calmTitle
        ? `${calmTitle}에 잔잔한 분위기 태그가 포함돼요.`
        : "잔잔한 분위기 태그 여부가 두 작품에서 같아요.",
    ),
  ];
}

function assertComparable(content: CatalogContent): void {
  const reasons = getMvpFilterReasons(content, COMPARISON_FILTER_INPUT);
  if (reasons.length > 0) {
    throw new ContentComparisonValidationError(
      "익명 비교 안전 조건을 통과하지 않은 작품입니다.",
    );
  }
}

export function getComparableCatalog(
  contents: readonly CatalogContent[],
): CatalogContent[] {
  const { eligible } = filterMvpCatalog(contents, COMPARISON_FILTER_INPUT);
  return eligible
    .map(cloneContent)
    .sort(
      (left, right) =>
        stableTextSort(left.title, right.title) ||
        stableTextSort(left.id, right.id),
    );
}

export function pickDefaultComparisonIds(
  contents: readonly CatalogContent[],
): [string, string] | null {
  if (contents.length < 2) return null;
  const ranked = [...contents].sort(
    (left, right) =>
      qualityScore(right) - qualityScore(left) ||
      right.voteCount - left.voteCount ||
      stableTextSort(left.title, right.title) ||
      stableTextSort(left.id, right.id),
  );
  return [ranked[0].id, ranked[1].id];
}

export function compareCatalogContents(
  left: CatalogContent,
  right: CatalogContent,
): ContentComparisonResult {
  if (left.id === right.id) {
    throw new ContentComparisonValidationError(
      "서로 다른 두 작품을 선택해야 합니다.",
    );
  }
  assertComparable(left);
  assertComparable(right);

  return {
    left: cloneContent(left),
    right: cloneContent(right),
    commonalities: buildCommonalities(left, right),
    differences: buildDifferences(left, right),
    recommendations: buildRecommendations(left, right),
  };
}
