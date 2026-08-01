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
    const matches = [...output.matchAll(/(?:from\s+|import\s+)(["'])(\.[^"']+)\1/g)];
    for (const match of matches.reverse()) {
      const specifier = match[2];
      const specifierOffset = match[0].lastIndexOf(specifier);
      const start = match.index + specifierOffset;
      const dependency = resolveTypeScriptModule(absolutePath, specifier);
      const dependencyUrl = await moduleDataUrl(dependency);
      output = output.slice(0, start) + dependencyUrl + output.slice(start + specifier.length);
    }
    return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  })();
  moduleCache.set(absolutePath, pending);
  return pending;
}

async function loadModule(filePath) {
  return import(await moduleDataUrl(filePath));
}

function content(overrides = {}) {
  return {
    id: "content-1",
    tmdbId: 1,
    title: "따뜻한 영화",
    synopsis: "친구와 편안하게 보는 따뜻한 이야기",
    mediaType: "MOVIE",
    runtimeMinutes: 90,
    releaseYear: 2026,
    genres: ["드라마"],
    moodTags: ["따뜻한"],
    companionTags: ["FRIENDS"],
    ageRating: "12",
    originCountries: ["KR"],
    productionCountries: ["KR"],
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.test/watch",
        linkType: "DIRECT",
      },
    ],
    collectionId: null,
    voteAverage: 8,
    voteCount: 100,
    posterUrl: null,
    backdropColor: "#000000",
    ...overrides,
  };
}

test("LIVE request validation is strict, neutral, Unicode-safe, and transient", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const searchContract = await loadModule("src/contracts/mvp-search.ts");
  const resolved = request.resolveMvpRecommendationRequest({});
  assert.equal(resolved.scenario, null);
  assert.deepEqual(resolved.transientInput.companions, ["ANY"]);
  assert.equal(resolved.transientInput.selectedProviders.length, 6);
  assert.equal(resolved.transientInput.maxRuntimeMinutes, null);
  assert.equal(resolved.sanitizedInput.naturalLanguage, undefined);

  assert.throws(
    () =>
      request.resolveMvpRecommendationRequest(
        { choice: {} },
        { requireMeaningfulChoice: true },
      ),
    (error) =>
      error instanceof request.MvpRequestValidationError &&
      error.issues.some((issue) => issue.code === "POLICY"),
    "public recommendation requests must not be fully neutral",
  );
  assert.deepEqual(
    request.resolveMvpRecommendationRequest(
      { choice: { moods: ["따뜻한"] } },
      { requireMeaningfulChoice: true },
    ).choice.moods,
    ["따뜻한"],
    "one meaningful condition is sufficient",
  );

  for (const invalid of [
    { userId: "forbidden" },
    { scenario: "policy_block" },
    { choice: { unknown: true } },
    { choice: { companions: ["ALONE", "FRIENDS"] } },
    { choice: { moods: ["따뜻한", "따뜻한"] } },
    { choice: { maxRuntimeMinutes: 45 } },
    { choice: { selectedProviders: ["NETFLIX", "NETFLIX"] } },
    { choice: { companions: ["FAMILY"], companionAvoidGenres: ["공포"] } },
    {
      choice: {
        desiredGenres: Array.from(
          { length: searchContract.MVP_GENRE_MAX_ITEMS + 1 },
          (_, index) => `장르-${index}`,
        ),
      },
    },
    {
      choice: {
        explicitlyRequestedGenres: Array.from(
          { length: searchContract.MVP_GENRE_MAX_ITEMS + 1 },
          (_, index) => `장르-${index}`,
        ),
      },
    },
    {
      choice: {
        desiredGenres: [
          "😀".repeat(searchContract.MVP_GENRE_MAX_CODE_POINTS + 1),
        ],
      },
    },
    {
      choice: {
        explicitlyRequestedGenres: [
          "😀".repeat(searchContract.MVP_GENRE_MAX_CODE_POINTS + 1),
        ],
      },
    },
  ]) {
    assert.throws(
      () => request.resolveMvpRecommendationRequest(invalid),
      (error) =>
        error instanceof request.MvpRequestValidationError &&
        error.name === "MvpRequestValidationError",
    );
  }

  const unicode140 = "😀".repeat(140);
  assert.equal(
    request.resolveMvpRecommendationRequest({
      choice: { naturalLanguage: unicode140 },
    }).transientInput.naturalLanguage,
    unicode140,
  );
  assert.throws(() =>
    request.resolveMvpRecommendationRequest({
      choice: { naturalLanguage: `${unicode140}😀` },
    }),
  );

  const maximumGenres = Array.from(
    { length: searchContract.MVP_GENRE_MAX_ITEMS },
    (_, index) => `장르-${index}`,
  );
  const bounded = request.resolveMvpRecommendationRequest({
    choice: {
      desiredGenres: maximumGenres,
      explicitlyRequestedGenres: [...maximumGenres].reverse(),
    },
  });
  assert.deepEqual(bounded.sanitizedInput.desiredGenres, maximumGenres);
  const maximumGenreName = "😀".repeat(
    searchContract.MVP_GENRE_MAX_CODE_POINTS,
  );
  assert.deepEqual(
    request.resolveMvpRecommendationRequest({
      choice: {
        desiredGenres: [maximumGenreName],
        explicitlyRequestedGenres: [maximumGenreName],
      },
    }).sanitizedInput.desiredGenres,
    [maximumGenreName],
  );

  assert.equal(
    request.resolveMvpRecommendationRequest(
      { scenario: "approval" },
      { allowScenario: true },
    ).scenario,
    "approval",
  );
});

