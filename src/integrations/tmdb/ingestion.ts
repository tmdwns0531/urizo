import type { MediaType } from "../../contracts/catalog";
import type {
  CatalogUpsertInput,
  PrismaCatalogRepository,
} from "../../adapters/catalog/prisma-catalog-repository";
import {
  buildCatalogSearchDocument,
  normalizeTmdbDetail,
  type TmdbNormalizationSkipReason,
} from "./normalization";
import type {
  TmdbCatalogSource,
  TmdbDiscoverSweep,
  TmdbMediaKind,
} from "./types";

/**
 * OTT 별 수집. 사용자는 보통 구독 중인 OTT 하나만 고르는데, 장르 sweep 만으로는
 * 특정 OTT 의 분위기별 재고가 채워지지 않는다 — 실측으로 넷플릭스 단독 기준
 * `가볍게 웃을 수 있는` 2편, `강렬하고 속도감 있는` 2편이었다. TMDB provider ID
 * 는 /watch/providers 응답에서 확인한 값이다 (watch_region=KR).
 *
 * 쿠팡플레이(1881)는 국내 movie 목록에 없고 tv 목록에만 있다. 그래서 수집돼도
 * 시리즈 위주가 된다.
 */
const PROVIDER_SWEEPS: readonly TmdbDiscoverSweep[] = Object.freeze([
  { key: "ott-netflix", watchProviders: [8], sortBy: "popularity.desc" },
  { key: "ott-tving", watchProviders: [1883], sortBy: "popularity.desc" },
  { key: "ott-wavve", watchProviders: [356], sortBy: "popularity.desc" },
  { key: "ott-disney", watchProviders: [337], sortBy: "popularity.desc" },
  { key: "ott-watcha", watchProviders: [97], sortBy: "popularity.desc" },
  { key: "ott-coupang", watchProviders: [1881], sortBy: "popularity.desc" },
]);

/** 국내 5개 OTT 중 한 곳에서라도 볼 수 있는 작품. */
const KR_PROVIDERS = [8, 1883, 356, 337, 97] as const;

/**
 * 장르 × OTT 결합 수집. 장르 sweep 과 OTT sweep 을 따로 돌리면 교집합이
 * 얇게 남는다 — 코미디를 인기순으로 긁으면 국내 OTT 에 없는 작품이 대부분이라
 * (실측 1,701편 중 650편이 국내 제공처 없음으로 탈락) 정작 넷플릭스 코미디는
 * 몇 편 안 들어온다. `가볍게 웃을 수 있는`·`강렬하고 속도감 있는` 이 넷플릭스
 * 단독 기준 6편에서 멈춘 이유다.
 *
 * 두 조건을 함께 걸면 결과가 전부 국내 시청 가능한 작품이라 수율이 크게 오른다.
 */
const GENRE_PROVIDER_SWEEPS: readonly TmdbDiscoverSweep[] = Object.freeze([
  {
    key: "kr-comedy",
    genreIds: [35],
    watchProviders: [...KR_PROVIDERS],
    sortBy: "popularity.desc",
  },
  {
    key: "kr-action",
    genreIds: [28, 12, 10759],
    watchProviders: [...KR_PROVIDERS],
    sortBy: "popularity.desc",
  },
  {
    key: "netflix-comedy",
    genreIds: [35],
    watchProviders: [8],
    sortBy: "popularity.desc",
  },
  {
    key: "netflix-action",
    genreIds: [28, 12, 10759],
    watchProviders: [8],
    sortBy: "popularity.desc",
  },
]);

/**
 * 아이 동반용 수집. WITH_CHILDREN 은 ALL·7·12 만 허용하는데, 지금까지는 그
 * 조건 없이 긁어서 안전 후보가 우연히 들어온 것만 있었다 — 실측으로 넷플릭스
 * 기준 6개 분위기 중 5개가 8편 미만이었고 `심장이 쫄깃해지는` 은 1편이었다.
 *
 * 영화는 국내 관람등급으로 직접 거르고, 시리즈는 등급 조건이 discover 에 없어
 * 가족·애니메이션·Kids 장르로 대신한다.
 */
