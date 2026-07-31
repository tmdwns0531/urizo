import type { TmdbCatalogWriter } from "./ingestion";
import {
  ingestTmdbCatalog,
  type TmdbIngestionReport,
} from "./ingestion";
import {
  createTmdbClient,
  type TmdbClientOptions,
} from "./client";
import type { TmdbMediaKind } from "./types";

export interface RunTmdbCatalogIngestionOptions
  extends TmdbClientOptions {
  writer: TmdbCatalogWriter;
  pages?: number;
  mediaKinds?: readonly TmdbMediaKind[];
  locale?: string;
}

/**
 * Explicit local/batch entry point. The caller supplies a secret credential
 * and fetch implementation; this function neither logs nor returns either.
 */
export async function runTmdbCatalogIngestion(
  options: RunTmdbCatalogIngestionOptions,
): Promise<TmdbIngestionReport> {
  const {
    writer,
    pages,
    mediaKinds,
    locale,
    ...clientOptions
  } = options;
  return ingestTmdbCatalog({
    source: createTmdbClient(clientOptions),
    writer,
    pages,
    mediaKinds,
    locale,
  });
}
