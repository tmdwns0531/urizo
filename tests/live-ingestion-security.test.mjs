import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const rootPath = path.resolve(import.meta.dirname, "..");
const moduleCache = new Map();

function resolveTypeScriptModule(fromPath, specifier) {
  const base = path.resolve(path.dirname(fromPath), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromPath}`);
}

async function moduleDataUrl(filePath) {
  const absolutePath = path.resolve(rootPath, filePath);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);

  const pending = (async () => {
    const source = await readFile(absolutePath, "utf8");
    let output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: absolutePath,
    }).outputText;
    const matches = [
      ...output.matchAll(/(?:from\s+|import\s+)(["'])(\.[^"']+)\1/g),
    ];
    for (const match of matches.reverse()) {
      const specifier = match[2];
      const specifierOffset = match[0].lastIndexOf(specifier);
      const start = match.index + specifierOffset;
      const dependency = resolveTypeScriptModule(absolutePath, specifier);
      const dependencyUrl = await moduleDataUrl(dependency);
      output =
        output.slice(0, start) +
        dependencyUrl +
        output.slice(start + specifier.length);
    }
    return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  })();
  moduleCache.set(absolutePath, pending);
  return pending;
}

async function loadModule(filePath) {
  return import(await moduleDataUrl(filePath));
}

function movieDetail(providers) {
  return {
    id: 101,
    title: "가용성 변경 영화",
    overview: "공개 줄거리",
    runtime: 95,
    release_date: "2025-01-02",
    genres: [{ id: 18, name: "드라마" }],
    origin_country: ["KR"],
    production_countries: [{ iso_3166_1: "KR" }],
    release_dates: {
      results: [
        {
          iso_3166_1: "KR",
          release_dates: [{ certification: "12" }],
        },
      ],
    },
    "watch/providers": {
      results: {
        KR: {
          flatrate: providers,
        },
      },
    },
  };
}

test("TMDB re-ingestion deactivates a previously active item when its KR provider disappears", async () => {
  const { ingestTmdbCatalog } = await loadModule(
    "src/integrations/tmdb/ingestion.ts",
  );
  const stored = new Map();
  const writer = {
    async upsertCatalog({ content }) {
      stored.set(`${content.mediaType}:${content.tmdbId}`, {
        active: true,
        searchDocumentActive: true,
        content,
      });
      return content;
    },
    async deactivateCatalog(tmdbId, mediaType) {
      const value = stored.get(`${mediaType}:${tmdbId}`);
      if (!value || !value.active) return false;
      value.active = false;
      value.searchDocumentActive = false;
      return true;
    },
  };
  let providers = [{ provider_id: 8, provider_name: "Netflix" }];
  const source = {
    async listPage() {
      return { page: 1, total_pages: 1, results: [{ id: 101 }] };
    },
    async getDetails() {
      return movieDetail(providers);
    },
  };

  const initial = await ingestTmdbCatalog({
    source,
    writer,
    mediaKinds: ["movie"],
  });
  assert.equal(initial.upserted, 1);
  assert.equal(stored.get("MOVIE:101").active, true);

  providers = [];
  const refreshed = await ingestTmdbCatalog({
    source,
    writer,
    mediaKinds: ["movie"],
  });
  assert.equal(refreshed.upserted, 0);
  assert.equal(refreshed.deactivated, 1);
  assert.equal(refreshed.skipped.NO_ALLOWED_KR_PROVIDER, 1);
  assert.equal(stored.get("MOVIE:101").active, false);
  assert.equal(stored.get("MOVIE:101").searchDocumentActive, false);
});

test("Prisma catalog deactivation hides the content and active document in one transaction", async () => {
  const { PrismaCatalogRepository } = await loadModule(
    "src/adapters/catalog/prisma-catalog-repository.ts",
  );
  const calls = [];
  const transaction = {
    catalogContent: {
      async findUnique(args) {
        calls.push(["find", args]);
        return { id: "tmdb-movie-101" };
      },
      async updateMany(args) {
        calls.push(["content", args]);
        return { count: 1 };
      },
    },
    contentSearchDocument: {
      async updateMany(args) {
        calls.push(["document", args]);
        return { count: 1 };
      },
    },
  };
  const repository = new PrismaCatalogRepository({
    ...transaction,
    async $transaction(operation) {
      return operation(transaction);
    },
  });

  assert.equal(await repository.deactivateCatalog(101, "MOVIE"), true);
  assert.deepEqual(calls[1][1], {
    where: { id: "tmdb-movie-101", isActive: true },
    data: { isActive: false },
  });
  assert.deepEqual(calls[2][1], {
    where: { contentId: "tmdb-movie-101", isActive: true },
    data: { isActive: false },
  });
});

test("Korean certifications choose the most restrictive rating regardless of order", async () => {
  const { tmdbAgeRating } = await loadModule(
    "src/integrations/tmdb/normalization.ts",
  );
  const detail = {
    release_dates: {
      results: [
        {
          iso_3166_1: "KR",
          release_dates: [
            { certification: "12" },
            { certification: "18" },
            { certification: "15" },
          ],
        },
      ],
    },
  };
  assert.equal(tmdbAgeRating("movie", detail), "18");
  detail.release_dates.results[0].release_dates.reverse();
  assert.equal(tmdbAgeRating("movie", detail), "18");
});

test("v0.8 migration makes every server-only table deny-by-default", async () => {
  const migration = await readFile(
    path.join(
      rootPath,
      "prisma/migrations/20260731160000_v08_live_catalog_vector/migration.sql",
    ),
    "utf8",
  );
  const tables = [
    "recommendation_runs",
    "agent_traces",
    "catalog_contents",
    "provider_availabilities",
    "content_search_documents",
    "content_embeddings",
  ];
  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      ),
    );
  }
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]+FROM PUBLIC/);
  assert.match(migration, /rolname = 'anon'[\s\S]+FROM anon/);
  assert.match(
    migration,
    /rolname = 'authenticated'[\s\S]+FROM authenticated/,
  );
});