const CHILD_SAFE_SWEEPS: readonly TmdbDiscoverSweep[] = Object.freeze([
  {
    key: "kr-child-safe",
    watchProviders: [...KR_PROVIDERS],
    maxCertification: "12",
    sortBy: "popularity.desc",
  },
  {
    key: "netflix-child-safe",
    watchProviders: [8],
    maxCertification: "12",
    sortBy: "popularity.desc",
  },
  {
    key: "kr-family-kids",
    genreIds: [10751, 16, 10762],
    watchProviders: [...KR_PROVIDERS],
    sortBy: "popularity.desc",
  },
]);

/**
 * 짧은 작품 수집. 시청 시간 30·60분을 고르면 영화가 통째로 빠져 후보가
 * 무너진다 — 실측으로 넷플릭스·30분 기준 `여운이 길게 남는` 이 0편이었다.
 */
const SHORT_FORM_SWEEPS: readonly TmdbDiscoverSweep[] = Object.freeze([
  {
    key: "kr-short",
    watchProviders: [...KR_PROVIDERS],
    maxRuntimeMinutes: 60,
    sortBy: "popularity.desc",
  },
  {
    key: "netflix-short",
    watchProviders: [8],
    maxRuntimeMinutes: 60,
    sortBy: "popularity.desc",
  },
]);

/**
 * 기본 수집 전략. 인기순만 쓰면 액션·애니메이션이 대부분을 차지해
 * 잔잔한·감성적인 분위기의 안전 후보가 확보되지 않는다. 장르와 정렬을
 * 달리한 sweep 을 함께 돌려 카탈로그 구성을 넓힌다.
 *
 * 장르 ID 는 TMDB 공용 값이다. movie 와 tv 가 서로 다른 ID 를 쓰는 장르는
 * 두 값을 함께 넣어 두 미디어 모두에서 동작하게 한다.
 */
export const DEFAULT_DISCOVER_SWEEPS: readonly TmdbDiscoverSweep[] =
  Object.freeze([
    { key: "popular", sortBy: "popularity.desc" },
    // 드라마(18/18) — 잔잔한·감성적인·생각할 거리가 있는 후보의 주 공급원
    {
      key: "drama-acclaimed",
      genreIds: [18],
      sortBy: "vote_average.desc",
      minVoteCount: 300,
    },
    // 로맨스(10749) + 음악(10402) — 감성적인·PARTNER 동반자
    {
      key: "romance-music",
      genreIds: [10749, 10402],
      sortBy: "vote_average.desc",
      minVoteCount: 200,
    },
    // 스릴러(53) + 미스터리(9648) + 범죄(80) — 어두운·긴장감 있는
    {
      key: "thriller-mystery",
      genreIds: [53, 9648, 80],
      sortBy: "vote_average.desc",
      minVoteCount: 300,
    },
    // 다큐(99) + 가족(10751) — 잔잔한·FAMILY 동반자
    {
      key: "documentary-family",
      genreIds: [99, 10751],
      sortBy: "vote_average.desc",
      minVoteCount: 100,
    },
    // 다큐(99) 단독, 표 기준을 낮춰서 — `잔잔한` 의 주 공급원. 위 sweep 은
    // 가족물이 대부분을 차지해 다큐가 몇 편 남지 않는다.
    {
      key: "documentary-quiet",
      genreIds: [99],
      sortBy: "vote_average.desc",
      minVoteCount: 30,
    },
    // 드라마(18) + 가족(10751) 을 인기순으로 — drama-acclaimed 와 정렬이
    // 달라 겹치지 않는다. slice of life·cooking·hospital 계열이 여기서 온다.
    {
      key: "slice-of-life",
      genreIds: [18, 10751],
      sortBy: "popularity.desc",
      minVoteCount: 50,
    },
    // SF(movie 878 / tv 10765) — dystopia·time travel·moral dilemma 로
    // `생각할 거리가 있는` 을 채운다. 이 분위기는 장르 폴백이 없어 keyword 에만
    // 의존하므로 공급원을 따로 둔다.
    {
      key: "scifi-thoughtful",
      genreIds: [878, 10765],
      sortBy: "vote_average.desc",
      minVoteCount: 200,
    },
    // 코미디(35) — `가볍게 웃을 수 있는` 의 공급원. 이 sweep 이 없어서 해당
    // 분위기가 넷플릭스 단독 기준 2편까지 떨어졌다.
    {
      key: "comedy",
      genreIds: [35],
      sortBy: "popularity.desc",
      minVoteCount: 100,
    },
    // 액션(movie 28) + 모험(12) + Action & Adventure(tv 10759) —
    // `강렬하고 속도감 있는` 의 공급원. 역시 전용 sweep 이 없었다.
    {
      key: "action-adventure",
      genreIds: [28, 12, 10759],
      sortBy: "popularity.desc",
      minVoteCount: 100,
    },
    ...PROVIDER_SWEEPS,
    ...GENRE_PROVIDER_SWEEPS,
    ...CHILD_SAFE_SWEEPS,
    ...SHORT_FORM_SWEEPS,
  ]);

