import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadStandaloneModule(relativePath) {
  const sourceUrl = new URL(`../${relativePath}`, import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const encoded = Buffer.from(outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const content = (id, title, score) => ({
  content: {
    id,
    tmdbId: Number(id.replace(/\D/g, "")) || 1,
    title,
    synopsis: "This text must never be sent to the selector.",
    mediaType: "MOVIE",
    runtimeMinutes: 100,
    releaseYear: 2025,
    genres: ["Drama"],
    moodTags: ["CALM"],
    companionTags: ["ANY"],
    ageRating: "12",
    originCountries: ["KR"],
    productionCountries: ["KR"],
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.invalid/watch",
        linkType: "DIRECT",
      },
    ],
    collectionId: null,
    voteAverage: 8.2,
    voteCount: 500,
    posterUrl: null,
    backdropColor: "#000000",
  },
  score,
  matchPercent: Math.round(score * 100),
  scoreBreakdown: {
    semantic: score,
    mood: 0.5,
    genre: 0.5,
    runtime: 0.7,
    quality: 0.8,
    companion: 0.7,
    diversityPenalty: 0,
    total: score,
  },
  reasons: ["Existing factual reason."],
});

const EXPECTED_STRUCTURED_REASON =
  "Drama \uc7a5\ub974 \ucde8\ud5a5\uc5d0 \uc798 \ub9de\uc544\uc694. " +
  "\ub137\ud50c\ub9ad\uc2a4\uc5d0\uc11c \uc2dc\uccad\ud560 \uc218 \uc788\uc5b4\uc694. " +
  "100\ubd84 \ubd84\ub7c9\uc73c\ub85c \uc2dc\uccad \uc2dc\uac04 \uc870\uac74\uc5d0 \uc798 \ub9de\uc544\uc694.";

test("deterministic selector is async, stable, and de-duplicates IDs", async () => {
  const { DeterministicSelectorAdapter } = await loadStandaloneModule(
    "src/adapters/recommendation/deterministic-selector-adapter.ts",
  );
  const selector = new DeterministicSelectorAdapter();
  const duplicate = content("content_1", "Zulu", 0.9);
  const output = await selector.select(
    [
      content("content_2", "Beta", 0.9),
      duplicate,
      content("content_1", "Alpha", 0.9),
    ],
    5,
  );

  assert.deepEqual(output, {
    selectedIds: ["content_1", "content_2"],
    tokenUsage: 0,
  });
});

test("OpenAI selector uses Responses structured output with minimal facts", async () => {
  const { OpenAiSelectorAdapter } = await loadStandaloneModule(
    "src/adapters/recommendation/openai-selector-adapter.ts",
  );
  let capturedInit;
  const selector = new OpenAiSelectorAdapter({
    apiKey: "test-key",
    model: "gpt-5.6-terra",
    fetchImplementation: async (_url, init) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            output_text: JSON.stringify({
              selectedIds: ["content_2", "content_1"],
              topPickEvidence: {
                genre: "Drama",
                provider: "NETFLIX",
                runtimeMinutes: 100,
              },
            }),
            usage: {
              input_tokens: 80,
              output_tokens: 20,
              total_tokens: 100,
            },
          };
        },
      };
    },
  });

  const output = await selector.select(
    [
      content("content_1", "First", 0.8),
      content("content_2", "Second", 0.9),
    ],
    2,
  );

  assert.deepEqual(output, {
    selectedIds: ["content_2", "content_1"],
    topPickReason: EXPECTED_STRUCTURED_REASON,
    tokenUsage: 100,
  });
  assert.ok(output.topPickReason.length <= 180);
  const body = JSON.parse(capturedInit.body);
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: "none" });
  assert.equal("temperature" in body, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.text.format.schema.required, [
    "selectedIds",
    "topPickEvidence",
  ]);
  const selectedIdsSchema = body.text.format.schema.properties.selectedIds;
  assert.equal(selectedIdsSchema.items.type, "string");
  assert.equal("uniqueItems" in selectedIdsSchema, false);
  const evidenceSchema = body.text.format.schema.properties.topPickEvidence;
  assert.equal(evidenceSchema.additionalProperties, false);
  assert.deepEqual(evidenceSchema.required, [
    "genre",
    "provider",
    "runtimeMinutes",
  ]);
  assert.deepEqual(evidenceSchema.properties.genre.type, ["string", "null"]);
  assert.deepEqual(evidenceSchema.properties.provider.type, ["string", "null"]);
  assert.deepEqual(evidenceSchema.properties.runtimeMinutes.type, [
    "integer",
    "null",
  ]);
  assert.equal("topPickReason" in body.text.format.schema.properties, false);
  const userPayload = JSON.parse(body.input[1].content[0].text);
  assert.deepEqual(
    Object.keys(userPayload.candidates[0]).sort(),
    [
      "genres",
      "id",
      "matchPercent",
      "moods",
      "providers",
      "runtimeMinutes",
      "score",
      "title",
      "voteAverage",
    ],
  );
  assert.equal(
    JSON.stringify(userPayload).includes(
      "This text must never be sent",
    ),
    false,
  );
});