test("JSON request bodies enforce the UTF-8 byte ceiling before parsing", async () => {
  const http = await loadModule("src/app/api/_shared/http.ts");
  const searchContract = await loadModule("src/contracts/mvp-search.ts");
  const oversizedBody = JSON.stringify({
    choice: { naturalLanguage: "가".repeat(6_000) },
  });
  assert.ok(
    new TextEncoder().encode(oversizedBody).byteLength >
      searchContract.MVP_RECOMMENDATION_REQUEST_MAX_BYTES,
  );

  await assert.rejects(
    http.readJsonObject(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: oversizedBody,
      }),
      { maximumBytes: searchContract.MVP_RECOMMENDATION_REQUEST_MAX_BYTES },
    ),
    (error) =>
      error instanceof http.ApiError &&
      error.status === 400 &&
      /바이트/.test(error.message),
  );

  assert.deepEqual(
    await http.readJsonObject(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: "{}",
      }),
      { maximumBytes: searchContract.MVP_RECOMMENDATION_REQUEST_MAX_BYTES },
    ),
    {},
  );
});

test("anonymous eligibility enforces age, provider, runtime, origin, and avoid genre", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const filtering = await loadModule("src/domains/catalog/filtering.ts");
  const input = request.resolveMvpRecommendationRequest({
    choice: {
      selectedProviders: ["NETFLIX"],
      companions: ["FRIENDS"],
      companionAvoidGenres: ["공포"],
      maxRuntimeMinutes: 120,
      originPreference: "KR",
    },
  }).sanitizedInput;

  assert.deepEqual(filtering.getFilterReasons(content(), input), []);
  assert.ok(
    filtering.getFilterReasons(content({ ageRating: "18" }), input)
      .includes("AGE_RESTRICTED"),
  );
  assert.ok(
    filtering.getFilterReasons(content({ ageRating: "UNKNOWN" }), input)
      .includes("RATING_UNKNOWN_FOR_MINOR"),
  );
  assert.ok(
    filtering.getFilterReasons(content({ runtimeMinutes: 121 }), input)
      .includes("RUNTIME_EXCEEDED"),
  );
  assert.ok(
    filtering.getFilterReasons(content({ originCountries: ["US"], productionCountries: ["US"] }), input)
      .includes("ORIGIN_MISMATCH"),
  );
  assert.ok(
    filtering.getFilterReasons(content({ providers: [{ provider: "TVING", watchUrl: "https://example.test", linkType: "HOME" }] }), input)
      .includes("UNSUBSCRIBED_PROVIDER"),
  );
  assert.ok(
    filtering.getFilterReasons(content({ genres: ["공포"] }), input)
      .includes("COMPANION_AVOID_GENRE"),
  );

  const explicitInput = {
    ...input,
    desiredGenres: ["공포"],
  };
  assert.equal(
    filtering.getFilterReasons(content({ genres: ["공포"] }), explicitInput)
      .includes("COMPANION_AVOID_GENRE"),
    false,
  );
});

test("local search produces deterministic privacy-safe continuation", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const local = await loadModule("src/adapters/search/local-search-adapter.ts");
  const semantic = await loadModule("src/domains/search/semantic.ts");
  const resolved = request.resolveMvpRecommendationRequest({
    choice: {
      moods: ["따뜻한"],
      naturalLanguage: "비 오는 날 위로받고 싶어요",
    },
  });
  const candidates = [
    content(),
    content({ id: "content-2", tmdbId: 2, title: "액션 영화", synopsis: "빠른 액션", moodTags: ["자극적인"], genres: ["액션"] }),
  ];
  const adapter = new local.LocalSearchAdapter();
  const initial = await adapter.search(
    { kind: "initial", input: resolved.transientInput },
    candidates,
  );
  assert.equal(initial.continuation.queryVector.dimensions, 64);
  assert.equal(initial.continuation.queryVector.values.every(Number.isFinite), true);
  assert.doesNotMatch(JSON.stringify(initial.continuation), /비 오는 날|위로받고/);
  assert.equal("matchedTerms" in initial.results[0], false);

  const continuation = await adapter.search(
    {
      kind: "continuation",
      input: resolved.sanitizedInput,
      continuation: JSON.parse(JSON.stringify(initial.continuation)),
    },
    candidates,
  );
  assert.deepEqual(
    continuation.results.map(({ content: item, semanticScore }) => [item.id, semanticScore]),
    initial.results.map(({ content: item, semanticScore }) => [item.id, semanticScore]),
  );
  await assert.rejects(() =>
    adapter.search(
      {
        kind: "continuation",
        input: { ...resolved.sanitizedInput, originPreference: "KR" },
        continuation: initial.continuation,
      },
      candidates,
    ),
  );
  assert.throws(() =>
    semantic.parseQueryVectorSnapshot({
      ...initial.continuation.queryVector,
      values: [Number.NaN],
    }),
  );
});

