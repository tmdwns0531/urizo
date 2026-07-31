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
  TmdbMediaKind,
} from "./types";

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
  pages?: number;
  mediaKinds?: readonly TmdbMediaKind[];
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
  const report: TmdbIngestionReport = {
    discovered: 0,
    fetched: 0,
    upserted: 0,
    deactivated: 0,
    skipped: emptySkipCounts(),
  };
  const visited = new Set<string>();

  for (const mediaKind of mediaKinds) {
    for (let page = 1; page <= pages; page += 1) {
      const discovery = await options.source.listPage(mediaKind, page);
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