test("OpenAI selector rejects out-of-allowlist output without raw leakage", async () => {
  const {
    OpenAiSelectorAdapter,
    RecommendationSelectorInvalidOutputError,
  } = await loadStandaloneModule(
    "src/adapters/recommendation/openai-selector-adapter.ts",
  );
  const selector = new OpenAiSelectorAdapter({
    apiKey: "test-key",
    model: "gpt-5.6-terra",
    fetchImplementation: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          output_text: JSON.stringify({
            selectedIds: ["outside_allowlist"],
            topPickEvidence: {
              genre: null,
              provider: null,
              runtimeMinutes: null,
            },
          }),
          usage: { total_tokens: 23 },
        };
      },
    }),
  });

  await assert.rejects(
    selector.select([content("content_1", "First", 0.8)], 1),
    (error) => {
      assert.ok(
        error instanceof RecommendationSelectorInvalidOutputError,
      );
      assert.equal(error.tokenUsage, 23);
      assert.equal(
        error.message.includes("outside_allowlist"),
        false,
      );
      return true;
    },
  );
});

test("OpenAI selector rejects unsupported, all-null evidence and duplicate IDs", async () => {
  const {
    OpenAiSelectorAdapter,
    RecommendationSelectorInvalidOutputError,
  } = await loadStandaloneModule(
    "src/adapters/recommendation/openai-selector-adapter.ts",
  );
  const candidate = content("content_1", "First", 0.8);
  const secondCandidate = content("content_2", "Second", 0.7);

  for (const modelOutput of [
    {
      selectedIds: ["content_1"],
      topPickEvidence: {
        genre: "Hallucinated Genre",
        provider: "NETFLIX",
        runtimeMinutes: 100,
      },
    },
    {
      selectedIds: ["content_1"],
      topPickEvidence: {
        genre: "Drama",
        provider: "TVING",
        runtimeMinutes: 100,
      },
    },
    {
      selectedIds: ["content_1"],
      topPickEvidence: {
        genre: "Drama",
        provider: "NETFLIX",
        runtimeMinutes: 101,
      },
    },
    {
      selectedIds: ["content_1", "content_1"],
      topPickEvidence: {
        genre: "Drama",
        provider: "NETFLIX",
        runtimeMinutes: 100,
      },
    },
    {
      selectedIds: ["content_1"],
      topPickEvidence: {
        genre: null,
        provider: null,
        runtimeMinutes: null,
      },
    },
  ]) {
    const selector = new OpenAiSelectorAdapter({
      apiKey: "test-key",
      model: "gpt-5.6-terra",
      fetchImplementation: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            output_text: JSON.stringify(modelOutput),
            usage: { total_tokens: 29 },
          };
        },
      }),
    });

    await assert.rejects(
      selector.select([candidate, secondCandidate], 2),
      (error) => {
        assert.ok(error instanceof RecommendationSelectorInvalidOutputError);
        assert.equal(error.tokenUsage, 29);
        assert.equal(error.message.includes("Hallucinated Genre"), false);
        return true;
      },
    );
  }
});

test("OpenAI selector timeout and transport errors are sanitized", async () => {
  const {
    OpenAiSelectorAdapter,
    RecommendationSelectorModelError,
    RecommendationSelectorTimeoutError,
  } = await loadStandaloneModule(
    "src/adapters/recommendation/openai-selector-adapter.ts",
  );
  const candidate = content("content_1", "First", 0.8);

  let timeoutAbortObserved = false;
  const timeoutSelector = new OpenAiSelectorAdapter({
    apiKey: "test-key",
    model: "gpt-5.6-terra",
    timeoutMs: 10,
    fetchImplementation: async (_url, init) =>
      new Promise((_resolve, reject) => {
        const requestSignal = init?.signal;
        if (!requestSignal) {
          reject(new Error("missing abort signal"));
          return;
        }
        const rejectOnAbort = () => {
          timeoutAbortObserved = true;
          const abortError = new Error("abort-aware-provider");
          abortError.name = "AbortError";
          reject(abortError);
        };
        if (requestSignal.aborted) rejectOnAbort();
        else requestSignal.addEventListener("abort", rejectOnAbort, { once: true });
      }),
  });
  await assert.rejects(
    timeoutSelector.select([candidate], 1),
    RecommendationSelectorTimeoutError,
  );
  assert.equal(timeoutAbortObserved, true);


  const failingSelector = new OpenAiSelectorAdapter({
    apiKey: "test-key",
    model: "gpt-5.6-terra",
    fetchImplementation: async () => {
      throw new Error("raw-provider-secret");
    },
  });
  await assert.rejects(
    failingSelector.select([candidate], 1),
    (error) => {
      assert.ok(error instanceof RecommendationSelectorModelError);
      assert.equal(
        error.message.includes("raw-provider-secret"),
        false,
      );
      return true;
    },
  );
});

test("BudgetCounter aborts expired work and measures model token usage", async () => {
  const { BudgetCounter, BudgetExceededError } =
    await loadStandaloneModule(
      "src/domains/recommendation/budget.ts",
    );
  const budget = new BudgetCounter({
    modelCalls: 1,
    toolCalls: 0,
    tokens: 100,
    elapsedMs: 1_000,
  });

  let toolWasAborted = false;
  const toolBudget = new BudgetCounter({
    modelCalls: 0,
    toolCalls: 1,
    tokens: 0,
    elapsedMs: 10,
  });
  await assert.rejects(
    toolBudget.runTool(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            toolWasAborted = true;
            reject(signal.reason);
          });
        }),
    ),
    BudgetExceededError,
  );
  assert.equal(toolWasAborted, true);

  await assert.rejects(
    budget.runModel(
      async () => ({ tokenUsage: 101 }),
      (result) => result.tokenUsage,
    ),
    (error) => {
      assert.ok(error instanceof BudgetExceededError);
      assert.equal(error.snapshot.modelCalls, 1);
      assert.equal(error.snapshot.tokens, 101);
      return true;
    },
  );
});
