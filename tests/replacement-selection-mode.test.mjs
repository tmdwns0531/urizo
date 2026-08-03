import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const load = (relativePath) =>
  jiti.import(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));

const content = (id, voteAverage) => ({
  id,
  tmdbId: Number(id.replace(/\D/g, "")) || 1,
  title: `Title ${id}`,
  synopsis: "A catalog synopsis used only by the local test fixture.",
  mediaType: "MOVIE",
  runtimeMinutes: 90,
  releaseYear: 2026,
  genres: ["Drama"],
  moodTags: ["CALM"],
  companionTags: ["ANY"],
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
  voteAverage,
  voteCount: 100,
  posterUrl: null,
  backdropColor: "#000000",
});

const searchInput = {
  selectedProviders: ["NETFLIX"],
  companions: ["ANY"],
  moods: [],
  desiredGenres: [],
  companionAvoidGenres: [],
  requiredGenres: [],
  excludedGenres: [],
  mediaType: "ANY",
  maxRuntimeMinutes: null,
  childAgeRatingLimit: null,
  originPreference: "ANY",
  hasNaturalLanguage: false,
};

const continuation = {
  queryVector: {
    algorithm: "local-hash-cosine-v1",
    version: 1,
    dimensions: 64,
    values: Array(64).fill(0),
  },
  inputFingerprint: `sha256:${"a".repeat(64)}`,
};

test("OpenAI 이유는 TOP1의 룰 기반 이유와 병합되고 TOP5는 유지된다", async () => {
  const [{ PipelineRecommendationExecutor }, { BudgetCounter }] =
    await Promise.all([
      load(
        "src/domains/recommendation/executors/pipeline-recommendation-executor.ts",
      ),
      load("src/domains/recommendation/budget.ts"),
    ]);
  const contents = Array.from({ length: 6 }, (_, index) =>
    content(`content-${index + 1}`, 8.5 - index * 0.1),
  );
  const openAiReason = "OpenAI 확인: Drama 장르의 90분 작품이에요.";
  const executor = new PipelineRecommendationExecutor(
    { async list() { return contents; }, async getById() { return null; } },
    {
      async search(_invocation, candidates) {
        return {
          results: candidates.map((item, index) => ({
            content: item,
            semanticScore: 0.9 - index * 0.05,
          })),
          continuation,
          modelCallCount: 0,
          tokenUsage: 0,
        };
      },
    },
    {
      async select(candidates) {
        return {
          selectedIds: candidates
            .slice(0, 5)
            .map(({ content: item }) => item.id),
          topPickReason: openAiReason,
          tokenUsage: 12,
        };
      },
    },
    { executionMode: "OPENAI", resultLimit: 5 },
  );

  const attempt = await executor.execute({
    runId: "run-openai-reasons",
    searchInvocation: {
      kind: "continuation",
      input: searchInput,
      continuation,
    },
    budget: new BudgetCounter({
      modelCalls: 2,
      toolCalls: 4,
      tokens: 1_000,
      elapsedMs: 5_000,
    }),
    selectionMode: "configured",
  });

  assert.equal(attempt.kind, "success");
  assert.equal(attempt.result.selected.length, 5, "TOP5는 유지되어야 한다");
  const [topPick, ...alternatives] = attempt.result.selected;
  assert.equal(topPick.reasons[0], openAiReason);
  assert.ok(topPick.reasons.length >= 2, "TOP1 이유는 최소 2개여야 한다");
  assert.ok(topPick.reasons.length <= 3, "TOP1 이유는 최대 3개여야 한다");
  assert.ok(
    topPick.reasons.slice(1).some((reason) => reason.includes("NETFLIX")),
    "OpenAI 이유 뒤에 룰 기반 이유가 병합되어야 한다",
  );
  for (const alternative of alternatives) {
    assert.ok(
      !alternative.reasons.includes(openAiReason),
      "OpenAI 이유는 TOP1에만 적용되어야 한다",
    );
  }
});

