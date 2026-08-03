import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const rootPath = path.resolve(import.meta.dirname, "..");
const moduleCache = new Map();

function readSource(filePath) {
  return readFile(path.resolve(rootPath, filePath), "utf8");
}

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
      const offset = match[0].lastIndexOf(specifier);
      const start = match.index + offset;
      const dependencyUrl = await moduleDataUrl(
        resolveTypeScriptModule(absolutePath, specifier),
      );
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

async function loadNaturalLanguage() {
  return import(
    await moduleDataUrl(
      "src/components/natural-recommendation/natural-language.ts",
    )
  );
}

async function loadNaturalParser() {
  return import(
    await moduleDataUrl(
      "src/domains/recommendation/natural-language/parse-natural-input.ts",
    )
  );
}

test("natural-language interpreter separates user conditions from defaults", async () => {
  const natural = await loadNaturalLanguage();
  const interpreted = natural.interpretNaturalRequest(
    "혼자 넷플릭스에서 2시간 안에 웃을 수 있는 한국 영화",
  );

  assert.equal(interpreted.draft.who, "ALONE");
  assert.equal(interpreted.draft.duration, 120);
  assert.deepEqual(interpreted.draft.otts, ["NETFLIX"]);
  assert.equal(interpreted.draft.mood, "밝은");
  assert.equal(interpreted.draft.origin, "KR");
  assert.equal(interpreted.draft.familyType, null);
  assert.equal(interpreted.draft.childAge, null);
  assert.equal(interpreted.mediaType, "MOVIE");
  assert.equal(interpreted.mediaTypeSource, "EXPLICIT");
  assert.equal(
    interpreted.tags.find((tag) => tag.dimension === "장르").source,
    "DEFAULT",
  );
  assert.deepEqual(
    interpreted.tags.find((tag) => tag.dimension === "작품 유형"),
    { dimension: "작품 유형", label: "영화", source: "EXPLICIT" },
  );
});

test("shared parser extracts companion, provider, runtime, mood, genre, origin, and media type", async () => {
  const parser = await loadNaturalParser();
  const childMovie = parser.parseNaturalInput(
    "아이와 한시간동안 볼 영화",
  );
  assert.deepEqual(childMovie.companion, {
    value: "WITH_CHILDREN",
    source: "EXPLICIT",
  });
  assert.deepEqual(childMovie.runtimeMinutes, {
    value: 60,
    source: "EXPLICIT",
  });
  assert.deepEqual(childMovie.mediaType, {
    value: "MOVIE",
    source: "EXPLICIT",
  });

  const soloSeries = parser.parseNaturalInput(
    "혼자 넷플릭스에서 30분 정도 가볍게 볼 코미디 시리즈",
  );
  assert.equal(soloSeries.companion.value, "ALONE");
  assert.deepEqual(soloSeries.providers.value, ["NETFLIX"]);
  assert.equal(soloSeries.runtimeMinutes.value, 30);
  assert.deepEqual(soloSeries.moods.value, ["밝은"]);
  assert.deepEqual(soloSeries.desiredGenres.value, ["코미디"]);
  assert.equal(soloSeries.mediaType.value, "SERIES");

  const koreanMovie = parser.parseNaturalInput(
    "친구와 티빙에서 2시간 안에 볼 긴장감 있는 한국 영화",
  );
  assert.equal(koreanMovie.companion.value, "FRIENDS");
  assert.deepEqual(koreanMovie.providers.value, ["TVING"]);
  assert.equal(koreanMovie.runtimeMinutes.value, 120);
  assert.deepEqual(koreanMovie.moods.value, ["긴장감 있는"]);
  assert.equal(koreanMovie.origin.value, "KR");
  assert.equal(koreanMovie.mediaType.value, "MOVIE");
});

test("shared parser keeps media, runtime, and genre intent deterministic", async () => {
  const parser = await loadNaturalParser();

  assert.deepEqual(parser.parseNaturalInput("드라마 추천해줘").mediaType, {
    value: "ANY",
    source: "DEFAULT",
  });
  assert.deepEqual(
    parser.parseNaturalInput("영화나 시리즈 아무거나").mediaType,
    { value: "ANY", source: "EXPLICIT" },
  );

  for (const [input, minutes] of [
    ["45분 안에", 45],
    ["90분 안에", 90],
    ["1시간 반 안에", 90],
    ["한시간 반 안에", 90],
  ]) {
    assert.deepEqual(parser.parseNaturalInput(input).runtimeMinutes, {
      value: minutes,
      source: "EXPLICIT",
    });
  }

  assert.deepEqual(
    parser.parseNaturalInput("코미디만 보여줘").requiredGenres.value,
    ["코미디"],
  );
  assert.deepEqual(
    parser.parseNaturalInput("반드시 코미디 추천해줘").requiredGenres.value,
    ["코미디"],
  );
  assert.deepEqual(
    parser.parseNaturalInput("공포는 제외").excludedGenres.value,
    ["공포", "스릴러"],
  );
  assert.deepEqual(
    parser.parseNaturalInput("재미있는 코미디면 좋겠어").desiredGenres.value,
    ["코미디"],
  );

  const defaults = parser.parseNaturalInput("추천해줘");
  for (const condition of Object.values(defaults)) {
    assert.equal(condition.source, "DEFAULT");
  }
});

