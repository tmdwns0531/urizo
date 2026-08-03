import type {
  TmdbCatalogSource,
  TmdbDetail,
  TmdbDiscoverPage,
  TmdbDiscoverSweep,
  TmdbMediaKind,
  TmdbMovieDetail,
  TmdbTvDetail,
} from "./types";

const DEFAULT_BASE_URL = "https://api.themoviedb.org/3";

export type TmdbCredential =
  | {
      kind: "bearer";
      value: string;
    }
  | {
      kind: "api-key";
      value: string;
    };

export interface TmdbClientOptions {
  credential: TmdbCredential;
  fetchImpl: typeof fetch;
  baseUrl?: string;
  language?: string;
  region?: string;
  signal?: AbortSignal;
}

export class TmdbClientError extends Error {
  constructor(
    readonly code:
      | "INVALID_CONFIGURATION"
      | "REQUEST_FAILED"
      | "INVALID_RESPONSE",
    readonly status: number | null = null,
  ) {
    super(status === null ? code : `${code}:${status}`);
    this.name = "TmdbClientError";
  }
}

function assertJsonObject(value: unknown): asserts value is object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TmdbClientError("INVALID_RESPONSE");
  }
}

export function createTmdbClient(
  options: TmdbClientOptions,
): TmdbCatalogSource {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const language = options.language ?? "ko-KR";
  const region = options.region ?? "KR";
  if (
    !options.credential.value ||
    !baseUrl.startsWith("https://") ||
    !language ||
    !region
  ) {
    throw new TmdbClientError("INVALID_CONFIGURATION");
  }

  async function request<T extends object>(
    path: string,
    parameters: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }
    const headers: HeadersInit = {
      accept: "application/json",
    };
    if (options.credential.kind === "bearer") {
      headers.authorization = `Bearer ${options.credential.value}`;
    } else {
      url.searchParams.set("api_key", options.credential.value);
    }

    let response: Response;
    try {
      response = await options.fetchImpl(url, {
        method: "GET",
        headers,
        signal: options.signal,
      });
    } catch {
      throw new TmdbClientError("REQUEST_FAILED");
    }
    if (!response.ok) {
      throw new TmdbClientError("REQUEST_FAILED", response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new TmdbClientError("INVALID_RESPONSE", response.status);
    }
    assertJsonObject(body);
    return body as T;
  }

  async function listPage(
    mediaKind: TmdbMediaKind,
    page: number,
    sweep?: TmdbDiscoverSweep,
  ): Promise<TmdbDiscoverPage> {
    if (!Number.isInteger(page) || page < 1 || page > 500) {
      throw new TmdbClientError("INVALID_CONFIGURATION");
    }
    const parameters: Record<string, string> = {
      page: String(page),
      language,
      region,
      sort_by: sweep?.sortBy ?? "popularity.desc",
      include_adult: "false",
    };
    if (sweep?.genreIds?.length) {
      // TMDB 는 쉼표가 AND, 파이프가 OR 다. sweep 의 장르 목록은 "이 중
      // 하나라도" 를 뜻하므로 파이프로 잇는다. 쉼표를 쓰면 모든 장르를 동시에
      // 가진 작품만 걸려서 후보가 급감한다 (실측: 53,9648,80 은 185편,
      // 53|9648|80 은 4,073편).
      parameters.with_genres = sweep.genreIds.join("|");
    }
    if (sweep?.minVoteCount !== undefined) {
      parameters["vote_count.gte"] = String(sweep.minVoteCount);
    }
    if (sweep?.watchProviders?.length) {
      // with_watch_providers 는 watch_region 이 함께 있어야 동작한다.
      // 여기서도 파이프가 OR 다 ("이 중 한 곳에서라도 볼 수 있는").
      parameters.with_watch_providers = sweep.watchProviders.join("|");
      parameters.watch_region = region;
    }
    if (sweep?.maxCertification && mediaKind === "movie") {
      // certification 계열은 movie discover 에만 있다. tv 에 보내면 무시되거나
      // 오류가 나므로 미디어 종류를 확인하고 건다.
      parameters.certification_country = region;
      parameters["certification.lte"] = sweep.maxCertification;
    }
    if (sweep?.maxRuntimeMinutes !== undefined) {
      parameters["with_runtime.lte"] = String(sweep.maxRuntimeMinutes);
    }
    const body = await request<TmdbDiscoverPage>(
      `/discover/${mediaKind}`,
      parameters,
    );
    if (!Array.isArray(body.results)) {
      throw new TmdbClientError("INVALID_RESPONSE");
    }
    return body;
  }

  async function getDetails(
    mediaKind: TmdbMediaKind,
    tmdbId: number,
  ): Promise<TmdbDetail> {
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new TmdbClientError("INVALID_CONFIGURATION");
    }
    // keywords 는 mood·companion 태깅의 유일한 근거다. 별도 호출을 늘리지
    // 않도록 기존 상세 요청에 함께 실어 받는다.
    const appendToResponse =
      mediaKind === "movie"
        ? "release_dates,watch/providers,keywords"
        : "content_ratings,watch/providers,keywords";
    return request<TmdbDetail>(
      `/${mediaKind}/${tmdbId}`,
      {
        language,
        append_to_response: appendToResponse,
      },
    );
  }

  return {
    listPage,
    getDetails: getDetails as {
      (
        mediaKind: "movie",
        tmdbId: number,
      ): Promise<TmdbMovieDetail>;
      (
        mediaKind: "tv",
        tmdbId: number,
      ): Promise<TmdbTvDetail>;
    },
  };
}
