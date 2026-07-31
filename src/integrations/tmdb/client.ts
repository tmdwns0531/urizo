import type {
  TmdbCatalogSource,
  TmdbDetail,
  TmdbDiscoverPage,
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
  ): Promise<TmdbDiscoverPage> {
    if (!Number.isInteger(page) || page < 1 || page > 500) {
      throw new TmdbClientError("INVALID_CONFIGURATION");
    }
    const body = await request<TmdbDiscoverPage>(
      `/discover/${mediaKind}`,
      {
        page: String(page),
        language,
        region,
        sort_by: "popularity.desc",
        include_adult: "false",
      },
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
    const appendToResponse =
      mediaKind === "movie"
        ? "release_dates,watch/providers"
        : "content_ratings,watch/providers";
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
