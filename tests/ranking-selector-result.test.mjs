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

/**
 * 합성 후보. 한 축만 바꿔 비교할 수 있도록 나머지 필드는 전부 동일하게 둔다.
 */
function content(overrides = {}) {
  return {
    id: "content-base",
    tmdbId: 1,
    title: "기준 작품",
    synopsis: "회귀 테스트용 합성 작품",
    mediaType: "MOVIE",
    runtimeMinutes: 100,
    releaseYear: 2024,
    genres: ["드라마"],
    moodTags: [],
    companionTags: ["ALONE"],
    ageRating: "12",
    originCountries: ["KR"],
    productionCountries: ["KR"],
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.invalid/watch",
        linkType: "SEARCH",
      },
    ],
    collectionId: null,
    voteAverage: 8,
    voteCount: 1000,
    posterUrl: null,
    backdropColor: "#123456",
    ...overrides,
  };
}

function searchInput(overrides = {}) {
  return {
    selectedProviders: ["NETFLIX"],
    companions: ["ALONE"],
    moods: ["밝은"],
    desiredGenres: [],
    companionAvoidGenres: [],
    maxRuntimeMinutes: null,
    originPreference: "ANY",
    hasNaturalLanguage: false,
    ...overrides,
  };
}

const MOOD_REASON = /분위기와 잘 맞아요/;

/**
 * 조건 6의 전제. 안전한 재고가 이 수를 넘겨야 TOP5 와 첫 교체가 모두
 * 분위기 안에서 돌아간다. 재고가 모자란 상태의 불일치는 scoring 결함이
 * 아니라 담당 2 CAT-01 의 데이터 문제다.
 */
const REQUIRED_SAFE_INVENTORY = 6;

test("일반 점수 계산은 추천 이유를 2~3개로 보장한다", async () => {
  const { scoreMvpSearchResults } = await loadModule(
    "src/domains/recommendation/scoring.ts",
  );

  const [item] = scoreMvpSearchResults(
    [
      {
        content: content({ genres: [], moodTags: [] }),
        semanticScore: 0.5,
      },
    ],
    searchInput({
      companions: ["ANY"],
      moods: [],
      desiredGenres: [],
      maxRuntimeMinutes: null,
    }),
  );

  assert.ok(item.reasons.length >= 2, "추천 이유는 최소 2개여야 한다");
  assert.ok(item.reasons.length <= 3, "추천 이유는 최대 3개여야 한다");
  assert.equal(
    new Set(item.reasons).size,
    item.reasons.length,
    "추천 이유가 중복되면 안 된다",
  );
});

test("mood 일치 작품이 불일치 작품보다 mood 점수가 높다", async () => {
  const { scoreMvpSearchResults } = await loadModule(
    "src/domains/recommendation/scoring.ts",
  );

  // semanticScore, 평점, 표수, 러닝타임, 동반자까지 전부 동일하다.
  // 다른 것은 moodTags 하나뿐이다.
  const results = [
    {
      content: content({ id: "match", title: "일치", moodTags: ["밝은"] }),
      semanticScore: 0.5,
    },
    {
      content: content({ id: "miss", title: "불일치", moodTags: ["어두운"] }),
      semanticScore: 0.5,
    },
  ];

  const scored = scoreMvpSearchResults(results, searchInput());
  const match = scored.find((item) => item.content.id === "match");
  const miss = scored.find((item) => item.content.id === "miss");

  assert.ok(match, "mood 일치 작품이 결과에 있어야 한다");
  assert.ok(miss, "mood 불일치 작품이 결과에 있어야 한다");
  assert.ok(
    match.scoreBreakdown.mood > miss.scoreBreakdown.mood,
    `mood 점수가 역전되었다: 일치 ${match.scoreBreakdown.mood} <= 불일치 ${miss.scoreBreakdown.mood}`,
  );
  assert.ok(
    match.score > miss.score,
    `다른 조건이 같은데 총점이 역전되었다: 일치 ${match.score} <= 불일치 ${miss.score}`,
  );
});