test("family ambiguity is left for the server Agent and clear child intent stays structured", async () => {
  const natural = await loadNaturalLanguage();
  for (const keyword of ["가족", "아이", "자녀"]) {
    assert.equal(natural.requiresAgeClarification(`${keyword}와 볼 작품`), true);
  }
  assert.equal(natural.requiresAgeClarification("혼자 볼 작품"), false);
  const ambiguous = natural.interpretNaturalRequest("가족과 볼 작품");
  assert.equal(ambiguous.draft.who, "FAMILY");
  assert.equal(ambiguous.draft.familyType, null);

  const clearChildIntent = natural.interpretNaturalRequest("아이와 볼 작품");
  assert.equal(clearChildIntent.draft.familyType, "KIDS");
  assert.equal(clearChildIntent.draft.childAge, null);
  assert.deepEqual(
    natural.buildNaturalRecommendationRequest(
      "아이와 볼 작품",
      clearChildIntent,
    ).choice.companions,
    ["WITH_CHILDREN"],
  );
  assert.equal(
    natural.buildNaturalRecommendationRequest(
      "아이와 볼 작품",
      clearChildIntent,
    ).choice.childAgeRatingLimit,
    null,
  );

  assert.deepEqual(
    natural.clarificationAnswerToNaturalFamily("CHILD_7"),
    { familyType: "KIDS", childAge: "AGE_7" },
  );

  const interpreted = natural.interpretNaturalRequest("아이와 볼 작품", {
    familyType: "KIDS",
    childAge: "AGE_7",
  });
  assert.equal(
    interpreted.tags.find((tag) => tag.dimension === "동반자").source,
    "CLARIFIED",
  );
  assert.ok(
    interpreted.steps.some(
      (step) =>
        step.title === "아이 동반 안전 기준" &&
        step.source === "CLARIFIED",
    ),
  );
  assert.deepEqual(
    {
      who: interpreted.draft.who,
      familyType: interpreted.draft.familyType,
      childAge: interpreted.draft.childAge,
      duration: interpreted.draft.duration,
      mood: interpreted.draft.mood,
      origin: interpreted.draft.origin,
      genres: interpreted.draft.genres,
    },
    {
      who: "FAMILY",
      familyType: "KIDS",
      childAge: "AGE_7",
      duration: null,
      mood: "ANY",
      origin: "ANY",
      genres: [],
    },
  );
  assert.equal(interpreted.draft.otts.length, 6);
});

test("exact natural-language minute limits stay visible even outside CHOICE presets", async () => {
  const natural = await loadNaturalLanguage();
  const interpreted = natural.interpretNaturalRequest(
    "아이와 함께 20분 안에 볼 영화",
  );

  assert.equal(interpreted.runtimeMinutes, 20);
  assert.equal(interpreted.draft.duration, null);
  assert.deepEqual(
    interpreted.tags.find((tag) => tag.dimension === "시간"),
    { dimension: "시간", label: "20분 이내", source: "EXPLICIT" },
  );
  assert.ok(
    interpreted.steps.some(
      (step) =>
        step.title === "볼 수 있는 시간" &&
        step.description.includes("20분 이내"),
    ),
  );
});

test("natural request uses the strict API shape and keeps source text transient", async () => {
  const natural = await loadNaturalLanguage();
  const source = "친구와 티빙에서 긴장감 있는 스릴러";
  const interpreted = natural.interpretNaturalRequest(source);
  const request = natural.buildNaturalRecommendationRequest(
    source,
    interpreted,
  );

  assert.equal(request.choice.naturalLanguage, source);
  assert.deepEqual(request.choice.selectedProviders, ["TVING"]);
  assert.deepEqual(request.choice.companions, ["FRIENDS"]);
  assert.deepEqual(request.choice.moods, ["긴장감 있는"]);
  assert.deepEqual(request.choice.desiredGenres, ["공포", "스릴러"]);
  assert.deepEqual(request.choice.requiredGenres, []);
  assert.deepEqual(request.choice.excludedGenres, []);
  assert.equal(request.choice.mediaType, "ANY");
  for (const unknown of ["familyType", "childAge", "inputText"]) {
    assert.equal(Object.hasOwn(request.choice, unknown), false);
  }
});