export interface TmdbCatalogWriter {
  upsertCatalog(
    input: CatalogUpsertInput,
  ): ReturnType<PrismaCatalogRepository["upsertCatalog"]>;
  deactivateCatalog(
    tmdbId: number,
    mediaType: MediaType,
  ): ReturnType<PrismaCatalogRepository["deactivateCatalog"]>;
}

export interface TmdbIngestionOptions {
  source: TmdbCatalogSource;
  writer: TmdbCatalogWriter;
  /** sweep 하나당 페이지 수. 총 조회량은 sweep 수 × mediaKind 수 × pages. */
  pages?: number;
  mediaKinds?: readonly TmdbMediaKind[];
  sweeps?: readonly TmdbDiscoverSweep[];
  locale?: string;
}

export interface TmdbIngestionReport {
  discovered: number;
  fetched: number;
  upserted: number;
  deactivated: number;
  skipped: Record<TmdbNormalizationSkipReason, number>;
}

function mediaTypeFor(mediaKind: TmdbMediaKind): MediaType {
  return mediaKind === "movie" ? "MOVIE" : "SERIES";
}

function emptySkipCounts():
Record<TmdbNormalizationSkipReason, number> {
  return {
    INVALID_ID: 0,
    MISSING_TITLE: 0,
    MISSING_RUNTIME: 0,
    MISSING_RELEASE_YEAR: 0,
    NO_ALLOWED_KR_PROVIDER: 0,
  };
}

/**
 * Batch-only ingestion boundary. Application request handlers must read the
 * Prisma catalog and must never call this function or TMDB directly.
 */
export async function ingestTmdbCatalog(
  options: TmdbIngestionOptions,
): Promise<TmdbIngestionReport> {
  const pages = options.pages ?? 1;
  if (!Number.isInteger(pages) || pages < 1 || pages > 500) {
    throw new TypeError("pages must be an integer between 1 and 500");
  }
  const mediaKinds = options.mediaKinds ?? ["movie", "tv"];
  const sweeps =
    options.sweeps?.length ? options.sweeps : DEFAULT_DISCOVER_SWEEPS;
  const report: TmdbIngestionReport = {
    discovered: 0,
    fetched: 0,
    upserted: 0,
    deactivated: 0,
    skipped: emptySkipCounts(),
  };
  // sweep 끼리 결과가 겹치므로 같은 작품을 다시 조회하지 않는다.
  const visited = new Set<string>();

  const passes = sweeps.flatMap((sweep) =>
    mediaKinds.map((mediaKind) => ({ sweep, mediaKind })),
  );

  for (const { sweep, mediaKind } of passes) {
    for (let page = 1; page <= pages; page += 1) {
      const discovery = await options.source.listPage(mediaKind, page, sweep);
      for (const result of discovery.results) {
        const visitKey = `${mediaKind}:${result.id}`;
        if (visited.has(visitKey)) {
          continue;
        }
        visited.add(visitKey);
        report.discovered += 1;

        const detail = mediaKind === "movie"
          ? await options.source.getDetails("movie", result.id)
          : await options.source.getDetails("tv", result.id);
        report.fetched += 1;
        const normalized = normalizeTmdbDetail(mediaKind, detail);
        if (!normalized.ok) {
          report.skipped[normalized.reason] += 1;
          if (
            await options.writer.deactivateCatalog(
              result.id,
              mediaTypeFor(mediaKind),
            )
          ) {
            report.deactivated += 1;
          }
          continue;
        }
        if (normalized.content.tmdbId !== result.id) {
          report.skipped.INVALID_ID += 1;
          if (
            await options.writer.deactivateCatalog(
              result.id,
              mediaTypeFor(mediaKind),
            )
          ) {
            report.deactivated += 1;
          }
          continue;
        }

        const searchDocument = await buildCatalogSearchDocument(
          normalized.content,
          options.locale,
        );
        await options.writer.upsertCatalog({
          content: normalized.content,
          searchDocument,
        });
        report.upserted += 1;
      }
    }
  }

  return report;
}
