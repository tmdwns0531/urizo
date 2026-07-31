import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

async function loadStandaloneTypeScriptModule(relativePath) {
  const source = await read(relativePath);
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });
  assert.equal(
    diagnostics.filter(
      (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
  );
  const encoded = Buffer.from(outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("v0.8 migration is non-destructive, vectorized, and identity-free", async () => {
  const [schema, baseline, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read(
      "prisma/migrations/20260731090000_v07_run_trace_baseline/migration.sql",
    ),
    read(
      "prisma/migrations/20260731160000_v08_live_catalog_vector/migration.sql",
    ),
  ]);

  assert.doesNotMatch(
    baseline,
    /catalog_contents|content_embeddings|next_trace_sequence/,
  );
  for (const model of [
    "CatalogContent",
    "ProviderAvailability",
    "ContentSearchDocument",
    "ContentEmbedding",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.match(schema, /provider\s+=\s+"prisma-client"/);
  assert.match(schema, /runtime\s+=\s+"workerd"/);
  assert.match(schema, /runtime\s+=\s+"nodejs"/);
  assert.equal(
    [...schema.matchAll(/engineType\s+=\s+"client"/g)].length,
    2,
  );
  assert.match(
    migration,
    /ADD COLUMN "next_trace_sequence" INTEGER NOT NULL DEFAULT 1/,
  );
  assert.match(
    migration,
    /"embedding" extensions\.vector\(1536\) NOT NULL/,
  );
  assert.match(
    migration,
    /USING hnsw \("embedding" extensions\.vector_cosine_ops\)/,
  );
  assert.match(
    migration,
    /content_search_documents_one_active_idx[\s\S]+WHERE "is_active" = TRUE/,
  );
  const ddlWithoutComments = migration.replace(/--.*$/gm, "");
  const migrationTransaction = ddlWithoutComments.trim();
  assert.match(migrationTransaction, /^BEGIN;/);
  assert.match(migrationTransaction, /COMMIT;$/);
  assert.equal(
    (migrationTransaction.match(/\bBEGIN;/g) ?? []).length,
    1,
  );
  assert.equal((migrationTransaction.match(/\bCOMMIT;/g) ?? []).length, 1);
  assert.doesNotMatch(
    ddlWithoutComments,
    /\b(User|Profile|Auth|Engagement)\b|DATABASE_URL|DIRECT_URL|api[_-]?key|secret/i,
  );
});

test("TMDB normalization allowlists providers and keeps unknown age safe", async () => {
  const normalization = await loadStandaloneTypeScriptModule(
    "src/integrations/tmdb/normalization.ts",
  );
  const normalized = normalization.normalizeTmdbDetail("movie", {
    id: 101,
    title: "테스트 영화",
    overview: "공개 줄거리",
    runtime: 112,
    release_date: "2026-07-31",
    genres: [{ id: 18, name: "드라마" }],
    origin_country: ["KR"],
    production_countries: [{ iso_3166_1: "KR" }],
    vote_average: 8.2,
    vote_count: 1400,
    poster_path: "/poster.jpg",
    release_dates: {
      results: [],
    },
    "watch/providers": {
      results: {
        KR: {
          flatrate: [
            { provider_id: 8, provider_name: "Netflix" },
            { provider_id: 999, provider_name: "Unknown Provider" },
          ],
        },
      },
    },
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.content.ageRating, "UNKNOWN");
  assert.deepEqual(normalized.content.providers, [
    {
      provider: "NETFLIX",
      watchUrl:
        "https://www.netflix.com/search?q=%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%98%81%ED%99%94",
      linkType: "SEARCH",
    },
  ]);
  assert.equal(normalized.content.id, "tmdb-movie-101");

  const skipped = normalization.normalizeTmdbDetail("movie", {
    id: 102,
    title: "미제공 작품",
    runtime: 90,
    release_date: "2024-01-01",
    "watch/providers": {
      results: {
        KR: {
          flatrate: [
            { provider_id: 999, provider_name: "Unknown Provider" },
          ],
        },
      },
    },
  });
  assert.deepEqual(skipped, {
    ok: false,
    reason: "NO_ALLOWED_KR_PROVIDER",
  });
});

test("TMDB Korean certification mapping is strict and search docs are stable", async () => {
  const normalization = await loadStandaloneTypeScriptModule(
    "src/integrations/tmdb/normalization.ts",
  );
  const normalized = normalization.normalizeTmdbDetail("tv", {
    id: 501,
    name: "테스트 시리즈",
    overview: "사용자 입력이 아닌 공개 카탈로그 설명",
    episode_run_time: [45],
    first_air_date: "2025-01-02",
    genres: [{ id: 35, name: "코미디" }],
    origin_country: ["KR"],
    production_countries: [{ iso_3166_1: "KR" }],
    content_ratings: {
      results: [
        {
          iso_3166_1: "KR",
          rating: "15세 이상 관람가",
        },
      ],
    },
    "watch/providers": {
      results: {
        KR: {
          flatrate: [
            { provider_id: 337, provider_name: "Disney Plus" },
          ],
        },
      },
    },
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.content.ageRating, "15");
  assert.equal(normalized.content.providers[0].linkType, "HOME");

  const first = await normalization.buildCatalogSearchDocument(
    normalized.content,
  );
  const second = await normalization.buildCatalogSearchDocument(
    normalized.content,
  );
  assert.deepEqual(first, second);
  assert.equal(first.id.length, 64);
  assert.match(first.contentHash, /^[0-9a-f]{64}$/);
  assert.match(first.documentText, /테스트 시리즈/);
});

test("TMDB client uses injected fetch and never includes credential in errors", async () => {
  const clientModule = await loadStandaloneTypeScriptModule(
    "src/integrations/tmdb/client.ts",
  );
  const requests = [];
  const credential = "test-only-not-a-real-key";
  const client = clientModule.createTmdbClient({
    credential: {
      kind: "api-key",
      value: credential,
    },
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(
        JSON.stringify({
          page: 1,
          total_pages: 1,
          results: [{ id: 7 }],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });
  const page = await client.listPage("movie", 1);
  assert.equal(page.results[0].id, 7);
  assert.match(requests[0].input, /discover\/movie/);
  assert.match(requests[0].input, /include_adult=false/);

  const failing = clientModule.createTmdbClient({
    credential: {
      kind: "bearer",
      value: credential,
    },
    fetchImpl: async () =>
      new Response("", {
        status: 401,
      }),
  });
  await assert.rejects(
    () => failing.listPage("tv", 1),
    (error) => {
      assert.doesNotMatch(String(error), new RegExp(credential));
      return true;
    },
  );
});

test("Prisma SQL bridges are constant and bind every runtime value", async () => {
  const [embeddingSource, searchSource, factorySource] = await Promise.all([
    read("src/adapters/prisma/prisma-embedding-repository.ts"),
    read("src/adapters/search/pgvector-search-adapter.ts"),
    read("src/adapters/prisma/factory.ts"),
  ]);
  assert.match(
    embeddingSource,
    /\$5::extensions\.vector/,
  );
  assert.match(
    embeddingSource,
    /\$executeRawUnsafe\(\s*UPSERT_EMBEDDING_SQL,/,
  );
  assert.match(searchSource, /ANY\(\$2::text\[\]\)/);
  assert.match(searchSource, /database\.query<[^>]+>\(\s*PGVECTOR_RECOMMENDATION_SEARCH_SQL,/);
  assert.match(
    factorySource,
    /from ["']@prisma\/adapter-pg["']/,
  );
  assert.match(
    factorySource,
    /from ["']\.\.\/\.\.\/generated\/prisma-workerd\/client["']/,
  );
  assert.match(factorySource, /new PrismaPg\(\{ connectionString \}\)/);
  assert.match(factorySource, /new PrismaClient\(\{ adapter \}\)/);
  assert.doesNotMatch(
    factorySource,
    /process\.env|globalThis\[["']DATABASE_URL/,
  );
});
