import { createPrismaBatchAdapters } from "../src/adapters/prisma/node-factory";
import { OpenAiEmbeddingClient } from "../src/adapters/search/openai-embedding-client";
import { runPendingCatalogEmbeddings } from "../src/adapters/prisma/prisma-embedding-runner";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

function positiveInteger(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`INVALID_${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const model = required("OPENAI_EMBEDDING_MODEL");
  const dimensions = Number(required("OPENAI_EMBEDDING_DIMENSIONS"));
  const prisma = createPrismaBatchAdapters(required("DATABASE_URL"));
  try {
    const generator = new OpenAiEmbeddingClient({
      apiKey: required("OPENAI_API_KEY"),
      model: model as "text-embedding-3-small",
      dimensions: dimensions as 1536,
    });
    const report = await runPendingCatalogEmbeddings({
      repository: prisma.embeddings,
      generator,
      model,
      batchSize: positiveInteger("EMBEDDING_BATCH_SIZE", 25, 500),
      maxBatches: positiveInteger("EMBEDDING_MAX_BATCHES", 20, 1_000),
    });
    console.log(JSON.stringify({ event: "CATALOG_EMBED_COMPLETE", ...report }));
    if (report.remaining) {
      console.error("CATALOG_EMBED_INCOMPLETE");
      process.exitCode = 2;
    }
  } finally {
    await prisma.disconnect();
  }
}

main().catch(() => {
  console.error("CATALOG_EMBED_FAILED");
  process.exitCode = 1;
});