test("ranked selection skips the configured selector and its model budget", async () => {
  const [{ PipelineRecommendationExecutor }, { BudgetCounter }] =
    await Promise.all([
      load(
        "src/domains/recommendation/executors/pipeline-recommendation-executor.ts",
      ),
      load("src/domains/recommendation/budget.ts"),
    ]);
  const contents = [
    content("content-1", 8.4),
    content("content-2", 7.9),
    content("content-3", 7.3),
  ];
  let selectorCalls = 0;
  const selector = {
    async select(candidates) {
      selectorCalls += 1;
      return {
        selectedIds: candidates.slice(0, 2).map(({ content: item }) => item.id),
        tokenUsage: 11,
      };
    },
  };
  const executor = new PipelineRecommendationExecutor(
    { async list() { return contents; }, async getById() { return null; } },
    {
      async search(_invocation, candidates) {
        return {
          results: candidates.map((item, index) => ({
            content: item,
            semanticScore: 0.9 - index * 0.1,
          })),
          continuation,
          modelCallCount: 0,
          tokenUsage: 0,
        };
      },
    },
    selector,
    { executionMode: "OPENAI", resultLimit: 2 },
  );
  const limits = {
    modelCalls: 2,
    toolCalls: 4,
    tokens: 1_000,
    elapsedMs: 5_000,
  };
  const rankedAttempt = await executor.execute({
    runId: "run-replacement",
    searchInvocation: {
      kind: "continuation",
      input: searchInput,
      continuation,
    },
    budget: new BudgetCounter(limits),
    selectionMode: "ranked",
  });

  assert.equal(rankedAttempt.kind, "success");
  assert.equal(selectorCalls, 0);
  assert.deepEqual(
    rankedAttempt.result.selected.map(({ content: item }) => item.id),
    rankedAttempt.result.ranked
      .slice(0, 2)
      .map(({ content: item }) => item.id),
  );
  assert.equal(rankedAttempt.result.budgetSnapshot.modelCalls, 0);
  assert.equal(rankedAttempt.result.budgetSnapshot.tokens, 0);
  assert.equal(rankedAttempt.result.budgetSnapshot.toolCalls, 2);

  const configuredAttempt = await executor.execute({
    runId: "run-normal",
    searchInvocation: {
      kind: "continuation",
      input: searchInput,
      continuation,
    },
    budget: new BudgetCounter(limits),
    selectionMode: "configured",
  });
  assert.equal(configuredAttempt.kind, "success");
  assert.equal(selectorCalls, 1);
  assert.equal(configuredAttempt.result.budgetSnapshot.modelCalls, 1);
  assert.equal(configuredAttempt.result.budgetSnapshot.tokens, 11);
});

test("Pipeline과 searchCatalog는 의미 검색 전에 작품 유형을 hard filter한다", async () => {
  const [
    { PipelineRecommendationExecutor },
    { BudgetCounter },
    { createSearchCatalogTool },
  ] = await Promise.all([
    load(
      "src/domains/recommendation/executors/pipeline-recommendation-executor.ts",
    ),
    load("src/domains/recommendation/budget.ts"),
    load("src/domains/recommendation/tools/search-catalog-tool.ts"),
  ]);
  const movie = content("content-movie", 7.5);
  const series = {
    ...content("content-series", 10),
    mediaType: "SERIES",
  };
  const catalog = {
    async list() {
      return [movie, series];
    },
    async getById() {
      return null;
    },
  };
  const seenCandidateTypes = [];
  const search = {
    async search(_invocation, candidates) {
      seenCandidateTypes.push(candidates.map((item) => item.mediaType));
      return {
        results: candidates.map((item) => ({
          content: item,
          semanticScore: item.mediaType === "SERIES" ? 1 : 0.1,
        })),
        continuation,
        modelCallCount: 0,
        tokenUsage: 0,
      };
    },
  };
  const selector = {
    async select(candidates) {
      return {
        selectedIds: candidates.map(({ content: item }) => item.id),
        tokenUsage: 0,
      };
    },
  };
  const executor = new PipelineRecommendationExecutor(
    catalog,
    search,
    selector,
  );
  const movieInput = { ...searchInput, mediaType: "MOVIE" };
  const pipelineAttempt = await executor.execute({
    runId: "run-media-pipeline",
    searchInvocation: {
      kind: "continuation",
      input: movieInput,
      continuation,
    },
    budget: new BudgetCounter({
      modelCalls: 2,
      toolCalls: 4,
      tokens: 1_000,
      elapsedMs: 5_000,
    }),
    selectionMode: "configured",
  });
  assert.equal(pipelineAttempt.kind, "success");
  assert.deepEqual(seenCandidateTypes[0], ["MOVIE"]);
  assert.ok(
    pipelineAttempt.result.ranked.every(
      ({ content: item }) => item.mediaType === "MOVIE",
    ),
  );

  const searchCatalog = createSearchCatalogTool(catalog, search);
  const toolOutput = await searchCatalog.execute({
    invocation: {
      kind: "continuation",
      input: { ...searchInput, mediaType: "SERIES" },
      continuation,
    },
  });
  assert.deepEqual(seenCandidateTypes[1], ["SERIES"]);
  assert.ok(
    toolOutput.ranked.every(
      ({ content: item }) => item.mediaType === "SERIES",
    ),
  );
});

