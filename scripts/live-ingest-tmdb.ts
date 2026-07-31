import { createPrismaBatchAdapters } from "../src/adapters/prisma/node-factory";
import { runTmdbCatalogIngestion } from "../src/integrations/tmdb/runner";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new Error(`INVALID_${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const prisma = createPrismaBatchAdapters(required("DATABASE_URL"));
  try {
    const report = await runTmdbCatalogIngestion({
      credential: { kind: "api-key", value: required("TMDB_API_KEY") },
      fetchImpl: globalThis.fetch,
      writer: prisma.catalog,
      pages: positiveInteger("TMDB_INGEST_PAGES", 1),
      language: process.env.TMDB_LANGUAGE?.trim() || "ko-KR",
      region: process.env.TMDB_REGION?.trim() || "KR",
    });
    console.log(JSON.stringify({ event: "TMDB_INGEST_COMPLETE", ...report }));
  } finally {
    await prisma.disconnect();
  }
}

main().catch(() => {
  console.error("TMDB_INGEST_FAILED");
  process.exitCode = 1;
});