test("media edits and family answers retain their attribution in the interpretation", async () => {
  const natural = await loadNaturalLanguage();
  const edited = natural.interpretNaturalRequest(
    "혼자 볼 영화",
    undefined,
    { mediaType: "ANY" },
  );
  assert.equal(edited.mediaType, "ANY");
  assert.equal(edited.mediaTypeSource, "USER_EDITED");
  assert.deepEqual(
    edited.tags.find((tag) => tag.dimension === "작품 유형"),
    {
      dimension: "작품 유형",
      label: "영화·시리즈 모두",
      source: "USER_EDITED",
    },
  );

  const request = natural.buildNaturalRecommendationRequest(
    "코미디만 보여주고 공포는 제외해줘",
    natural.interpretNaturalRequest(
      "코미디만 보여주고 공포는 제외해줘",
    ),
  );
  assert.deepEqual(request.choice.requiredGenres, ["코미디"]);
  assert.deepEqual(request.choice.excludedGenres, ["공포", "스릴러"]);
});

test("user-edited defaults override source text, including explicit neutral values", async () => {
  const natural = await loadNaturalLanguage();
  const source =
    "혼자 넷플릭스에서 90분 안에 볼 밝은 한국 코미디 영화, 공포는 제외";
  const interpreted = natural.interpretNaturalRequest(source, undefined, {
    who: "ANY",
    mediaType: "ANY",
    runtimeMinutes: null,
    providers: [
      "NETFLIX",
      "TVING",
      "DISNEY_PLUS",
      "WAVVE",
      "WATCHA",
      "COUPANG_PLAY",
    ],
    mood: "ANY",
    origin: "ANY",
    genres: [],
  });

  assert.equal(interpreted.draft.who, "ANY");
  assert.equal(interpreted.runtimeMinutes, null);
  assert.equal(interpreted.draft.duration, null);
  assert.equal(interpreted.draft.otts.length, 6);
  assert.equal(interpreted.draft.mood, "ANY");
  assert.equal(interpreted.draft.origin, "ANY");
  assert.deepEqual(interpreted.draft.genres, []);
  assert.equal(interpreted.mediaType, "ANY");
  assert.deepEqual(interpreted.desiredGenres, []);
  assert.deepEqual(interpreted.requiredGenres, []);
  assert.deepEqual(interpreted.excludedGenres, []);
  assert.ok(interpreted.tags.every((tag) => tag.source === "USER_EDITED"));

  const request = natural.buildNaturalRecommendationRequest(
    source,
    interpreted,
  );
  assert.deepEqual(request.choice.companions, ["ANY"]);
  assert.equal(request.choice.maxRuntimeMinutes, null);
  assert.equal(request.choice.naturalRuntimeMinutes, null);
  assert.deepEqual(request.choice.moods, []);
  assert.deepEqual(request.choice.desiredGenres, []);
  assert.deepEqual(request.choice.requiredGenres, []);
  assert.deepEqual(request.choice.excludedGenres, []);
  assert.equal(request.choice.originPreference, "ANY");
  assert.equal(request.choice.mediaType, "ANY");
});

test("Unicode input limit counts code points instead of UTF-16 units", async () => {
  const natural = await loadNaturalLanguage();
  const clamped = natural.clampNaturalLanguage("😀".repeat(141));
  assert.equal(natural.countNaturalLanguageCodePoints(clamped), 140);
  assert.equal(clamped, "😀".repeat(140));
});

