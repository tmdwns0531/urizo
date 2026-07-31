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

function readSource(filePath) {
  return readFile(path.resolve(rootPath, filePath), "utf8");
}

function content(overrides = {}) {
  return {
    id: "content-1",
    tmdbId: 1,
    title: "조용한 밤",
    synopsis: "평범한 이야기",
    mediaType: "MOVIE",
    runtimeMinutes: 100,
    releaseYear: 2026,
    genres: [],
    moodTags: [],
    companionTags: [],
    ageRating: "15",
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

// SEARCH-01
test("반전 joins the tension semantic group and reaches thriller content", async () => {
  const semantic = await loadModule("src/domains/search/semantic.ts");

  const tokens = semantic.tokenize("반전");
  for (const sibling of ["긴장", "긴장감", "스릴러", "미스터리", "추리", "몰입"]) {
    assert.ok(
      tokens.includes(sibling),
      `"반전" must expand to the tension group member "${sibling}"`,
    );
  }

  // The expansion is symmetric: existing members must reach 반전 too.
  assert.ok(semantic.tokenize("스릴러").includes("반전"));

  const thriller = content({
    title: "미스터리 극장",
    synopsis: "끝까지 긴장감이 이어지는 추리 이야기",
    genres: ["스릴러"],
    moodTags: ["긴장감 있는"],
  });
  const unrelated = content({
    title: "밝은 하루",
    synopsis: "가볍고 유쾌한 코미디",
    genres: ["코미디"],
    moodTags: ["밝은"],
  });

  const thrillerScore = semantic.semanticSimilarity("반전", thriller).score;
  const unrelatedScore = semantic.semanticSimilarity("반전", unrelated).score;
  assert.ok(
    thrillerScore > unrelatedScore,
    `반전 must favour thriller content (${thrillerScore} vs ${unrelatedScore})`,
  );
  assert.ok(thrillerScore > 0, "반전 must not score zero against thriller content");
});

test("반전 does not leak into unrelated semantic groups", async () => {
  const semantic = await loadModule("src/domains/search/semantic.ts");
  const tokens = semantic.tokenize("반전");
  for (const foreign of ["코미디", "위로", "로맨스", "가족", "액션", "음악"]) {
    assert.ok(
      !tokens.includes(foreign),
      `"반전" must not expand to the unrelated term "${foreign}"`,
    );
  }
});

// UX-02 backing behaviour
test("natural language is combined with chips instead of replacing them", async () => {
  const query = await loadModule("src/domains/search/query.ts");
  const sentence = query.buildMvpSearchQuery({
    companions: ["ALONE"],
    moods: ["긴장감 있는"],
    desiredGenres: [],
    maxRuntimeMinutes: 120,
    originPreference: "KR",
    naturalLanguage: "반전 있는 영화",
  });

  assert.ok(sentence.includes("반전 있는 영화"), "natural language must survive");
  assert.ok(sentence.includes("혼자"), "companion chip must survive");
  assert.ok(sentence.includes("긴장감"), "mood chip must survive");
  assert.ok(sentence.includes("120분"), "runtime chip must survive");
  assert.ok(sentence.includes("한국 작품"), "origin chip must survive");
});

test("natural language source text never enters the sanitized search input", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const resolved = request.resolveMvpRecommendationRequest({
    choice: { naturalLanguage: "반전 있는 영화", moods: ["긴장감 있는"] },
  });
  const transient = request.toMvpSearchInput(resolved);
  const sanitized = request.sanitizeMvpSearchInput(transient);

  assert.equal(sanitized.hasNaturalLanguage, true);
  assert.ok(
    !JSON.stringify(sanitized).includes("반전 있는 영화"),
    "sanitized input must carry only the hasNaturalLanguage flag",
  );
});

// UX-01
test("CHOICE shows static order guidance, not a fake progress stepper", async () => {
  const source = await readSource("src/app/choice/page.tsx");
  assert.ok(!source.includes("choice-progress"), "stepper markup must be gone");
  assert.ok(!source.includes("is-active"), "hardcoded active step must be gone");
  assert.ok(!source.includes("추천 진행 1단계"), "fake progress label must be gone");
  assert.ok(source.includes("이렇게 진행돼요"), "order guidance must be present");

  const css = await readSource("src/app/globals.css");
  assert.ok(!css.includes(".choice-progress"), "stepper CSS must be removed");
  assert.ok(css.includes(".choice-guide"), "guidance CSS must exist");
});

// UX-02
test("CHOICE summary surfaces the natural-language request and its relationship", async () => {
  const source = await readSource("src/components/choice-form.tsx");
  assert.ok(source.includes("추가 요청"), "summary must list the natural-language request");
  assert.ok(
    source.includes("덮어쓰지 않고"),
    "summary must explain that chips are not overwritten",
  );
});

// UX-03
test("CHOICE and landing copy carry no developer-facing terminology", async () => {
  const banned = [
    "Preview",
    "DEMO LAB",
    "Demo는 키 없이 실행",
    "LIVE는 선택 기능만 연결",
    "핵심 정책 시나리오",
    "승인 게이트",
    "정책 차단",
    "예산 폴백",
    "정책 확인 완료",
    "필수 필터",
    "실행기",
    "칩 선택만으로도",
  ];
  for (const file of [
    "src/app/page.tsx",
    "src/app/choice/page.tsx",
    "src/components/choice-form.tsx",
  ]) {
    const source = await readSource(file);
    for (const term of banned) {
      assert.ok(
        !source.includes(term),
        `${file} must not expose the developer-facing term "${term}"`,
      );
    }
  }

  const form = await readSource("src/components/choice-form.tsx");
  assert.ok(form.includes("시연 모드"), "Demo Lab must be relabelled, not deleted");
  assert.ok(
    form.includes("scenarioOptions"),
    "Demo Lab scenarios must remain available",
  );
});
