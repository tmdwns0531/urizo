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
  maxRuntimeMinutes: null,
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
    2,
  );
  assert.doesNotMatch(nonReplacementBody, /["']ranked["']/);
});