test("loading keeps its content above non-interactive cinema emoji particles", async () => {
  const [loading, css] = await Promise.all([
    readSource(
      "src/components/natural-recommendation/natural-loading-step.tsx",
    ),
    readSource("src/app/globals.css"),
  ]);

  for (const emoji of ["🍿", "🎬", "🎥", "🎫", "🕶️", "🥤", "🤫"]) {
    assert.match(loading, new RegExp(emoji));
  }
  for (const variedProperty of [
    "left: particle.left",
    "animationDelay: particle.animationDelay",
    "fontSize: particle.fontSize",
    '"--emoji-rotate": particle.rotate',
  ]) {
    assert.ok(loading.includes(variedProperty));
  }
  assert.match(loading, /className="natural-loading-emoji-layer"[\s\S]*aria-hidden="true"/);
  assert.match(loading, /<section className="relative z-10 w-full"/);
  assert.match(css, /@keyframes floatEmoji/);
  assert.match(
    css.match(/\.natural-loading-emoji-layer\s*\{[\s\S]*?\}/)?.[0] ?? "",
    /pointer-events:\s*none/,
  );
  assert.match(css, /animation:\s*floatEmoji var\(--emoji-duration\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.natural-loading-emoji/);
});

test("prompt route composes the full cancellable state flow", async () => {
  const [page, flow, result, provider, layout, choice] = await Promise.all([
    readSource("src/app/prompt/page.tsx"),
    readSource(
      "src/components/natural-recommendation/natural-recommendation-flow.tsx",
    ),
    readSource("src/components/natural-recommendation/natural-result.tsx"),
    readSource(
      "src/components/choice-handoff/choice-handoff-provider.tsx",
    ),
    readSource("src/app/layout.tsx"),
    readSource("src/components/choice-stepper/choice-stepper.tsx"),
  ]);

  assert.match(page, /<NaturalRecommendationFlow\s*\/>/);
  for (const state of [
    '"input"',
    '"analyzing"',
    '"matching"',
    '"result"',
  ]) {
    assert.ok(flow.includes(state), `${state} must be an explicit state`);
  }
  assert.match(flow, /fetch\("\/api\/recommendations"/);
  assert.match(flow, /AbortController/);
  assert.match(flow, /window\.setTimeout\([\s\S]*?SHOW_MATCHING[\s\S]*?650/);
  assert.doesNotMatch(flow, /await wait|Promise\.all\(\[requestOutcome/);
  assert.match(flow, /\/approval/);
  assert.match(flow, /naturalLanguage:\s*state\.input\.trim\(\)/);
  assert.match(result, /data-agent-chat="clarification"/);
  assert.match(result, />추가 질문</);
  assert.match(result, /한 가지만 더 알려주세요\./);
  assert.doesNotMatch(result, /AGENT 추가 질문|Agent 추가 질문|1회/);
  assert.doesNotMatch(
    result,
    /답을 받기 전에는 카탈로그를 검색하거나 조건을 임의로 바꾸지 않아요\./,
  );
  // Matched across lines: the top pick card gained replacement props, so the
  // single-line form no longer holds. The identity that matters is that the
  // top pick still renders as the hero card.
  assert.match(
    result,
    /<ContentCard\s+item=\{response\.topPick\}\s+rank=\{1\}\s+hero/,
  );
  assert.match(result, /snap-x snap-mandatory/);
  assert.match(result, /md:grid-cols-2/);
  assert.match(result, /lg:grid-cols-3/);
  assert.match(result, /xl:grid-cols-5/);
  assert.match(result, /variant="rail"/);
  assert.match(result, /<RecommendationTimeline/);
  assert.match(
    result,
    /\) : \(\s*<>\s*<CompletedNaturalResults[\s\S]*?<RecommendationTimeline[\s\S]*?<ResultActions[\s\S]*?<\/>\s*\)}/,
  );
  assert.match(result, /<NaturalConditionSummary interpretation=\{interpretation\}/);
  assert.match(result, /publishChoiceHandoff\(interpretation\.draft\);[\s\S]*router\.push\("\/choice"\)/);
  assert.doesNotMatch(`${flow}\n${result}\n${provider}`, /localStorage|sessionStorage|URLSearchParams|console\.log/);
  assert.match(layout, /<ChoiceHandoffProvider>\{children\}<\/ChoiceHandoffProvider>/);
  assert.match(choice, /initialHandoff \? 6 : 1/);
  assert.match(choice, /consumeChoiceHandoff\(initialHandoff\.token\)/);

  const runtimeApproval = result.slice(
    result.indexOf("function RuntimeApprovalBanner"),
    result.indexOf("function AgentClarificationChat"),
  );
  assert.match(runtimeApproval, /bg-\[#191d22\]/);
  assert.match(runtimeApproval, /from-\[#ff5430\] to-\[#ff7c42\]/);
  assert.match(runtimeApproval, /text-white/);
  assert.doesNotMatch(
    runtimeApproval,
    /approval-banner|approval-change|button--primary|button--ghost|#0b1f52/,
  );

  for (const label of [
    "디테일하게 직접 고르기",
    "같은 조건으로 다시 추천받기",
    "한마디 수정하기",
    "새 한마디로 시작하기",
  ]) {
    assert.match(result, new RegExp(label));
  }
});

test("natural input keeps text primary and condition defaults collapsed", async () => {
  const [input, summary, result] = await Promise.all([
    readSource("src/components/natural-recommendation/natural-input-step.tsx"),
    readSource(
      "src/components/natural-recommendation/natural-condition-summary.tsx",
    ),
    readSource("src/components/natural-recommendation/natural-result.tsx"),
  ]);

  assert.match(
    input,
    /영화·시리즈, 시청 시간, OTT, 함께 보는 사람, 분위기 중[\s\S]*아는 조건만 한\s+문장으로 적어주세요\./,
  );
  assert.match(input, /text-balance text-center/);
  assert.doesNotMatch(
    input,
    /<span className="block">아는 조건만 한 문장으로 적어주세요\.<\/span>/,
  );
  assert.match(
    input,
    /예: 아이와 디즈니\+에서 1시간 안에 볼 따뜻한 애니메이션 영화/,
  );
  for (const example of [
    "아이와 디즈니+에서 1시간 안에 볼 따뜻한 애니메이션 영화",
    "혼자 넷플릭스에서 30분 정도 가볍게 볼 코미디 시리즈",
    "친구와 티빙에서 2시간 안에 볼 긴장감 있는 한국 영화",
  ]) {
    assert.ok(input.includes(example));
  }

  assert.match(summary, /tag\.source !== "DEFAULT"/);
  assert.match(summary, /tag\.source === "DEFAULT"/);
  assert.match(summary, /기본 설정 \{defaultTags\.length\}개/);
  assert.match(summary, /<details/);
  assert.match(summary, /작품 유형 수정/);
  assert.match(summary, /editableDefaults/);
  assert.match(summary, /기본 설정 수정/);
  assert.match(summary, /수정한 설정/);
  assert.match(summary, /<SettingEditor/);
  for (const option of [
    "COMPANION_OPTIONS",
    "DURATION_OPTIONS",
    "OTT_OPTIONS",
    "MOOD_OPTIONS",
    "ORIGIN_OPTIONS",
    "GENRE_OPTIONS",
  ]) {
    assert.match(summary, new RegExp(option));
  }
  assert.doesNotMatch(summary, /기본 설정 4개 보기/);

  for (const action of [
    "시청 시간 늘리기",
    "영화·시리즈 모두 보기",
    "조건 다시 입력하기",
  ]) {
    assert.match(result, new RegExp(action));
  }
});

test("Choice handoff provider allowlists only structured form fields", async () => {
  const provider = await readSource(
    "src/components/choice-handoff/choice-handoff-provider.tsx",
  );
  const snapshotBody = provider.match(
    /export function snapshotChoiceHandoffDraft[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(snapshotBody);
  for (const field of [
    "who",
    "familyType",
    "childAge",
    "duration",
    "otts",
    "mood",
    "origin",
    "genres",
  ]) {
    assert.match(snapshotBody, new RegExp(`${field}:`));
  }
  assert.doesNotMatch(
    snapshotBody,
    /return\s*\{\s*\.\.\.draft|naturalLanguage|inputText|raw/,
  );
});

test("genre exclusion stays inside its own clause", async () => {
  const parser = await loadNaturalParser();

  // 장르 뒤 24글자만 보고 "제외" 를 찾으면, 다른 절의 제외 표현이 딸려와
  // 원하는 장르를 반대로 빼버린다. 실제로 "어벤져스같은 액션 영화 보고싶은데
  // 매트릭스는 봐서 제외해줘" 가 `액션 제외` 로 해석되어, 액션을 요청한
  // 사용자에게 코코·너의 이름은이 추천됐다.
  const otherClause = parser.parseNaturalInput(
    "어벤져스같은 액션 영화 보고싶은데 매트릭스는 봐서 제외해줘",
  );
  assert.deepEqual(otherClause.desiredGenres.value, ["액션"]);
  assert.deepEqual(otherClause.excludedGenres.value, []);

  // 같은 절 안의 제외는 그대로 인식해야 한다. 조사(은·는)는 절 경계가 아니다.
  const sameClause = parser.parseNaturalInput("액션은 빼줘");
  assert.deepEqual(sameClause.excludedGenres.value, ["액션"]);

  // 절이 나뉘어 각각 원함·제외인 경우도 구분한다.
  const bothClauses = parser.parseNaturalInput(
    "로맨스 영화 보고싶은데 코미디는 빼줘",
  );
  assert.deepEqual(bothClauses.desiredGenres.value, ["로맨스"]);
  assert.deepEqual(bothClauses.excludedGenres.value, ["코미디"]);

  assert.deepEqual(
    parser.parseNaturalInput("액션만 보여줘").requiredGenres.value,
    ["액션"],
  );
});
