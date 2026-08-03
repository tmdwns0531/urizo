import type {
  AgeRating,
  CatalogContent,
  MediaType,
  OttProvider,
  ProviderAvailability,
} from "../../contracts/catalog";
import type { CatalogSearchDocumentInput } from "../../adapters/catalog/prisma-catalog-repository";
import type {
  TmdbDetail,
  TmdbMediaKind,
  TmdbMovieDetail,
  TmdbTvDetail,
  TmdbWatchProvider,
} from "./types";
import {
  deriveCompanionTags,
  deriveMoodTags,
  normalizeKeywords,
} from "./tagging";

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

const PROVIDER_NAMES = new Map<string, OttProvider>([
  ["netflix", "NETFLIX"],
  ["tving", "TVING"],
  ["disney plus", "DISNEY_PLUS"],
  ["disney+", "DISNEY_PLUS"],
  ["wavve", "WAVVE"],
  ["watcha", "WATCHA"],
  ["coupang play", "COUPANG_PLAY"],
]);

export const TMDB_PROVIDER_ALLOWLIST =
  Object.freeze<readonly OttProvider[]>([
    "NETFLIX",
    "TVING",
    "DISNEY_PLUS",
    "WAVVE",
    "WATCHA",
    "COUPANG_PLAY",
  ]);

export type TmdbNormalizationSkipReason =
  | "INVALID_ID"
  | "MISSING_TITLE"
  | "MISSING_RUNTIME"
  | "MISSING_RELEASE_YEAR"
  | "NO_ALLOWED_KR_PROVIDER";

export type TmdbNormalizationResult =
  | {
      ok: true;
      content: CatalogContent;
    }
  | {
      ok: false;
      reason: TmdbNormalizationSkipReason;
    };

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function uniqueStrings(values: readonly unknown[]): string[] {
  const normalized = values
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(normalized)];
}

function countryCodes(detail: TmdbDetail): {
  origin: string[];
  production: string[];
} {
  const origin = uniqueStrings(detail.origin_country ?? [])
    .map((value) => value.toUpperCase())
    .filter((value) => /^[A-Z]{2}$/.test(value));
  const production = uniqueStrings(
    (detail.production_countries ?? []).map(
      (country) => country.iso_3166_1,
    ),
  )
    .map((value) => value.toUpperCase())
    .filter((value) => /^[A-Z]{2}$/.test(value));
  return {
    origin: origin.length > 0 ? origin : [...production],
    production:
      production.length > 0 ? production : [...origin],
  };
}

function normalizeCertification(value: unknown): AgeRating {
  const normalized = cleanText(value)
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  if (
    normalized === "ALL" ||
    normalized === "전체관람가" ||
    normalized === "0" ||
    normalized === "0+"
  ) {
    return "ALL";
  }
  if (
    normalized === "7" ||
    normalized === "7+" ||
    normalized === "7세" ||
    normalized === "7세이상"
  ) {
    return "7";
  }
  if (
    normalized === "12" ||
    normalized === "12+" ||
    normalized === "12세" ||
    normalized === "12세이상" ||
    normalized === "12세이상관람가"
  ) {
    return "12";
  }
  if (
    normalized === "15" ||
    normalized === "15+" ||
    normalized === "15세" ||
    normalized === "15세이상" ||
    normalized === "15세이상관람가"
  ) {
    return "15";
  }
  if (
    normalized === "18" ||
    normalized === "18+" ||
    normalized === "19" ||
    normalized === "19+" ||
    normalized === "18세이상" ||
    normalized === "19세이상" ||
    normalized === "청소년관람불가" ||
    normalized === "제한상영가"
  ) {
    return "18";
  }
  return "UNKNOWN";
}

const AGE_RESTRICTION: Readonly<Record<AgeRating, number>> = {
  ALL: 0,
  "7": 1,
  "12": 2,
  "15": 3,
  "18": 4,
  // Unrecognized non-empty certifications fail closed just like an absent
  // certification; anonymous policy excludes UNKNOWN and 18.
  UNKNOWN: 5,
};

function mostRestrictiveCertification(
  values: readonly unknown[],
): AgeRating {
  let selected: AgeRating | null = null;
  for (const value of values) {
    if (!cleanText(value)) continue;
    const rating = normalizeCertification(value);
    if (
      selected === null ||
      AGE_RESTRICTION[rating] > AGE_RESTRICTION[selected]
    ) {
      selected = rating;
    }
  }
  return selected ?? "UNKNOWN";
}

