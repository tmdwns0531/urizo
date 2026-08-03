import { createPrismaBatchAdapters } from "../src/adapters/prisma/node-factory";
import { DEFAULT_DISCOVER_SWEEPS } from "../src/integrations/tmdb/ingestion";
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

/**
 * TMDB_INGEST_SWEEPS 로 sweep 을 골라 돌린다 (쉼표 구분 key). 이미 수집한
 * 작품도 다시 상세 조회하므로 전체 수집은 오래 걸린다 — 특정 분위기의 재고만
 * 보강할 때는 해당 sweep 만 지정하는 편이 빠르다. 비우면 전체를 돈다.
 */
function selectedSweeps() {
  const raw = process.env.TMDB_INGEST_SWEEPS?.trim();
  if (!raw) return undefined;
  const wanted = new Set(
    raw.split(",").map((key) => key.trim()).filter(Boolean),
  );
  const sweeps = DEFAULT_DISCOVER_SWEEPS.filter((sweep) =>
    wanted.has(sweep.key),
  );
  const unknown = [...wanted].filter(
    (key) => !DEFAULT_DISCOVER_SWEEPS.some((sweep) => sweep.key === key),
  );
  if (unknown.length > 0) {
    throw new Error(`UNKNOWN_SWEEP_${unknown.join("_")}`);
  }
  return sweeps;
}

async function main(): Promise<void> {
  const prisma = createPrismaBatchAdapters(required("DATABASE_URL"));
  try {
    const report = await runTmdbCatalogIngestion({
      credential: { kind: "api-key", value: required("TMDB_API_KEY") },
      fetchImpl: globalThis.fetch,
      writer: prisma.catalog,
      pages: positiveInteger("TMDB_INGEST_PAGES", 1),
      sweeps: selectedSweeps(),
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