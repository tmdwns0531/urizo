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

/**
 * discover 수집 전략. 인기순 하나로만 긁으면 액션·애니메이션에 편중되어
 * 잔잔한·감성적인 같은 분위기의 안전 후보가 확보되지 않는다. 장르와 정렬을
 * 달리한 여러 sweep 을 돌려 카탈로그 구성을 넓힌다.
 */
export interface TmdbDiscoverSweep {
  /** 로그와 커버리지 보고에 쓰는 식별자. */
  readonly key: string;
  /** TMDB 장르 ID. 비우면 전체 장르. */
  readonly genreIds?: readonly number[];
  readonly sortBy?: string;
  /** 표본이 지나치게 적은 작품을 걸러 품질을 유지한다. */
  readonly minVoteCount?: number;
  /**
   * TMDB watch provider ID. 지정하면 해당 OTT 에서 국내 시청 가능한 작품만
   * 가져온다. 사용자는 보통 OTT 를 하나만 고르는데, 전체 카탈로그를 넓혀도
   * 특정 OTT 의 분위기별 재고는 얇게 남는다. 그래서 OTT 를 지정해 직접 채운다.
   */
  readonly watchProviders?: readonly number[];
  /**
   * 국내 관람등급 상한. movie discover 에만 있는 조건이라 tv 에는 보내지
   * 않는다. 아이 동반 후보는 우연히 들어오길 기다리지 말고 직접 뽑는다.
   */
  readonly maxCertification?: string;
  /** 러닝타임 상한(분). 30·60분 조건을 고른 사용자의 후보를 채운다. */
  readonly maxRuntimeMinutes?: number;
}

export interface TmdbCatalogSource {
  listPage(
    mediaKind: TmdbMediaKind,
    page: number,
    sweep?: TmdbDiscoverSweep,
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
