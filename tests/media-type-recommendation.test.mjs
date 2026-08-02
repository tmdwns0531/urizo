import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const load = (relativePath) =>
  jiti.import(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));

const demoConfig = {
  appProfile: "demo",
  catalog: "fixture",
  search: "local",
  selector: "deterministic",
  runStore: "memory",
  traceStore: "memory",
};

const continuation = {
  queryVector: {
    algorithm: "local-hash-cosine-v1",
    version: 1,
    dimensions: 64,
    values: Array.from({ length: 64 }, () => 0.1),
  },
  inputFingerprint: `sha256:${"c".repeat(64)}`,
};

function content(id, tmdbId, mediaType) {
  return {
    id,
    tmdbId,
    title: id,
    synopsis: `${mediaType} media hard-filter regression fixture`,
    mediaType,
    runtimeMinutes: mediaType === "MOVIE" ? 100 : 35,
    releaseYear: 2026,
    genres: ["드라마"],
    moodTags: [],
    companionTags: ["ALONE"],
    ageRating: "12",
    originCountries: ["KR"],
    productionCountries: ["KR"],
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: `https://example.invalid/${id}`,
        linkType: "SEARCH",
      },
    ],
    collectionId: null,
    voteAverage: 8,
    voteCount: 1000,
    posterUrl: null,
    backdropColor: "#123456",
  };
}

const mixedCatalog = [
  content("movie-1", 101, "MOVIE"),
  content("series-semantic-king", 201, "SERIES"),
  content("movie-2", 102, "MOVIE"),
  content("series-2", 202, "SERIES"),
  content("movie-3", 103, "MOVIE"),
  content("series-3", 203, "SERIES"),
];

const semanticScores = new Map([
  ["series-semantic-king", 1],
  ["movie-1", 0.99],
  ["series-2", 0.98],
  ["movie-2", 0.97],
  ["series-3", 0.96],
  ["movie-3", 0.95],
]);

function searchInput(mediaType) {
  return {
    selectedProviders: ["NETFLIX"],
    companions: ["ANY"],
    moods: [],
    desiredGenres: [],
    companionAvoidGenres: [],
    requiredGenres: [],
    excludedGenres: [],
    mediaType,
    maxRuntimeMinutes: null,
    childAgeRatingLimit: null,
    originPreference: "ANY",
    hasNaturalLanguage: false,
  };
}

function initialInvocation(mediaType) {
  return {
    kind: "initial",
    input: {
      ...searchInput(mediaType),
      naturalLanguage: "",
    },
  };
}

function recommendationItem(itemContent) {
  return {
    content: itemContent,
    score: 1,
    matchPercent: 100,
    scoreBreakdown: {
      semantic: 1,
      mood: 0.5,
      genre: 0.5,
      runtime: 0.7,
      quality: 0.5,
      companion: 0.7,
      diversityPenalty: 0,
      total: 1,
    },
    reasons: ["합성 후보예요.", "최종 정책 재검사용이에요."],
  };
}

function createSearchSpy() {
  const calls = [];
  return {
    calls,
    adapter: {
      async search(_invocation, candidates) {
        calls.push([...candidates]);
        return {
          results: candidates.map((candidate) => ({
            content: candidate,
            semanticScore: semanticScores.get(candidate.id) ?? 0,
          })),
          continuation: structuredClone(continuation),
          modelCallCount: 0,
          tokenUsage: 0,
        };
      },
    },
  };
}

async function createComposition(catalog, search, selector) {
  const { createMvpComposition } = await load("src/composition/index.ts");
  return createMvpComposition({
    config: demoConfig,
    overrides: {
      catalog: { async list() { return [...catalog]; } },
      search,
      ...(selector ? { selector } : {}),
    },
  });
}

test("natural MOVIE and SERIES conditions filter before semantic search", async () => {
  for (const [naturalLanguage, expectedType] of [
    ["영화 추천해줘", "MOVIE"],
    ["시리즈 추천해줘", "SERIES"],
  ]) {
    const search = createSearchSpy();
    const composition = await createComposition(
      mixedCatalog,
      search.adapter,
    );

    try {
      const response = await composition.services.recommend({
        choice: { naturalLanguage },
      });
      assert.equal(response.status, "completed");
      assert.ok(response.recommendations.length > 0);
      assert.ok(
        response.recommendations.every(
          ({ content: candidate }) => candidate.mediaType === expectedType,
        ),
      );
      assert.equal(search.calls.length, 1);
      assert.ok(search.calls[0].length > 0);
      assert.ok(
        search.calls[0].every(
          (candidate) => candidate.mediaType === expectedType,
        ),
        "opposite media types must be removed before the search adapter",
      );
      const run = await composition.adapters.runs.get(response.runId);
      assert.equal(run.requestSnapshot.mediaType, expectedType);
    } finally {
      await composition.dispose();
    }
  }
});

