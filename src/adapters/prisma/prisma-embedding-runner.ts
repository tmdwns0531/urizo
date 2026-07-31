import type { PrismaContentEmbeddingRepository } from "./prisma-embedding-repository";

export interface CatalogEmbeddingGenerator {
  embed(input: string): Promise<{
    values: readonly number[];
  }>;
}

export interface PendingEmbeddingRunnerOptions {
  repository: PrismaContentEmbeddingRepository;
  generator: CatalogEmbeddingGenerator;
  model: string;
  batchSize?: number;
  maxBatches?: number;
}

export interface PendingEmbeddingRunnerReport {
  batches: number;
  embedded: number;
  remaining: boolean;
}

/**
 * Explicit batch entry point for catalog embeddings. Credentials remain
 * inside the injected generator and are never read, returned, or logged here.
 */
export async function runPendingCatalogEmbeddings(
  options: PendingEmbeddingRunnerOptions,
): Promise<PendingEmbeddingRunnerReport> {
  const batchSize = options.batchSize ?? 25;
  const maxBatches = options.maxBatches ?? 20;
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 500 ||
    !Number.isInteger(maxBatches) ||
    maxBatches < 1 ||
    maxBatches > 1_000
  ) {
    throw new TypeError("invalid embedding batch limits");
  }

  let batches = 0;
  let embedded = 0;
  while (batches < maxBatches) {
    const documents = await options.repository.listPendingDocuments(
      options.model,
      batchSize,
    );
    if (documents.length === 0) {
      return {
        batches,
        embedded,
        remaining: false,
      };
    }

    batches += 1;
    for (const document of documents) {
      const generated = await options.generator.embed(
        document.documentText,
      );
      await options.repository.upsert({
        searchDocumentId: document.id,
        model: options.model,
        values: generated.values,
      });
      embedded += 1;
    }
  }

  const remaining = (
    await options.repository.listPendingDocuments(options.model, 1)
  ).length > 0;
  return {
    batches,
    embedded,
    remaining,
  };
}