test("active score renormalizes absent genre weight without UserContext", async () => {
  const scoring = await loadModule("src/domains/recommendation/scoring.ts");
  const request = await loadModule("src/domains/recommendation/request.ts");
  const input = request.resolveMvpRecommendationRequest({}).sanitizedInput;
  const [item] = scoring.scoreMvpSearchResults(
    [{ content: content(), semanticScore: 0.8 }],
    input,
  );
  const expected =
    (0.8 * 0.15 + 0.5 * 0.29 + 0.7 * 0.15 + 0.5 * 0.1 + 0.7 * 0.05) /
    (1 - 0.26);
  assert.equal(item.scoreBreakdown.genre, 0);
  assert.equal(item.matchPercent, null);
  assert.ok(Math.abs(item.score - expected) < 1e-12);

  const [withMood] = scoring.scoreMvpSearchResults(
    [{ content: content({ moodTags: ["따뜻한"] }), semanticScore: 0.8 }],
    request.resolveMvpRecommendationRequest({
      choice: { moods: ["따뜻한"] },
    }).sanitizedInput,
  );
  assert.equal(typeof withMood.matchPercent, "number");
});

test("injected OpenAI and pgvector adapters validate dimensions and candidate allowlist", async () => {
  const embeddingModule = await loadModule("src/adapters/search/openai-embedding-client.ts");
  const pgvectorModule = await loadModule("src/adapters/search/pgvector-search-adapter.ts");
  const request = await loadModule("src/domains/recommendation/request.ts");
  const vector = Array.from({ length: 1536 }, (_, index) => index / 1536);
  let fetchRequest;
  const client = new embeddingModule.OpenAiEmbeddingClient({
    apiKey: "test-only-key",
    fetch: async (url, init) => {
      fetchRequest = { url, init };
      return Response.json({
        data: [{ embedding: vector }],
        usage: { total_tokens: 17 },
      });
    },
  });
  const embedded = await client.embed("따뜻한 작품");
  assert.equal(embedded.dimensions, 1536);
  assert.equal(embedded.tokenUsage, 17);
  const requestBody = JSON.parse(fetchRequest.init.body);
  assert.equal(requestBody.model, "text-embedding-3-small");
  assert.equal(requestBody.dimensions, 1536);

  const candidate = content();
  let queryCall;
  let embeddingCalls = 0;
  const adapter = new pgvectorModule.PgVectorSearchAdapter({
    embeddings: {
      async embed() {
        embeddingCalls += 1;
        return embedded;
      },
    },
    database: {
      async query(text, values) {
        queryCall = { text, values };
        return { rows: [{ contentId: candidate.id, semanticScore: 0.91 }] };
      },
    },
  });
  const resolved = request.resolveMvpRecommendationRequest({});
  const initial = await adapter.search(
    { kind: "initial", input: resolved.transientInput },
    [candidate],
  );
  assert.equal(initial.results[0].content.id, candidate.id);
  assert.equal(initial.modelCallCount, 1);
  assert.equal(initial.tokenUsage, 17);
  assert.equal(embeddingCalls, 1);
  assert.match(queryCall.text, /ANY\(\$2::text\[\]\)/);
  assert.equal(queryCall.text.includes(candidate.id), false);
  assert.deepEqual(queryCall.values[1], [candidate.id]);
  const persistedContinuation = JSON.parse(
    JSON.stringify(initial.continuation),
  );
  const originalValue = persistedContinuation.queryVector.values[1];
  persistedContinuation.queryVector.values[1] = Number(
    originalValue.toPrecision(15),
  );
  assert.notEqual(
    persistedContinuation.queryVector.values[1],
    originalValue,
  );
  const continued = await adapter.search(
    {
      kind: "continuation",
      input: resolved.sanitizedInput,
      continuation: persistedContinuation,
    },
    [candidate],
  );
  assert.equal(continued.modelCallCount, 0);
  assert.equal(continued.tokenUsage, 0);
  assert.equal(embeddingCalls, 1);

  const tamperedContinuation = structuredClone(persistedContinuation);
  tamperedContinuation.queryVector.values[1] += 0.000001;
  await assert.rejects(
    () =>
      adapter.search(
        {
          kind: "continuation",
          input: resolved.sanitizedInput,
          continuation: tamperedContinuation,
        },
        [candidate],
      ),
    /continuation does not match/,
  );

  const unsafeAdapter = new pgvectorModule.PgVectorSearchAdapter({
    embeddings: { async embed() { return embedded; } },
    database: { async query() { return { rows: [{ contentId: "outside", semanticScore: 1 }] }; } },
  });
  await assert.rejects(
    () => unsafeAdapter.search(
      { kind: "initial", input: resolved.transientInput },
      [candidate],
    ),
    /outside the candidate allowlist/,
  );
});
