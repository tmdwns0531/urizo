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

const TAGGING = "src/integrations/tmdb/tagging.ts";
const CHIPS = [
  "밝은", "따뜻한", "감성적인", "어두운",
  "긴장감 있는", "잔잔한", "생각할 거리가 있는", "자극적인",
];

test("CAT-02: keyword 근거가 있으면 mood·companion 이 비지 않는다", async () => {
  const { deriveMoodTags, deriveCompanionTags, normalizeKeywords } =
    await loadModule(TAGGING);

  const keywords = normalizeKeywords(["Cheerful", "  SITCOM ", "friendship"]);
  const moods = deriveMoodTags(keywords, ["코미디"]);
  const companions = deriveCompanionTags(keywords, ["코미디"], "12");

  assert.ok(moods.includes("밝은"), `밝은이 없다: ${JSON.stringify(moods)}`);
  assert.ok(companions.includes("ALONE"));
  assert.ok(companions.includes("FRIENDS"));
  assert.ok(
    companions.includes("WITH_CHILDREN"),
    "12세 작품은 아이와 함께 볼 수 있어야 한다",
  );
});

test("CAT-02: 같은 입력은 항상 같은 태그를 만든다 (결정론)", async () => {
  const { deriveMoodTags, deriveCompanionTags } = await loadModule(TAGGING);

  const keywords = ["thriller", "detective", "murder", "corruption"];
  const genres = ["범죄", "드라마"];

  const first = deriveMoodTags(keywords, genres);
  const second = deriveMoodTags([...keywords], [...genres]);
  assert.deepEqual(first, second);

  assert.deepEqual(
    deriveCompanionTags(keywords, genres, "15"),
    deriveCompanionTags([...keywords], [...genres], "15"),
  );
});

test("CAT-02: 근거가 하나뿐인 분위기는 채택하지 않는다", async () => {
  const { deriveMoodTags } = await loadModule(TAGGING);

  // '반지의 제왕: 왕의 귀환' 실제 keyword 발췌. cheerful 이 하나 섞여 있지만
  // 밝은 작품이 아니다. 근거 2개 규칙이 이 오탐을 막아야 한다.
  const lordOfTheRings = [
    "army", "based on novel or book", "magic", "obsession", "bravery",
    "epic battle", "wizard", "cheerful", "wistful", "melodramatic",
  ];
  const moods = deriveMoodTags(lordOfTheRings, ["모험", "판타지", "액션"]);

  assert.ok(
    !moods.includes("밝은"),
    `근거 1개(cheerful)로 밝은이 채택되었다: ${JSON.stringify(moods)}`,
  );
});

test("CAT-02: 부분일치 오탐이 없다 — dark comedy 는 밝은이 아니다", async () => {
  const { deriveMoodTags } = await loadModule(TAGGING);

  const moods = deriveMoodTags(["dark comedy", "black comedy"], []);
  assert.ok(
    !moods.includes("밝은"),
    `dark comedy 가 밝은으로 분류되었다: ${JSON.stringify(moods)}`,
  );
  assert.ok(moods.includes("어두운"));
});

test("CAT-02: keyword 근거가 없으면 genre 로 보조하고, 둘 다 없으면 비운다", async () => {
  const { deriveMoodTags } = await loadModule(TAGGING);

  assert.deepEqual(deriveMoodTags([], ["액션"]), ["자극적인"]);
  assert.deepEqual(
    deriveMoodTags(["duringcreditsstinger", "based on comic"], []),
    [],
    "근거가 없으면 지어내지 말고 비워야 한다",
  );
});

test("CAT-02: WITH_CHILDREN 은 연령 등급으로만 판단한다", async () => {
  const { deriveCompanionTags } = await loadModule(TAGGING);

  const kidFriendlyKeywords = ["family", "friendship"];
  for (const rating of ["ALL", "7", "12"]) {
    assert.ok(
      deriveCompanionTags(kidFriendlyKeywords, [], rating).includes(
        "WITH_CHILDREN",
      ),
      `${rating} 등급인데 WITH_CHILDREN 이 없다`,
    );
  }
  for (const rating of ["15", "18", "UNKNOWN"]) {
    assert.ok(
      !deriveCompanionTags(kidFriendlyKeywords, [], rating).includes(
        "WITH_CHILDREN",
      ),
      `${rating} 등급에 WITH_CHILDREN 이 붙었다`,
    );
  }
});

test("CAT-02: 유도된 분위기는 CHOICE 칩 8개 안에만 있다", async () => {
  const { deriveMoodTags } = await loadModule(TAGGING);

  const samples = [
    [["cheerful", "amused"], ["코미디"]],
    [["thriller", "detective"], ["범죄"]],
    [["slice of life", "cooking"], []],
    [[], ["애니메이션"]],
    [["superhero", "action"], ["액션"]],
  ];
  for (const [keywords, genres] of samples) {
    for (const mood of deriveMoodTags(keywords, genres)) {
      assert.ok(
        CHIPS.includes(mood),
        `CHOICE 에 없는 분위기를 만들었다: ${mood}`,
      );
    }
  }
});

test("CAT-01: 18세·UNKNOWN 을 제외한 안전 후보가 분위기마다 6편 이상이다", async () => {
  const { DEMO_CATALOG } = await loadModule("src/demo/fixtures/catalog.ts");

  const safe = DEMO_CATALOG.filter(
    (item) => item.ageRating !== "18" && item.ageRating !== "UNKNOWN",
  );
  for (const chip of CHIPS) {
    const count = safe.filter((item) => item.moodTags.includes(chip)).length;
    assert.ok(
      count >= 6,
      `${chip} 안전 후보가 ${count}편이다. TOP5 와 첫 교체를 감당하려면 6편 이상이어야 한다.`,
    );
  }
});

test("CAT-01: 픽스처 id 와 tmdbId 가 고유하다", async () => {
  const { DEMO_CATALOG } = await loadModule("src/demo/fixtures/catalog.ts");

  const ids = DEMO_CATALOG.map((item) => item.id);
  const tmdbIds = DEMO_CATALOG.map((item) => item.tmdbId);
  assert.equal(new Set(ids).size, ids.length, "id 가 중복된다");
  assert.equal(new Set(tmdbIds).size, tmdbIds.length, "tmdbId 가 중복된다");
});

test("CAT-01: 심야식당은 canonical TMDB 작품과 포스터를 사용한다", async () => {
  const { DEMO_CATALOG } = await loadModule("src/demo/fixtures/catalog.ts");
  const midnightDiner = DEMO_CATALOG.find(
    (item) => item.id === "midnight-diner",
  );

  assert.ok(midnightDiner, "심야식당 fixture가 있어야 한다");
  assert.equal(midnightDiner.title, "심야식당");
  assert.equal(midnightDiner.tmdbId, 47008);
  assert.equal(
    midnightDiner.posterUrl,
    "https://image.tmdb.org/t/p/w500/4a4BE3OgS3slYh1U4lCJAh7ZKVr.jpg",
  );
});
