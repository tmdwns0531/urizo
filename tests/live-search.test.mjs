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
  assert.equal(resolved.transientInput.childAgeRatingLimit, null);
  assert.equal(resolved.transientInput.mediaType, "ANY");
  assert.deepEqual(resolved.transientInput.requiredGenres, []);
  assert.deepEqual(resolved.transientInput.excludedGenres, []);
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
  assert.equal(
    request.resolveMvpRecommendationRequest({
      choice: {
        companions: ["WITH_CHILDREN"],
        childAgeRatingLimit: "7",
      },
    }).choice.childAgeRatingLimit,
    "7",
  );
  const hardConditions = request.resolveMvpRecommendationRequest({
    choice: {
      mediaType: "SERIES",
      requiredGenres: ["코미디"],
      excludedGenres: ["공포"],
    },
  });
  assert.equal(hardConditions.sanitizedInput.mediaType, "SERIES");
  assert.deepEqual(hardConditions.sanitizedInput.requiredGenres, ["코미디"]);
  assert.deepEqual(hardConditions.sanitizedInput.excludedGenres, ["공포"]);

  const parsedNaturalMedia = request.resolveMvpRecommendationRequest({
    choice: { naturalLanguage: "아이와 한시간동안 볼 영화" },
  });
  assert.equal(parsedNaturalMedia.choice.mediaType, "MOVIE");
  assert.equal(parsedNaturalMedia.sanitizedInput.mediaType, "MOVIE");
  assert.equal(
    request.resolveMvpRecommendationRequest({
      choice: {
        naturalLanguage: "영화만 추천해줘",
        mediaType: "ANY",
      },
    }).sanitizedInput.mediaType,
    "ANY",
    "an explicit structured edit must take priority over natural source text",
  );

  const naturalOnly = request.resolveMvpRecommendationRequest({
    choice: {
      naturalLanguage:
        "혼자 넷플릭스에서 45분 안에 볼 따뜻한 한국 코미디 시리즈",
    },
  }).sanitizedInput;
  assert.deepEqual(naturalOnly.companions, ["ALONE"]);
  assert.deepEqual(naturalOnly.selectedProviders, ["NETFLIX"]);
  assert.deepEqual(naturalOnly.moods, ["따뜻한"]);
  assert.deepEqual(naturalOnly.desiredGenres, ["코미디"]);
  assert.equal(naturalOnly.maxRuntimeMinutes, 45);
  assert.equal(naturalOnly.originPreference, "KR");
  assert.equal(naturalOnly.mediaType, "SERIES");

  const explicitlyNeutral = request.resolveMvpRecommendationRequest({
    choice: {
      naturalLanguage:
        "혼자 넷플릭스에서 45분 안에 볼 따뜻한 한국 코미디 시리즈",
      selectedProviders: [
        "NETFLIX",
        "TVING",
        "DISNEY_PLUS",
        "WAVVE",
        "WATCHA",
        "COUPANG_PLAY",
      ],
      companions: ["ANY"],
      moods: [],
      desiredGenres: [],
      requiredGenres: [],
      excludedGenres: [],
      maxRuntimeMinutes: null,
      originPreference: "ANY",
      mediaType: "ANY",
    },
  }).sanitizedInput;
  assert.equal(explicitlyNeutral.selectedProviders.length, 6);
  assert.deepEqual(explicitlyNeutral.companions, ["ANY"]);
  assert.deepEqual(explicitlyNeutral.moods, []);
  assert.deepEqual(explicitlyNeutral.desiredGenres, []);
  assert.deepEqual(explicitlyNeutral.requiredGenres, []);
  assert.deepEqual(explicitlyNeutral.excludedGenres, []);
  assert.equal(explicitlyNeutral.maxRuntimeMinutes, null);
  assert.equal(explicitlyNeutral.originPreference, "ANY");
  assert.equal(explicitlyNeutral.mediaType, "ANY");

  assert.equal(
    request.resolveMvpRecommendationRequest({
      choice: {
        naturalLanguage: "혼자 45분 안에 볼 영화",
        maxRuntimeMinutes: 60,
        naturalRuntimeMinutes: 90,
      },
    }).sanitizedInput.maxRuntimeMinutes,
    90,
    "an exact natural runtime must take priority over the fixed preset field",
  );
  assert.equal(
    request.resolveMvpRecommendationRequest({
      choice: {
        naturalLanguage: "혼자 45분 안에 볼 영화",
        naturalRuntimeMinutes: null,
      },
    }).sanitizedInput.maxRuntimeMinutes,
    null,
    "an explicit null runtime must not be repopulated from source text",
  );

  for (const invalid of [
    { userId: "forbidden" },
    { scenario: "policy_block" },
    { choice: { unknown: true } },
    { choice: { companions: ["ALONE", "FRIENDS"] } },
    { choice: { moods: ["따뜻한", "따뜻한"] } },
    { choice: { maxRuntimeMinutes: 45 } },
    { choice: { naturalRuntimeMinutes: 0 } },
    { choice: { naturalRuntimeMinutes: 181 } },
    { choice: { naturalRuntimeMinutes: 1.5 } },
    { choice: { naturalRuntimeMinutes: "45" } },
    { choice: { mediaType: "SHORT_FORM" } },
    { choice: { requiredGenres: ["코미디", "코미디"] } },
    { choice: { excludedGenres: "공포" } },
    { choice: { requiredGenres: ["코미디"], excludedGenres: ["코미디"] } },
    { choice: { childAgeRatingLimit: "16" } },
    { choice: { companions: ["FAMILY"], childAgeRatingLimit: "7" } },
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

test("family clarification distinguishes structured adults from unresolved families", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const conversation = await loadModule(
    "src/domains/recommendation/agent/conversation.ts",
  );

  const structuredFamily = request.resolveMvpRecommendationRequest({
    choice: { companions: ["FAMILY"] },
  }).transientInput;
  assert.equal(conversation.createFamilyClarification(structuredFamily), null);

  const structuredChildren = request.resolveMvpRecommendationRequest({
    choice: { companions: ["WITH_CHILDREN"] },
  }).transientInput;
  assert.equal(
    conversation.createFamilyClarification(structuredChildren)?.kind,
    "FAMILY_COMPOSITION",
  );

  const naturalFamily = request.resolveMvpRecommendationRequest({
    choice: { naturalLanguage: "가족과 함께 볼 따뜻한 영화" },
  }).transientInput;
  assert.equal(
    conversation.createFamilyClarification(naturalFamily)?.kind,
    "FAMILY_COMPOSITION",
  );

  const editedToAlone = request.resolveMvpRecommendationRequest({
    choice: {
      naturalLanguage: "가족과 함께 볼 따뜻한 영화",
      companions: ["ALONE"],
    },
  }).transientInput;
  assert.equal(
    conversation.createFamilyClarification(editedToAlone),
    null,
    "a structured companion edit must beat stale family wording",
  );

  const neutralInput = request.resolveMvpRecommendationRequest({
    choice: {
      naturalLanguage:
        "혼자 넷플릭스에서 45분 안에 볼 따뜻한 한국 코미디 영화",
      selectedProviders: [
        "NETFLIX",
        "TVING",
        "DISNEY_PLUS",
        "WAVVE",
        "WATCHA",
        "COUPANG_PLAY",
      ],
      companions: ["ANY"],
      moods: [],
      desiredGenres: [],
      requiredGenres: [],
      excludedGenres: [],
      maxRuntimeMinutes: null,
      originPreference: "ANY",
      mediaType: "ANY",
    },
  }).transientInput;
  assert.deepEqual(
    conversation.structureAgentInput(neutralInput),
    neutralInput,
    "the Agent preparation step must not re-infer explicit neutral values",
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

test("anonymous eligibility enforces all hard catalog conditions", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const filtering = await loadModule("src/domains/catalog/filtering.ts");
  const input = request.resolveMvpRecommendationRequest({
    choice: {
      selectedProviders: ["NETFLIX"],
      companions: ["FRIENDS"],
      companionAvoidGenres: ["공포"],
      requiredGenres: ["드라마"],
      excludedGenres: ["다큐멘터리"],
      mediaType: "MOVIE",
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
  assert.ok(
    filtering
      .getFilterReasons(content({ mediaType: "SERIES" }), input)
      .includes("MEDIA_TYPE_MISMATCH"),
  );
  const seriesInput = {
    ...input,
    mediaType: "SERIES",
  };
  assert.equal(
    filtering
      .getFilterReasons(content({ mediaType: "SERIES" }), seriesInput)
      .includes("MEDIA_TYPE_MISMATCH"),
    false,
  );
  assert.ok(
    filtering
      .getFilterReasons(content({ mediaType: "MOVIE" }), seriesInput)
      .includes("MEDIA_TYPE_MISMATCH"),
  );
  assert.ok(
    filtering
      .getFilterReasons(content({ genres: ["코미디"] }), input)
      .includes("REQUIRED_GENRE_MISMATCH"),
  );
  assert.ok(
    filtering
      .getFilterReasons(content({ genres: ["드라마", "다큐멘터리"] }), input)
      .includes("EXCLUDED_GENRE"),
  );
  assert.deepEqual(
    filtering.getFilterReasons(content({ mediaType: "SERIES" }), {
      ...input,
      mediaType: "ANY",
    }),
    [],
    "ANY는 영화와 시리즈를 모두 허용해야 한다",
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

  const childInput = request.resolveMvpRecommendationRequest({
    choice: {
      companions: ["WITH_CHILDREN"],
      childAgeRatingLimit: "7",
    },
  }).sanitizedInput;
  assert.deepEqual(
    filtering.getFilterReasons(content({ ageRating: "7" }), childInput),
    [],
  );
  assert.ok(
    filtering.getFilterReasons(content({ ageRating: "12" }), childInput)
      .includes("AGE_RESTRICTED"),
  );
  assert.ok(
    filtering
      .getFilterReasons(content({ ageRating: "ALL" }), {
        ...childInput,
        childAgeRatingLimit: null,
      })
      .includes("AGE_RESTRICTED"),
    "아이 관람등급 상한이 없으면 검색 정책은 fail closed여야 한다",
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

  const legacySanitizedInput = { ...resolved.sanitizedInput };
  delete legacySanitizedInput.childAgeRatingLimit;
  delete legacySanitizedInput.mediaType;
  delete legacySanitizedInput.requiredGenres;
  delete legacySanitizedInput.excludedGenres;
  assert.equal(
    await semantic.createInputFingerprint(
      legacySanitizedInput,
      initial.continuation.queryVector,
    ),
    initial.continuation.inputFingerprint,
    "등급 상한이 없는 기존 Run의 fingerprint 형식은 유지되어야 한다",
  );
  assert.notEqual(
    await semantic.createInputFingerprint(
      {
        ...resolved.sanitizedInput,
        companions: ["WITH_CHILDREN"],
        childAgeRatingLimit: "7",
      },
      initial.continuation.queryVector,
    ),
    initial.continuation.inputFingerprint,
  );
  assert.equal(
    await semantic.createInputFingerprint(
      { ...resolved.sanitizedInput, mediaType: "ANY" },
      initial.continuation.queryVector,
    ),
    initial.continuation.inputFingerprint,
    "default ANY는 기존 fingerprint를 바꾸지 않아야 한다",
  );
  assert.notEqual(
    await semantic.createInputFingerprint(
      { ...resolved.sanitizedInput, mediaType: "MOVIE" },
      initial.continuation.queryVector,
    ),
    initial.continuation.inputFingerprint,
    "명시적 작품 유형은 continuation fingerprint에 결합되어야 한다",
  );
  assert.notEqual(
    await semantic.createInputFingerprint(
      { ...resolved.sanitizedInput, excludedGenres: ["공포"] },
      initial.continuation.queryVector,
    ),
    initial.continuation.inputFingerprint,
    "명시적 제외 장르는 continuation fingerprint에 결합되어야 한다",
  );

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

test("structured semantic query keeps positive media and required-genre parity", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const query = await loadModule("src/domains/search/query.ts");
  const resolved = request.resolveMvpRecommendationRequest({
    choice: {
      mediaType: "SERIES",
      desiredGenres: ["드라마"],
      requiredGenres: ["코미디"],
      excludedGenres: ["공포"],
    },
  });
  const text = query.buildMvpSearchQuery(resolved.transientInput);
  assert.match(text, /시리즈/);
  assert.match(text, /드라마/);
  assert.match(text, /코미디/);
  assert.doesNotMatch(
    text,
    /공포/,
    "negative genre tokens must not increase semantic similarity",
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
  // runtime 항목은 시청 시간을 고르지 않으면 1 이다. 예전에는 0.7 을 박아
  // 넣어, 조건을 덜 건 사람이 오히려 감점을 받았다 (무제한이면 전체가 73%
  // 근처에서 막히고 120분을 고르면 80%대가 나왔다).
  const expected =
    (0.8 * 0.15 + 0.5 * 0.29 + 1 * 0.15 + 0.5 * 0.1 + 0.7 * 0.05) /
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
