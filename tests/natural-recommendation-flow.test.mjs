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
  assert.equal(
    interpreted.tags.find((tag) => tag.dimension === "장르").source,
    "DEFAULT",
  );
  assert.ok(
    interpreted.steps.some(
      (step) =>
        step.title === "작품 유형 표현" && step.source === "DISCLOSURE",
    ),
  );
});

test("family keywords require clarification and child choice stays structured", async () => {
  const natural = await loadNaturalLanguage();
  for (const keyword of ["가족", "아이", "자녀"]) {
    assert.equal(natural.requiresAgeClarification(`${keyword}와 볼 작품`), true);
  }
  assert.equal(natural.requiresAgeClarification("혼자 볼 작품"), false);
  assert.throws(
    () => natural.interpretNaturalRequest("아이와 볼 작품"),
    /가족 구성 확인/,
  );

  const interpreted = natural.interpretNaturalRequest("아이와 볼 작품", {
    familyType: "KIDS",
    childAge: "AGE_7",
  });
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
  for (const unknown of ["familyType", "childAge", "mediaType", "inputText"]) {
    assert.equal(Object.hasOwn(request.choice, unknown), false);
  }
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
    '"clarify_age"',
    '"analyzing"',
    '"matching"',
    '"result"',
  ]) {
    assert.ok(flow.includes(state), `${state} must be an explicit state`);
  }
  assert.match(flow, /fetch\("\/api\/recommendations"/);
  assert.match(flow, /AbortController/);
  assert.match(flow, /await wait\(900\)/);
  assert.match(flow, /wait\(1_100\)/);
  assert.match(flow, /\/approval/);
  assert.match(result, /<ContentCard item=\{response\.topPick\} rank=\{1\} hero/);
  assert.match(result, /content-grid content-grid--four/);
  assert.match(result, /<RecommendationTimeline/);
  assert.match(result, /data-condition-source/);
  assert.match(result, /publishChoiceHandoff\(interpretation\.draft\);[\s\S]*router\.push\("\/choice"\)/);
  assert.doesNotMatch(`${flow}\n${result}\n${provider}`, /localStorage|sessionStorage|URLSearchParams|console\.log/);
  assert.match(layout, /<ChoiceHandoffProvider>\{children\}<\/ChoiceHandoffProvider>/);
  assert.match(choice, /initialHandoff \? 6 : 1/);
  assert.match(choice, /consumeChoiceHandoff\(initialHandoff\.token\)/);

  for (const label of [
    "디테일하게 직접 고르기",
    "같은 조건으로 다시 추천받기",
    "한마디 수정하기",
    "새 한마디로 시작하기",
  ]) {
    assert.match(result, new RegExp(label));
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
