import type { CatalogContent } from "./catalog";

export type ComparisonFactKey =
  | "MEDIA_TYPE"
  | "RUNTIME"
  | "RELEASE_YEAR"
  | "GENRES"
  | "MOODS"
  | "AGE_RATING"
  | "PROVIDERS"
  | "COUNTRIES"
  | "RATING"
  | "SUMMARY";

export interface ComparisonCommonality {
  key: ComparisonFactKey;
  title: string;
  description: string;
}

export interface ComparisonDifference {
  key: ComparisonFactKey;
  label: string;
  leftValue: string;
  rightValue: string;
  description: string;
}

export type ComparisonRecommendationKey =
  | "QUICK_WATCH"
  | "FAMILY_VIEWING"
  | "OTT_FLEXIBILITY"
  | "RATING_CONFIDENCE"
  | "CALM_VIEWING";

export type ComparisonWinner = "LEFT" | "RIGHT" | "TIE";

export interface ComparisonRecommendation {
  key: ComparisonRecommendationKey;
  label: string;
  winner: ComparisonWinner;
  winnerContentId: string | null;
  description: string;
}

export interface ContentComparisonResult {
  left: CatalogContent;
  right: CatalogContent;
  commonalities: ComparisonCommonality[];
  differences: ComparisonDifference[];
  recommendations: ComparisonRecommendation[];
}