export function tmdbAgeRating(
  mediaKind: TmdbMediaKind,
  detail: TmdbDetail,
): AgeRating {
  if (mediaKind === "movie") {
    const certifications =
      (detail as TmdbMovieDetail).release_dates?.results
        ?.filter((entry) => entry.iso_3166_1 === "KR")
        .flatMap((entry) =>
          (entry.release_dates ?? []).map(
            (release) => release.certification,
          ),
        ) ?? [];
    return mostRestrictiveCertification(certifications);
  }

  const ratings =
    (detail as TmdbTvDetail).content_ratings?.results
      ?.filter((entry) => entry.iso_3166_1 === "KR")
      .map((entry) => entry.rating) ?? [];
  return mostRestrictiveCertification(ratings);
}

function providerLink(
  provider: OttProvider,
  title: string,
): ProviderAvailability {
  const encodedTitle = encodeURIComponent(title);
  switch (provider) {
    case "NETFLIX":
      return {
        provider,
        watchUrl: `https://www.netflix.com/search?q=${encodedTitle}`,
        linkType: "SEARCH",
      };
    case "TVING":
      return {
        provider,
        watchUrl:
          `https://www.tving.com/search/all?keyword=${encodedTitle}`,
        linkType: "SEARCH",
      };
    case "WAVVE":
      return {
        provider,
        watchUrl:
          `https://www.wavve.com/search?searchWord=${encodedTitle}`,
        linkType: "SEARCH",
      };
    case "WATCHA":
      return {
        provider,
        watchUrl: `https://watcha.com/search?query=${encodedTitle}`,
        linkType: "SEARCH",
      };
    case "DISNEY_PLUS":
      return {
        provider,
        watchUrl: "https://www.disneyplus.com/ko-kr",
        linkType: "HOME",
      };
    case "COUPANG_PLAY":
      return {
        provider,
        watchUrl: "https://www.coupangplay.com/",
        linkType: "HOME",
      };
  }
}

function allowedProviders(
  rawProviders: readonly TmdbWatchProvider[],
  title: string,
): ProviderAvailability[] {
  const providers = new Map<OttProvider, ProviderAvailability>();
  for (const rawProvider of rawProviders) {
    const provider = PROVIDER_NAMES.get(
      cleanText(rawProvider.provider_name).toLowerCase(),
    );
    if (provider) {
      providers.set(provider, providerLink(provider, title));
    }
  }
  return [...providers.values()].sort((left, right) =>
    left.provider.localeCompare(right.provider),
  );
}

function positiveInteger(value: unknown): number | null {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  )
    ? value
    : null;
}

function runtimeFor(
  mediaKind: TmdbMediaKind,
  detail: TmdbDetail,
): number | null {
  if (mediaKind === "movie") {
    return positiveInteger((detail as TmdbMovieDetail).runtime);
  }
  const tv = detail as TmdbTvDetail;
  for (const runtime of tv.episode_run_time ?? []) {
    const valid = positiveInteger(runtime);
    if (valid) {
      return valid;
    }
  }
  return positiveInteger(tv.last_episode_to_air?.runtime);
}

function releaseYearFor(
  mediaKind: TmdbMediaKind,
  detail: TmdbDetail,
): number | null {
  const date =
    mediaKind === "movie"
      ? (detail as TmdbMovieDetail).release_date
      : (detail as TmdbTvDetail).first_air_date;
  const match = cleanText(date).match(/^(\d{4})-/);
  const year = match ? Number(match[1]) : Number.NaN;
  return Number.isInteger(year) && year >= 1870 && year <= 2200
    ? year
    : null;
}

function mediaTypeFor(mediaKind: TmdbMediaKind): MediaType {
  return mediaKind === "movie" ? "MOVIE" : "SERIES";
}