test("an explicit ANY edit allows both types despite movie wording", async () => {
  const search = createSearchSpy();
  const composition = await createComposition(mixedCatalog, search.adapter);

  try {
    const response = await composition.services.recommend({
      choice: {
        naturalLanguage: "영화 추천해줘",
        mediaType: "ANY",
      },
    });
    assert.equal(response.status, "completed");
    assert.deepEqual(
      new Set(search.calls[0].map(({ mediaType }) => mediaType)),
      new Set(["MOVIE", "SERIES"]),
    );
    assert.deepEqual(
      new Set(
        response.recommendations.map(
          ({ content: candidate }) => candidate.mediaType,
        ),
      ),
      new Set(["MOVIE", "SERIES"]),
    );
    const run = await composition.adapters.runs.get(response.runId);
    assert.equal(run.requestSnapshot.mediaType, "ANY");
  } finally {
    await composition.dispose();
  }
});

test("rule-based fallback rechecks and preserves media type", async () => {
  const { ruleBasedFallback } = await load(
    "src/domains/recommendation/fallback.ts",
  );
  const result = ruleBasedFallback({
    eligibleCatalog: mixedCatalog,
    searchInput: searchInput("MOVIE"),
    continuation: structuredClone(continuation),
    excludedContentIds: [],
  });

  assert.ok(result.selected.length > 0);
  assert.ok(
    result.selected.every(({ content: candidate }) =>
      candidate.mediaType === "MOVIE"),
  );
  assert.ok(
    mixedCatalog
      .filter(({ mediaType }) => mediaType === "SERIES")
      .every(({ id }) => result.excludedContentIds.includes(id)),
  );
});

test("final policy blocks a mismatched selection without auto-relaxing", async () => {
  const { PolicyLayer } = await load(
    "src/domains/recommendation/policy.ts",
  );
  const rogueSeries = recommendationItem(
    mixedCatalog.find(({ mediaType }) => mediaType === "SERIES"),
  );
  const executor = {
    async execute() {
      return {
        kind: "success",
        result: {
          ranked: [rogueSeries],
          selected: [rogueSeries],
          excludedContentIds: [],
          eligibleCount: 1,
          continuation: structuredClone(continuation),
          executionMode: "OPENAI",
          fallbackUsed: false,
          fallbackReason: null,
          budgetSnapshot: {
            modelCalls: 1,
            toolCalls: 1,
            tokens: 10,
            elapsedMs: 1,
          },
          durationMs: 1,
        },
      };
    },
  };
  const policy = new PolicyLayer({ async list() { return mixedCatalog; } });
  const result = await policy.execute(
    "run-media-policy",
    initialInvocation("MOVIE"),
    executor,
    "normal",
    "configured",
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.recommendations, []);
  assert.deepEqual(result.execution.selected, []);
  assert.equal(result.policyBlockedCount, 1);
  assert.equal(result.noResult.code, "NO_MATCHING_CONTENT");
  assert.ok(result.noResult.availableActions.includes("ALLOW_ANY_MEDIA_TYPE"));
  assert.ok(
    result.traceEvents.some(({ action }) => action === "policy_block"),
  );
});

test("zero MOVIE candidates never cause SERIES auto-relaxation", async () => {
  const seriesOnlyCatalog = mixedCatalog.filter(
    ({ mediaType }) => mediaType === "SERIES",
  );
  const search = createSearchSpy();
  const composition = await createComposition(
    seriesOnlyCatalog,
    search.adapter,
  );

  try {
    const response = await composition.services.recommend({
      choice: { mediaType: "MOVIE" },
    });
    assert.equal(response.status, "completed");
    assert.deepEqual(search.calls, [[]]);
    assert.deepEqual(response.recommendations, []);
    assert.equal(response.noResult.code, "NO_MATCHING_CONTENT");
    assert.ok(
      response.noResult.availableActions.includes("ALLOW_ANY_MEDIA_TYPE"),
    );
    const run = await composition.adapters.runs.get(response.runId);
    assert.equal(run.requestSnapshot.mediaType, "MOVIE");
  } finally {
    await composition.dispose();
  }
});
