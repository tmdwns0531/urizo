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

function content(overrides = {}) {
  return {
    id: "content-base",
    tmdbId: 1,
    title: "기준 작품",
    synopsis: "fallback 회귀 테스트용 합성 작품",
    mediaType: "MOVIE",
    runtimeMinutes: 100,
    releaseYear: 2024,
    genres: ["드라마"],
    moodTags: ["밝은"],
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

const continuation = {
  queryVector: {
    algorithm: "local-hash-cosine-v1",
    version: 1,
    dimensions: 64,
    values: Array.from({ length: 64 }, () => 0.1),
  },
  inputFingerprint: `sha256:${"a".repeat(64)}`,
};

function fallbackInput(eligibleCatalog, input = searchInput()) {
  return {
    eligibleCatalog,
    searchInput: input,
    continuation,
    excludedContentIds: [],
  };
}

test("fallback도 연령·provider·runtime·origin 필수 필터를 유지한다", async () => {
  const { ruleBasedFallback } = await loadModule(
    "src/domains/recommendation/fallback.ts",
  );

  const safe = content({ id: "safe", title: "안전" });
  // 상류가 실수로 넘겨도 fallback 이 스스로 걸러내야 하는 후보들.
  const unsafe = [
    content({ id: "adult", ageRating: "18" }),
    content({ id: "unknown-rating", ageRating: "UNKNOWN" }),
    content({ id: "no-provider", providers: [] }),
    content({
      id: "other-provider",
      providers: [
        {
          provider: "WATCHA",
          watchUrl: "https://example.invalid/watch",
          linkType: "SEARCH",
        },
      ],
    }),
    content({ id: "too-long", runtimeMinutes: 300 }),
    content({ id: "foreign", originCountries: ["US"], productionCountries: ["US"] }),
  ];

  const result = ruleBasedFallback(
    fallbackInput([safe, ...unsafe], searchInput({
      maxRuntimeMinutes: 120,
      originPreference: "KR",
    })),
  );

  const selectedIds = result.selected.map((item) => item.content.id);
  assert.ok(
    selectedIds.includes("safe"),
    "안전한 후보가 fallback 결과에서 사라졌다",
  );
  for (const item of unsafe) {
    assert.ok(
      !selectedIds.includes(item.id),
      `필수 조건을 어긴 ${item.id} 가 fallback 결과에 진입했다`,
    );
    assert.ok(
      result.excludedContentIds.includes(item.id),
      `${item.id} 가 제외 목록에 기록되지 않았다`,
    );
  }
});

test("fallback은 TOP5를 채우려고 조건을 완화하지 않는다", async () => {
  const { ruleBasedFallback } = await loadModule(
    "src/domains/recommendation/fallback.ts",
  );

  // 안전한 후보 2편 + 부적합 후보 6편. 5칸을 못 채워도 완화하면 안 된다.
  const catalog = [
    content({ id: "safe-1" }),
    content({ id: "safe-2" }),
    ...Array.from({ length: 6 }, (_, index) =>
      content({ id: `adult-${index}`, ageRating: "18" }),
    ),
  ];

  const result = ruleBasedFallback(fallbackInput(catalog));
  const selectedIds = result.selected.map((item) => item.content.id);

  assert.deepEqual(
    [...selectedIds].sort(),
    ["safe-1", "safe-2"],
    `조건을 완화해 부적합 후보로 5칸을 채웠다: ${JSON.stringify(selectedIds)}`,
  );
  assert.equal(result.eligibleCount, 2);
});

test("fallback은 같은 입력에 같은 순서를 돌려준다", async () => {
  const { ruleBasedFallback } = await loadModule(
    "src/domains/recommendation/fallback.ts",
  );

  const catalog = Array.from({ length: 8 }, (_, index) =>
    content({ id: `content-${index}`, title: `작품 ${index}` }),
  );

  const first = ruleBasedFallback(fallbackInput(catalog));
  const second = ruleBasedFallback(fallbackInput(catalog));

  const ids = (result) => result.selected.map((item) => item.content.id);
  assert.equal(ids(first).length, 5);
  assert.equal(new Set(ids(first)).size, 5, "fallback TOP5에 중복 ID가 있다");
  assert.deepEqual(ids(first), ids(second), "fallback 순서가 결정적이지 않다");
});
