export type TmdbMediaKind = "movie" | "tv";

export interface TmdbDiscoverResult {
  id: number;
}

export interface TmdbDiscoverPage {
  page: number;
  total_pages: number;
  results: TmdbDiscoverResult[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCountry {
  iso_3166_1: string;
  name?: string;
}

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
}

export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbWatchProvider[];
}

export interface TmdbWatchProviderResponse {
  results?: Record<string, TmdbWatchProviderRegion>;
}

export interface TmdbMovieReleaseDate {
  certification?: string;
  iso_639_1?: string;
  release_date?: string;
  type?: number;
}

export interface TmdbMovieReleaseDatesResult {
  iso_3166_1: string;
  release_dates: TmdbMovieReleaseDate[];
}

export interface TmdbMovieReleaseDatesResponse {
  results?: TmdbMovieReleaseDatesResult[];
}

export interface TmdbTvContentRating {
  iso_3166_1: string;
  rating: string;
}

export interface TmdbTvContentRatingsResponse {
  results?: TmdbTvContentRating[];
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

/** movie 는 keywords.keywords, tv 는 keywords.results 로 키가 다르다. */
export interface TmdbKeywordsResponse {
  keywords?: TmdbKeyword[];
  results?: TmdbKeyword[];
}

interface TmdbDetailBase {
  id: number;
  overview?: string;
  genres?: TmdbGenre[];
  origin_country?: string[];
  production_countries?: TmdbCountry[];
  vote_average?: number;
  vote_count?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  "watch/providers"?: TmdbWatchProviderResponse;
  keywords?: TmdbKeywordsResponse;
}

export interface TmdbMovieDetail extends TmdbDetailBase {
  title?: string;
  original_title?: string;
  runtime?: number | null;
  release_date?: string;
  belongs_to_collection?: {
    id: number;
    name?: string;
  } | null;
  release_dates?: TmdbMovieReleaseDatesResponse;
}

export interface TmdbTvDetail extends TmdbDetailBase {
  name?: string;
  original_name?: string;
  episode_run_time?: number[];
  first_air_date?: string;
  last_episode_to_air?: {
    runtime?: number | null;
  } | null;
  content_ratings?: TmdbTvContentRatingsResponse;
}

export type TmdbDetail = TmdbMovieDetail | TmdbTvDetail;

export interface TmdbCatalogSource {
  listPage(
    mediaKind: TmdbMediaKind,
    page: number,
  ): Promise<TmdbDiscoverPage>;
  getDetails(
    mediaKind: "movie",
    tmdbId: number,
  ): Promise<TmdbMovieDetail>;
  getDetails(
    mediaKind: "tv",
    tmdbId: number,
  ): Promise<TmdbTvDetail>;
}
