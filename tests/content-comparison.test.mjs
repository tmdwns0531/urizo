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
    synopsis: "비교 테스트용 합성 작품",
    mediaType: "MOVIE",
    runtimeMinutes: 100,
    releaseYear: 2024,
    genres: ["드라마", "가족"],
    moodTags: ["따뜻한", "잔잔한"],
    companionTags: ["ANY"],
    ageRating: "ALL",
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
    voteCount: 2_000,
    posterUrl: null,
    backdropColor: "#123456",
    ...overrides,
  };
}

test("익명 비교 후보는 18·UNKNOWN·OTT 미제공 작품을 제외하고 안정 정렬한다", async () => {
  const { getComparableCatalog } = await loadModule(
    "src/domains/content-comparison/compare.ts",
  );
  const result = getComparableCatalog([
    content({ id: "z", title: "하늘" }),
    content({ id: "adult", title: "성인", ageRating: "18" }),
    content({ id: "unknown", title: "미상", ageRating: "UNKNOWN" }),
    content({ id: "offline", title: "미제공", providers: [] }),
    content({ id: "a", title: "가을" }),
  ]);

  assert.deepEqual(
    result.map(({ id }) => id),
    ["a", "z"],
  );
});

test("공통점과 차이점 문장은 구조화 필드의 교집합·차집합으로 만든다", async () => {
  const { compareCatalogContents } = await loadModule(
    "src/domains/content-comparison/compare.ts",
  );
  const left = content({ id: "left", title: "작품 A" });
  const right = content({
    id: "right",
    title: "작품 B",
    runtimeMinutes: 132,
    releaseYear: 2021,
    genres: ["드라마", "로맨스"],
    moodTags: ["따뜻한", "감성적인"],
    ageRating: "12",
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.invalid/netflix",
        linkType: "SEARCH",
      },
      {
        provider: "TVING",
        watchUrl: "https://example.invalid/tving",
        linkType: "SEARCH",
      },
    ],
  });

  const result = compareCatalogContents(left, right);
  assert.ok(
    result.commonalities.some(
      ({ key, description }) =>
        key === "GENRES" && description.includes("드라마"),
    ),
  );
  assert.ok(
    result.commonalities.some(
      ({ key, description }) =>
        key === "MOODS" && description.includes("따뜻한"),
    ),
  );

  const genreDifference = result.differences.find(
    ({ key }) => key === "GENRES",
  );
  assert.equal(genreDifference.leftValue, "가족");
  assert.equal(genreDifference.rightValue, "로맨스");

  const runtimeDifference = result.differences.find(
    ({ key }) => key === "RUNTIME",
  );
  assert.match(runtimeDifference.description, /작품 A 쪽이 32분 더 짧아요/);
});

test("상황별 추천은 상영시간·등급·OTT·품질 지표·잔잔한 분위기의 고정 규칙을 따른다", async () => {
  const { compareCatalogContents } = await loadModule(
    "src/domains/content-comparison/compare.ts",
  );
  const left = content({
    id: "left",
    title: "짧고 안전한 작품",
    runtimeMinutes: 85,
    ageRating: "ALL",
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.invalid/netflix",
        linkType: "SEARCH",
      },
      {
        provider: "TVING",
        watchUrl: "https://example.invalid/tving",
        linkType: "SEARCH",
      },
    ],
    moodTags: ["밝은", "따뜻한", "잔잔한"],
    voteAverage: 8.6,
    voteCount: 8_000,
  });
  const right = content({
    id: "right",
    title: "긴 작품",
    runtimeMinutes: 130,
    ageRating: "15",
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.invalid/netflix",
        linkType: "SEARCH",
      },
    ],
    moodTags: ["어두운"],
    voteAverage: 7.2,
    voteCount: 500,
  });

  const result = compareCatalogContents(left, right);
  for (const key of [
    "QUICK_WATCH",
    "FAMILY_VIEWING",
    "OTT_FLEXIBILITY",
    "RATING_CONFIDENCE",
    "CALM_VIEWING",
  ]) {
    const item = result.recommendations.find((candidate) => candidate.key === key);
    assert.equal(item.winner, "LEFT", `${key} winner`);
    assert.equal(item.winnerContentId, "left", `${key} contentId`);
  }
});

test("근소한 상영시간·품질 지표 차이는 과장하지 않고 동률 처리한다", async () => {
  const { compareCatalogContents } = await loadModule(
    "src/domains/content-comparison/compare.ts",
  );
  const result = compareCatalogContents(
    content({ id: "left", runtimeMinutes: 100 }),
    content({ id: "right", runtimeMinutes: 108 }),
  );

  assert.equal(
    result.recommendations.find(({ key }) => key === "QUICK_WATCH").winner,
    "TIE",
  );
  assert.equal(
    result.recommendations.find(({ key }) => key === "RATING_CONFIDENCE").winner,
    "TIE",
  );
});

test("평점·평가 수 지표는 기존 추천 품질식을 따른다", async () => {
  const { compareCatalogContents } = await loadModule(
    "src/domains/content-comparison/compare.ts",
  );
  const result = compareCatalogContents(
    content({
      id: "left",
      voteAverage: 9,
      voteCount: 50,
    }),
    content({
      id: "right",
      voteAverage: 7.5,
      voteCount: 1_000,
    }),
  );

  const rating = result.recommendations.find(
    ({ key }) => key === "RATING_CONFIDENCE",
  );
  assert.equal(rating.winner, "RIGHT");
  assert.match(rating.description, /현재 추천과 같은 평점·평가 수 지표/);
});