function backdropColor(tmdbId: number): string {
  const value = Math.imul(tmdbId, 2_654_435_761) >>> 0;
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

export function normalizeTmdbDetail(
  mediaKind: TmdbMediaKind,
  detail: TmdbDetail,
): TmdbNormalizationResult {
  const tmdbId = positiveInteger(detail.id);
  if (!tmdbId) {
    return { ok: false, reason: "INVALID_ID" };
  }

  const title = cleanText(
    mediaKind === "movie"
      ? (detail as TmdbMovieDetail).title ||
        (detail as TmdbMovieDetail).original_title
      : (detail as TmdbTvDetail).name ||
        (detail as TmdbTvDetail).original_name,
  );
  if (!title) {
    return { ok: false, reason: "MISSING_TITLE" };
  }

  const runtimeMinutes = runtimeFor(mediaKind, detail);
  if (!runtimeMinutes) {
    return { ok: false, reason: "MISSING_RUNTIME" };
  }
  const releaseYear = releaseYearFor(mediaKind, detail);
  if (!releaseYear) {
    return { ok: false, reason: "MISSING_RELEASE_YEAR" };
  }

  const providers = allowedProviders(
    detail["watch/providers"]?.results?.KR?.flatrate ?? [],
    title,
  );
  if (providers.length === 0) {
    return { ok: false, reason: "NO_ALLOWED_KR_PROVIDER" };
  }

  const countries = countryCodes(detail);
  const posterPath = cleanText(detail.poster_path);
  const collection =
    mediaKind === "movie"
      ? (detail as TmdbMovieDetail).belongs_to_collection
      : null;

  const genres = uniqueStrings((detail.genres ?? []).map((genre) => genre.name));
  const keywords = normalizeKeywords(
    (detail.keywords?.keywords ?? detail.keywords?.results ?? []).map(
      (keyword) => keyword?.name ?? "",
    ),
  );
  const ageRating = tmdbAgeRating(mediaKind, detail);

  return {
    ok: true,
    content: {
      id: `tmdb-${mediaKind}-${tmdbId}`,
      tmdbId,
      title,
      synopsis: cleanText(detail.overview),
      mediaType: mediaTypeFor(mediaKind),
      runtimeMinutes,
      releaseYear,
      genres,
      moodTags: deriveMoodTags(keywords, genres),
      companionTags: deriveCompanionTags(keywords, genres, ageRating),
      ageRating,
      originCountries: countries.origin,
      productionCountries: countries.production,
      providers,
      collectionId: collection?.id
        ? `tmdb-collection-${collection.id}`
        : null,
      voteAverage:
        typeof detail.vote_average === "number" &&
        Number.isFinite(detail.vote_average)
          ? Math.max(0, Math.min(10, detail.vote_average))
          : 0,
      voteCount:
        typeof detail.vote_count === "number" &&
        Number.isInteger(detail.vote_count)
          ? Math.max(0, detail.vote_count)
          : 0,
      posterUrl: posterPath.startsWith("/")
        ? `${TMDB_IMAGE_BASE_URL}${posterPath}`
        : null,
      backdropColor: backdropColor(tmdbId),
    },
  };
}

/**
 * 동반자 코드의 한국어 표기. 검색 질의는
 * `domains/search/query.ts` 의 COMPANION_COPY 로 만들어지므로 같은 낱말을
 * 문서에도 넣어야 임베딩이 맞물린다.
 */
const COMPANION_LABELS: Readonly<Record<string, string>> = {
  ALONE: "혼자",
  PARTNER: "연인과",
  FRIENDS: "친구와",
  FAMILY: "가족과",
  WITH_CHILDREN: "아이와",
};

/**
 * 분위기·동반자 태그를 문서에 넣는다 (TEAM-2: catalog row 와 search document
 * 양쪽에 반영). 빠져 있으면 pgvector 가 `긴장감 있는` 작품을 상위 후보로
 * 올리지 못해 SEARCH_LIMIT 에서 잘리고, 이후 점수 계산으로는 복구되지 않는다.
 */
function searchDocumentText(content: CatalogContent): string {
  const companions = content.companionTags
    .map((tag) => COMPANION_LABELS[tag] ?? tag)
    .filter(Boolean);
  return [
    `제목: ${content.title}`,
    content.synopsis ? `줄거리: ${content.synopsis}` : "",
    `형식: ${content.mediaType}`,
    content.genres.length > 0
      ? `장르: ${content.genres.join(", ")}`
      : "",
    content.moodTags.length > 0
      ? `분위기: ${content.moodTags.join(", ")}`
      : "",
    companions.length > 0
      ? `함께 보기: ${companions.join(", ")}`
      : "",
    content.originCountries.length > 0
      ? `원산지: ${content.originCountries.join(", ")}`
      : "",
    `연도: ${content.releaseYear}`,
    `상영시간: ${content.runtimeMinutes}분`,
    `연령등급: ${content.ageRating}`,
    `OTT: ${content.providers
      .map((provider) => provider.provider)
      .join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildCatalogSearchDocument(
  content: CatalogContent,
  locale = "ko-KR",
): Promise<CatalogSearchDocumentInput> {
  const documentText = searchDocumentText(content);
  const contentHash = await sha256(
    `${content.id}\u0000${locale}\u0000${documentText}`,
  );
  return {
    id: `doc_${contentHash.slice(0, 60)}`,
    locale,
    documentText,
    contentHash,
  };
}
