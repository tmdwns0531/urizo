import type { TmdbCatalogWriter } from "./ingestion";
import {
  ingestTmdbCatalog,
  type TmdbIngestionReport,
} from "./ingestion";
import {
  createTmdbClient,
  type TmdbClientOptions,
} from "./client";
import type { TmdbDiscoverSweep, TmdbMediaKind } from "./types";

export interface RunTmdbCatalogIngestionOptions
  extends TmdbClientOptions {
  writer: TmdbCatalogWriter;
  pages?: number;
  mediaKinds?: readonly TmdbMediaKind[];
  /** 비우면 DEFAULT_DISCOVER_SWEEPS. 일부만 지정하면 그 sweep 만 돈다. */
  sweeps?: readonly TmdbDiscoverSweep[];
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
    sweeps,
    locale,
    ...clientOptions
  } = options;
  return ingestTmdbCatalog({
    source: createTmdbClient(clientOptions),
    writer,
    pages,
    mediaKinds,
    sweeps,
    locale,
  });
}