test("영화 총시간과 시리즈 회당시간은 직접 우열로 판단하지 않는다", async () => {
  const { compareCatalogContents } = await loadModule(
    "src/domains/content-comparison/compare.ts",
  );
  const result = compareCatalogContents(
    content({ id: "movie", mediaType: "MOVIE", runtimeMinutes: 140 }),
    content({ id: "series", mediaType: "SERIES", runtimeMinutes: 45 }),
  );

  assert.equal(
    result.recommendations.find(({ key }) => key === "QUICK_WATCH").winner,
    "TIE",
  );
  assert.match(
    result.differences.find(({ key }) => key === "RUNTIME").description,
    /영화는 총 상영시간, 시리즈는 회당 시간/,
  );

  const equalRuntime = compareCatalogContents(
    content({ id: "movie-equal", mediaType: "MOVIE", runtimeMinutes: 45 }),
    content({ id: "series-equal", mediaType: "SERIES", runtimeMinutes: 45 }),
  );
  assert.equal(
    equalRuntime.commonalities.some(({ key }) => key === "RUNTIME"),
    false,
  );
  assert.match(
    equalRuntime.differences.find(({ key }) => key === "RUNTIME").description,
    /영화는 총 상영시간, 시리즈는 회당 시간/,
  );
});

test("같은 작품과 안전하지 않은 작품은 비교 자체를 거부한다", async () => {
  const { compareCatalogContents, ContentComparisonValidationError } =
    await loadModule("src/domains/content-comparison/compare.ts");
  const safe = content({ id: "safe" });

  assert.throws(
    () => compareCatalogContents(safe, safe),
    ContentComparisonValidationError,
  );
  assert.throws(
    () =>
      compareCatalogContents(
        safe,
        content({ id: "unsafe", ageRating: "18" }),
      ),
    ContentComparisonValidationError,
  );
});

test("비교 화면은 독립 경로이며 RAG·LLM·신규 공개 API 없이 구성된다", async () => {
  const [page, component, css, composition, domain] = await Promise.all([
    readFile(path.resolve(rootPath, "src/app/compare/page.tsx"), "utf8"),
    readFile(
      path.resolve(
        rootPath,
        "src/components/content-comparison/content-comparison-page.tsx",
      ),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/components/content-comparison/content-comparison-page.module.css"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/composition/content-comparison.ts"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/domains/content-comparison/compare.ts"),
      "utf8",
    ),
  ]);

  assert.match(page, /force-dynamic/);
  assert.match(component, /<AppShell minimal/);
  assert.match(component, /공통점/);
  assert.match(component, /차이점/);
  assert.match(component, /상황별 추천/);
  assert.match(composition, /adapters\.catalog\.list\(\)/);
  assert.match(page, /compareCatalogContents/);
  assert.match(component, /<form action="\/compare" method="get">/);
  assert.doesNotMatch(component, /useState|aria-live|contents=\{contents\}/);
  assert.match(component, /required/);
  assert.doesNotMatch(component, /disabled=\{content\.id === comparison/);
  assert.match(component, /직접 비교 어려움/);
  assert.match(page, /hasRequestedPair && !hasValidPair/);
  assert.match(page, /비교할 작품을 다시 선택해 주세요/);
  const remFontSizes = [
    ...css.matchAll(/font-size:\s*([0-9.]+)rem/g),
  ].map((match) => Number(match[1]));
  assert.ok(
    remFontSizes.every((size) => size >= 0.875),
    "comparison CSS keeps fixed rem text at 14px or larger",
  );
  const posterFrameRule = css.match(/\.posterFrame\s*\{([^}]*)\}/)?.[1] ?? "";
  const posterRule = css.match(/\.posterFrame\s*>\s*div\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(posterFrameRule, /overflow:\s*hidden/);
  assert.match(posterRule, /width:\s*100%/);
  assert.match(posterRule, /max-width:\s*100%/);

  for (const source of [page, component, css, composition, domain]) {
    assert.doesNotMatch(source, /openai|embedding|pgvector|\/api\/search/i);
  }
});

test("completed results enter comparison through a two-item tray", async () => {
  const [tray, structuredResult, naturalResult, contentCard] = await Promise.all([
    readFile(
      path.resolve(rootPath, "src/components/content-comparison/recommendation-comparison-tray.tsx"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/components/recommendation-view.tsx"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/components/natural-recommendation/natural-result.tsx"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/components/content-card.tsx"),
      "utf8",
    ),
  ]);

  assert.match(tray, /currentAvailable\.length >= 2/);
  assert.match(tray, /aria-pressed=\{selected\}/);
  assert.match(tray, /data-comparison-tray="true"/);
  assert.match(tray, /\/compare\?left=/);
  assert.match(tray, /encodeURIComponent/);
  assert.match(tray, /selectedContents\.length === 2/);
  assert.match(tray, /selectedContents\.length === 1/);
  assert.match(structuredResult, /<RecommendationComparisonTray/);
  assert.match(structuredResult, /<ComparisonCandidate/);
  assert.match(naturalResult, /<RecommendationComparisonTray/);
  assert.match(naturalResult, /<ComparisonCandidate/);
  assert.doesNotMatch(contentCard, /ComparisonCandidate|comparison-tray/);
  assert.doesNotMatch(
    tray,
    /fetch\(|sessionStorage|localStorage|openai|embedding|pgvector|\/api\/search/i,
  );
});