test("mood 불일치 작품에는 mood 일치 추천 이유가 붙지 않는다", async () => {
  const { scoreMvpSearchResults } = await loadModule(
    "src/domains/recommendation/scoring.ts",
  );

  const scored = scoreMvpSearchResults(
    [
      {
        content: content({ id: "match", moodTags: ["밝은"] }),
        semanticScore: 0.5,
      },
      {
        content: content({ id: "miss", moodTags: ["어두운"] }),
        semanticScore: 0.5,
      },
      {
        content: content({ id: "empty", moodTags: [] }),
        semanticScore: 0.5,
      },
    ],
    searchInput(),
  );

  const reasonsOf = (id) =>
    scored.find((item) => item.content.id === id).reasons;

  assert.ok(
    reasonsOf("match").some((reason) => MOOD_REASON.test(reason)),
    "mood 일치 작품에는 분위기 이유가 있어야 한다",
  );
  for (const id of ["miss", "empty"]) {
    assert.ok(
      !reasonsOf(id).some((reason) => MOOD_REASON.test(reason)),
      `${id}: mood가 맞지 않는데 분위기 이유가 붙었다 — ${JSON.stringify(reasonsOf(id))}`,
    );
  }
});

test("TOP5 ID가 고유하고 같은 입력의 순서가 결정적이다", async () => {
  const { scoreMvpSearchResults } = await loadModule(
    "src/domains/recommendation/scoring.ts",
  );
  const { DeterministicSelectorAdapter } = await loadModule(
    "src/adapters/recommendation/deterministic-selector-adapter.ts",
  );

  // 동점을 일부러 만들어 tie-break 안정성까지 본다.
  const results = Array.from({ length: 8 }, (_, index) => ({
    content: content({
      id: `content-${index}`,
      title: `작품 ${index}`,
      moodTags: index % 2 === 0 ? ["밝은"] : ["어두운"],
      voteAverage: 8,
      voteCount: 1000,
    }),
    semanticScore: 0.5,
  }));

  const input = searchInput();
  const selector = new DeterministicSelectorAdapter();

  const runOnce = async () => {
    const scored = scoreMvpSearchResults(results, input);
    const { selectedIds } = await selector.select(scored, 5);
    return selectedIds;
  };

  const first = await runOnce();
  const second = await runOnce();

  assert.equal(first.length, 5, "TOP5는 5편이어야 한다");
  assert.equal(
    new Set(first).size,
    first.length,
    `TOP5에 중복 ID가 있다: ${JSON.stringify(first)}`,
  );
  assert.deepEqual(
    first,
    second,
    "같은 입력인데 순서가 달라졌다 — 결정적이지 않다",
  );
});

test("재고가 충분하면 TOP5 가 전부 선택한 분위기와 일치한다", async () => {
  const { scoreMvpSearchResults } = await loadModule(
    "src/domains/recommendation/scoring.ts",
  );
  const { DeterministicSelectorAdapter } = await loadModule(
    "src/adapters/recommendation/deterministic-selector-adapter.ts",
  );
  const { DEMO_CATALOG } = await loadModule("src/demo/fixtures/catalog.ts");

  const input = searchInput({ moods: ["밝은"] });
  const eligible = DEMO_CATALOG.filter(
    (item) => item.ageRating !== "18" && item.ageRating !== "UNKNOWN",
  );
  const inStock = eligible.filter((item) => item.moodTags.includes("밝은"));

  // 조건 6: 재고가 모자라면 이 검증 자체가 성립하지 않는다.
  assert.ok(
    inStock.length >= REQUIRED_SAFE_INVENTORY,
    `안전한 밝은 재고가 ${inStock.length}편이다. ${REQUIRED_SAFE_INVENTORY}편 이상이어야 TOP5 와 첫 교체를 감당한다 (담당 2 CAT-01).`,
  );

  const scored = scoreMvpSearchResults(
    eligible.map((content) => ({ content, semanticScore: 0.5 })),
    input,
  );
  const { selectedIds } = await new DeterministicSelectorAdapter().select(
    scored,
    5,
  );
  const selected = selectedIds.map((id) =>
    eligible.find((item) => item.id === id),
  );

  for (const item of selected) {
    assert.ok(
      item.moodTags.includes("밝은"),
      `재고가 ${inStock.length}편인데 분위기 불일치 작품이 TOP5 에 들어왔다: ${item.title} [${item.moodTags.join(",")}]`,
    );
  }
});