test("최종 Policy는 selector의 작품 유형 위반을 차단하고 noResult를 구조화한다", async () => {
  const [
    { PipelineRecommendationExecutor },
    { PolicyLayer },
  ] = await Promise.all([
    load(
      "src/domains/recommendation/executors/pipeline-recommendation-executor.ts",
    ),
    load("src/domains/recommendation/policy.ts"),
  ]);
  const movie = content("content-safe-movie", 7.5);
  const mismatchedSeries = {
    ...content("content-rogue-series", 10),
    mediaType: "SERIES",
  };
  const catalog = {
    async list() {
      return [movie];
    },
    async getById() {
      return null;
    },
  };
  const executor = new PipelineRecommendationExecutor(
    catalog,
    {
      async search() {
        return {
          // A hostile/buggy adapter returns a row outside the filtered media
          // allowlist. Final Policy must remain the independent safety net.
          results: [{ content: mismatchedSeries, semanticScore: 1 }],
          continuation,
          modelCallCount: 0,
          tokenUsage: 0,
        };
      },
    },
    {
      async select(candidates) {
        return {
          selectedIds: candidates.map(({ content: item }) => item.id),
          tokenUsage: 0,
        };
      },
    },
    { executionMode: "OPENAI" },
  );
  const result = await new PolicyLayer(catalog).execute(
    "run-final-media-policy",
    {
      kind: "continuation",
      input: { ...searchInput, mediaType: "MOVIE" },
      continuation,
    },
    executor,
    "normal",
    "configured",
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.recommendations, []);
  assert.equal(result.policyBlockedCount, 1);
  assert.deepEqual(result.noResult, {
    code: "NO_MATCHING_CONTENT",
    message: "현재 조건을 모두 만족하는 작품이 없어요.",
    availableActions: ["ALLOW_ANY_MEDIA_TYPE", "REENTER_CONDITIONS"],
  });
  assert.ok(
    result.traceEvents.some(
      (event) =>
        event.action === "filter" && event.publicMessage.includes("영화만"),
    ),
  );
  assert.ok(
    result.traceEvents.some((event) => event.action === "policy_block"),
  );
});

test("only replacement requests ranked selection from the policy layer", async () => {
  const source = await readFile(
    new URL("../src/domains/recommendation/orchestrator.ts", import.meta.url),
    "utf8",
  );
  const replacementBody = source.slice(
    source.indexOf("  async replace("),
    source.indexOf("  async resetForDemo("),
  );
  const nonReplacementBody =
    source.slice(0, source.indexOf("  async replace(")) +
    source.slice(source.indexOf("  async resetForDemo("));

  assert.match(
    replacementBody,
    /policy\.execute\([\s\S]*?this\.dependencies\.executor,\s*["']normal["'],\s*["']ranked["']/,
  );
  assert.equal(
    [...nonReplacementBody.matchAll(/["']configured["']/g)].length,
    3,
  );
  assert.doesNotMatch(nonReplacementBody, /["']ranked["']/);
});
