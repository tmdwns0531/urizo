import type { OttProvider } from "./user";

export const AGE_RATINGS = ["ALL", "7", "12", "15", "18", "UNKNOWN"] as const;
export type AgeRating = (typeof AGE_RATINGS)[number];

export const MEDIA_TYPES = ["MOVIE", "SERIES"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export interface ProviderAvailability {
  provider: OttProvider;
  watchUrl: string;
}

export interface CatalogContent {
  id: string;
  tmdbId: number;
  title: string;
  synopsis: string;
  mediaType: MediaType;
  runtimeMinutes: number;
  releaseYear: number;
  genres: string[];
  moodTags: string[];
  companionTags: string[];
  ageRating: AgeRating;
  originCountries: string[];
  productionCountries: string[];
  providers: ProviderAvailability[];
  collectionId: string | null;
  voteAverage: number;
  voteCount: number;
  posterUrl: string | null;
  backdropColor: string;
}
